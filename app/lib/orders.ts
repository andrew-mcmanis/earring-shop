'use server';

import { headers } from 'next/headers';
import type { Product } from '../data/types';
import { getProducts, mapProduct, type ProductRow } from '../data/products';
import { sampleDeliveryBase } from '../data/sample';
import { computeShipping } from './shipping';
import { flipProductsSoldOut } from './fulfilment';
import { isStripeConfigured, getStripe } from './stripe';
import { isSupabaseConfigured, createReadClient, createServiceClient } from './supabase';

export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
  /** Set only for a successful pickup order — the private collection details. */
  collection?: { address: string | null; note: string | null };
  /** The method the server actually processed — authoritative for the confirmation. */
  fulfilmentMethod?: 'delivery' | 'pickup';
  /** Present when payment is required (Stripe configured): the Payment Element secret. */
  clientSecret?: string;
}

interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checkout throttle: at most this many order-creation attempts per IP per
// window. Generous — a customer retrying a fumbled payment submits a handful at
// most — but it stops rapid-fire abuse, since each attempt writes an order row
// and creates a Stripe PaymentIntent.
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_S = 300; // 5 minutes

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

// Best client IP from the proxy headers Vercel sets. Null when unknown (then we
// simply don't throttle — never block a real customer over a missing header).
async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return h.get('x-real-ip');
}

/**
 * Durable, per-IP checkout throttle. Returns true when the request is over the
 * limit and should be blocked. Fail-open by design: a missing IP, an unconfigured
 * service role, or any limiter error (including the 0012 migration not yet run)
 * returns false so a real customer is never blocked over infrastructure.
 */
async function isRateLimited(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const ip = await getClientIp();
  if (!ip) return false;
  try {
    const { data: allowed, error } = await createServiceClient().rpc('check_rate_limit', {
      p_key: `checkout:${ip}`,
      p_limit: CHECKOUT_RATE_LIMIT,
      p_window_seconds: CHECKOUT_RATE_WINDOW_S,
    });
    if (error) {
      console.error('[order] rate-limit check failed (allowing):', error.message);
      return false;
    }
    return allowed === false;
  } catch (e) {
    console.error('[order] rate-limit check threw (allowing):', e);
    return false;
  }
}

export async function createOrderAndIntent(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  // Throttle before any DB write or Stripe call.
  if (await isRateLimited()) {
    return {
      status: 'error',
      message: 'Too many checkout attempts in a short time — please wait a minute and try again.',
    };
  }

  const name = str(formData, 'name');
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  const address = str(formData, 'address');
  const city = str(formData, 'city');
  const postcode = str(formData, 'postcode');
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';
  const recipientName = str(formData, 'recipient_name');
  // A gift is always a delivery — never honour it for pickup.
  const isGift = !isPickup && formData.get('is_gift') === 'true';

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter your name.';
  if (!email) fieldErrors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';
  if (isGift && !recipientName) fieldErrors.recipient_name = "Please enter the recipient's name.";

  // Rebuild the order from the authoritative catalogue — never trust
  // client-supplied names or prices.
  let cart: { id: string; qty: number }[] = [];
  try {
    const parsed = JSON.parse(str(formData, 'items') || '[]');
    if (Array.isArray(parsed)) cart = parsed;
  } catch {
    // ignore malformed payload — handled by the empty check below
  }

  let catalogue: Product[];
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase.from('products').select('*').eq('visible', true);
    if (error || !data) {
      console.error('[order] catalogue read failed during checkout:', error?.message);
      return {
        status: 'error',
        message: 'Sorry, something went wrong on our side — please try again in a moment.',
      };
    }
    catalogue = (data as ProductRow[]).map(mapProduct);
  } else {
    catalogue = await getProducts();
  }

  const items: OrderLine[] = [];
  const soldOutNames: string[] = [];
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!product || quantity <= 0) continue;
    if (product.soldOut) {
      soldOutNames.push(product.name);
      continue;
    }
    // One-of-a-kind: never trust the client quantity — each product is a single
    // unit, so the order line is always quantity 1 (guards a tampered cart from
    // overselling/overcharging).
    items.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity: 1 });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }
  if (soldOutNames.length > 0) {
    const names = [...new Set(soldOutNames)];
    const pronoun = names.length > 1 ? 'them' : 'it';
    return {
      status: 'error',
      message: `Sorry, ${names.join(', ')} just sold out — please remove ${pronoun} from your basket to continue.`,
    };
  }
  if (items.length === 0) {
    return { status: 'error', message: 'Your basket is empty — add an item before checking out.' };
  }

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // Delivery recomputed server-side from the private settings row.
  let shipping = 0;
  if (!isPickup) {
    const count = items.reduce((n, l) => n + l.quantity, 0);
    if (isSupabaseConfigured()) {
      const svc = createServiceClient();
      const { data: s, error: baseError } = await svc
        .from('settings')
        .select('delivery_base')
        .eq('id', true)
        .maybeSingle();
      if (baseError) {
        console.error('[order] delivery base read failed during checkout:', baseError.message);
        return {
          status: 'error',
          message: 'Sorry, something went wrong on our side — please try again in a moment.',
        };
      }
      shipping = computeShipping(count, Number(s?.delivery_base ?? 0));
    } else {
      shipping = computeShipping(count, sampleDeliveryBase);
    }
  }

  const total = subtotal + shipping;

  // Demo mode (no DB): log the order so nothing is lost; confirm to the customer.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[order] DB not configured — order received but not saved:\n', {
      name, email, items, subtotal, shipping,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    });
    return { status: 'success', fulfilmentMethod: isPickup ? 'pickup' : 'delivery' };
  }

  try {
    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        address: isPickup ? null : address,
        city: isPickup ? null : city || null,
        postcode: isPickup ? null : postcode || null,
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
        shipping,
        fulfilment_method: isPickup ? 'pickup' : 'delivery',
        is_gift: isGift,
        recipient_name: isGift ? recipientName : null,
        status: 'new',
        // payment_status intentionally omitted — the column DEFAULTs to 'unpaid'.
        // This keeps the INSERT valid both before AND after migration 0010, so a
        // code-ahead-of-schema deploy window never silently drops orders.
      })
      .select('id, order_number')
      .single();

    if (error || !order) throw error ?? new Error('No order returned');

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
      })),
    );
    if (itemsError) {
      // Roll back the just-created order so a failed items insert never leaves an
      // itemless orphan row. Best-effort: the delete returns (not throws) on
      // error, and we throw the original itemsError to the honest-failure catch.
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    const reference = `BLG-${order.order_number}`;

    // Read pickup collection details for the confirmation screen (never client-trusted).
    let collection: { address: string | null; note: string | null } | undefined;
    if (isPickup) {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('pickup_address, pickup_note')
        .eq('id', true)
        .maybeSingle();
      if (settingsError) {
        console.error('[order] pickup settings read failed:', settingsError.message);
      }
      collection = { address: settings?.pickup_address ?? null, note: settings?.pickup_note ?? null };
    }

    // ── Payment path ──────────────────────────────────────────────────
    // With Stripe configured, create a PaymentIntent and hand the client its
    // secret. The order stays 'unpaid'; the webhook flips sold-out + emails on
    // success. Do NOT flip here.
    if (isStripeConfigured()) {
      try {
        const intent = await getStripe().paymentIntents.create({
          amount: Math.round(total * 100), // GBP pence
          currency: 'gbp',
          automatic_payment_methods: { enabled: true },
          metadata: { order_id: order.id, reference },
        });
        const { error: intentSaveError } = await supabase
          .from('orders')
          .update({ stripe_payment_intent: intent.id })
          .eq('id', order.id);
        if (intentSaveError) {
          // Non-fatal: the webhook keys on metadata.order_id and re-writes this.
          console.error('[order] failed to store payment intent id:', intentSaveError.message, { reference });
        }
        return {
          status: 'success',
          reference,
          collection,
          fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
          clientSecret: intent.client_secret ?? undefined,
        };
      } catch (payErr) {
        console.error('[order] saved OK but PaymentIntent creation failed:', payErr, { reference });
        return {
          status: 'error',
          message: 'Sorry, we could not start the payment — please try again in a moment.',
        };
      }
    }

    // ── Fallback path (no Stripe keys yet) ────────────────────────────
    // Behaves like today: treat as placed, flip sold-out inline, confirm.
    try {
      await flipProductsSoldOut(items.map((l) => l.productId));
    } catch (flipErr) {
      console.error('[order] saved OK but failed to auto-flip sold-out:', flipErr, { reference });
    }
    return {
      status: 'success',
      reference,
      collection,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    };
  } catch (err) {
    // A database write failed (order/items insert, or a settings read). No
    // payment has been taken — the Payment Element is only revealed on a
    // successful save — so fail honestly rather than falsely confirming an order
    // that was never recorded. The customer can safely retry; nothing was charged.
    console.error('[order] FAILED to save — no order recorded:', err, {
      name, email, phone, address, city, postcode, notes, items, subtotal, shipping,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    });
    return {
      status: 'error',
      message:
        'Sorry, something went wrong saving your order — please try again in a moment. You have not been charged.',
    };
  }
}
