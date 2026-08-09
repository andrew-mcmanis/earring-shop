import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '../../../lib/stripe';
import { createServiceClient } from '../../../lib/supabase';
import { flipProductsSoldOut } from '../../../lib/fulfilment';
import { sendOrderEmails, type OrderEmailData } from '../../../lib/email';

// Stripe signature verification needs the raw body + Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderItemRow {
  product_id: string | null;
  name: string;
  unit_price: number | string;
  quantity: number;
}
interface PaidOrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  order_items: OrderItemRow[];
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET missing');
    return new NextResponse('Not configured', { status: 500 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe] signature verification failed:', err instanceof Error ? err.message : err);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.order_id;
    if (!orderId) {
      console.error('[stripe] succeeded event without order_id metadata:', pi.id);
      return NextResponse.json({ received: true });
    }
    try {
      await fulfilPaidOrder(orderId, pi.id);
    } catch (err) {
      // Failing to RECORD the payment → 500 so Stripe retries the event.
      console.error('[stripe] failed to record payment for order', orderId, err);
      return new NextResponse('Processing error', { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.warn('[stripe] payment_failed for order', pi.metadata?.order_id, pi.last_payment_error?.message);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

async function fulfilPaidOrder(orderId: string, paymentIntentId: string): Promise<void> {
  const svc = createServiceClient();

  // Atomic claim: only the FIRST delivery flips paid_at from null → now(),
  // so redelivered events are exact no-ops (emails/flip run at most once).
  const { data, error } = await svc
    .from('orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntentId,
    })
    .eq('id', orderId)
    .is('paid_at', null)
    .select('*, order_items(*)');
  if (error) throw error;

  const claimed = (data as unknown as PaidOrderRow[]) ?? [];
  if (claimed.length === 0) return; // already processed, or order missing — idempotent

  const order = claimed[0];

  // Best-effort — the payment is already recorded; these must not fail the 200.
  const productIds = (order.order_items ?? []).map((i) => i.product_id).filter((x): x is string => Boolean(x));
  try {
    await flipProductsSoldOut(productIds);
  } catch (e) {
    console.error('[stripe] paid OK but sold-out flip failed for', orderId, e);
  }

  try {
    await sendOrderEmails(await buildEmailData(svc, order));
  } catch (e) {
    console.error('[stripe] paid OK but email send failed for', orderId, e);
  }
}

async function buildEmailData(svc: SupabaseClient, order: PaidOrderRow): Promise<OrderEmailData> {
  const isPickup = order.fulfilment_method === 'pickup';
  let collection: { address: string | null; note: string | null } | null = null;
  if (isPickup) {
    const { data: s } = await svc
      .from('settings')
      .select('pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    collection = { address: s?.pickup_address ?? null, note: s?.pickup_note ?? null };
  }
  return {
    reference: `BLG-${order.order_number}`,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    items: (order.order_items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    address: isPickup ? null : { line: order.address, city: order.city, postcode: order.postcode },
    collection,
  };
}
