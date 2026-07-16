'use server';

import { revalidatePath } from 'next/cache';
import type { Product } from '../data/types';
import { getProducts, mapProduct, type ProductRow } from '../data/products';
import { isSupabaseConfigured, createReadClient, createServiceClient } from './supabase';

export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
  /** Set only for a successful pickup order — the private collection details. */
  collection?: { address: string | null; note: string | null };
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

export async function placeOrder(
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

  // Read the catalogue with explicit error handling. getProducts() falls back
  // to the in-repo sample data on a query error — right for browsing, but here
  // it would make every real cart item miss and falsely report an empty cart.
  // A checkout must fail honestly instead.
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
    // Demo mode (no database): the sample catalogue matches the sample cart ids.
    catalogue = await getProducts();
  }
  const items: OrderLine[] = [];
  const soldOutNames: string[] = [];
  const orderedCategories = new Set<string>();
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!product || quantity <= 0) continue;
    if (product.soldOut) {
      soldOutNames.push(product.name);
      continue;
    }
    items.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity,
    });
    orderedCategories.add(product.categorySlug);
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

  // Delivery = the highest category rate among the ordered items (one parcel);
  // pickup = £0. Rates read from the DB here, never trusted from the client.
  let shipping = 0;
  if (!isPickup && isSupabaseConfigured() && orderedCategories.size > 0) {
    const rateClient = createReadClient();
    const { data: cats } = await rateClient
      .from('categories')
      .select('slug, delivery_charge')
      .in('slug', [...orderedCategories]);
    if (cats) {
      shipping = cats.reduce((max, c) => Math.max(max, Number(c.delivery_charge ?? 0)), 0);
    }
  }

  // If the database isn't configured, log the order so nothing is lost and the
  // customer still gets a confirmation.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[order] DB not configured — order received but not saved:\n', {
      name,
      email,
      items,
      subtotal,
    });
    return { status: 'success' };
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

    // Each piece is one-of-a-kind: once it sells, flip it to sold out so no one
    // else can order it. The owner toggles it back in stock when she makes a new
    // one. Best-effort — the order is already saved, so a failure here must NOT
    // break the customer's checkout (she can flip it manually from the admin).
    // NOTE: when Stripe lands, move this to the payment_intent.succeeded webhook
    // (alongside the confirmation email) so unpaid/abandoned orders never flip.
    try {
      const soldIds = [...new Set(items.map((l) => l.productId))];
      const { error: soldOutError } = await supabase
        .from('products')
        .update({ sold_out: true })
        .in('id', soldIds);
      if (soldOutError) throw soldOutError;
      revalidatePath('/');
      revalidatePath('/admin/products');
      for (const id of soldIds) revalidatePath(`/product/${id}`);
    } catch (flipErr) {
      console.error('[order] saved OK but failed to auto-flip sold-out:', flipErr, {
        reference: `BLG-${order.order_number}`,
      });
    }

    let collection: { address: string | null; note: string | null } | undefined;
    if (isPickup) {
      const { data: settings } = await supabase
        .from('settings')
        .select('pickup_address, pickup_note')
        .eq('id', true)
        .maybeSingle();
      collection = { address: settings?.pickup_address ?? null, note: settings?.pickup_note ?? null };
    }
    return { status: 'success', reference: `BLG-${order.order_number}`, collection };
  } catch (err) {
    // Don't break checkout on a transient/setup failure — log the full order
    // (recoverable) and still confirm to the customer.
    console.error('[order] FAILED to save — order logged for manual entry:', err, {
      name,
      email,
      phone,
      address,
      city,
      postcode,
      notes,
      items,
      subtotal,
    });
    return { status: 'success' };
  }
}
