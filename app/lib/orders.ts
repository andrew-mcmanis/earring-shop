'use server';

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

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function createOrderAndIntent(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const name = str(formData, 'name');
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  const address = str(formData, 'address');
  const city = str(formData, 'city');
  const postcode = str(formData, 'postcode');
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter your name.';
  if (!email) fieldErrors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';

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
    items.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }
  if (soldOutNames.length > 0) {
    const names = [...new Set(soldOutNames)];
    const pronoun = names.length > 1 ? 'them' : 'it';
    return {
      status: 'error',
      message: `Sorry, ${names.join(', ')} just sold out — please remove ${pronoun} from your cart to continue.`,
    };
  }
  if (items.length === 0) {
    return { status: 'error', message: 'Your cart is empty — add an item before checking out.' };
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
        status: 'new',
        payment_status: 'unpaid',
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
    if (itemsError) throw itemsError;

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
        await supabase
          .from('orders')
          .update({ stripe_payment_intent: intent.id })
          .eq('id', order.id);
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
    console.error('[order] FAILED to save — order logged for manual entry:', err, {
      name, email, phone, address, city, postcode, notes, items, subtotal, shipping,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    });
    return { status: 'success', fulfilmentMethod: isPickup ? 'pickup' : 'delivery' };
  }
}
