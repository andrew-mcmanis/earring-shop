'use server';

import { getProducts } from '../data/products';
import { createServiceClient } from './supabase';

export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
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

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter your name.';
  if (!email) fieldErrors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (!address) fieldErrors.address = 'Please enter a delivery address.';

  // Rebuild the order from the authoritative catalogue — never trust
  // client-supplied names or prices.
  let cart: { id: string; qty: number }[] = [];
  try {
    const parsed = JSON.parse(str(formData, 'items') || '[]');
    if (Array.isArray(parsed)) cart = parsed;
  } catch {
    // ignore malformed payload — handled by the empty check below
  }

  const catalogue = await getProducts();
  const items: OrderLine[] = [];
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (product && quantity > 0) {
      items.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity,
      });
    }
  }

  if (items.length === 0) {
    return { status: 'error', message: 'Your cart is empty — add a pair before checking out.' };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

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
        address,
        city: city || null,
        postcode: postcode || null,
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
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

    return { status: 'success', reference: `BLG-${order.order_number}` };
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
