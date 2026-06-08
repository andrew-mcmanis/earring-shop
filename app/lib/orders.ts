'use server';

import { getProducts } from '../data/products';
import { forwardOrderToClearInvoice, type OrderLine } from './clearinvoice';

export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
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
      items.push({ description: product.name, quantity, unitPrice: product.price });
    }
  }

  if (items.length === 0) {
    return { status: 'error', message: 'Your cart is empty — add a pair before checking out.' };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const result = await forwardOrderToClearInvoice({
    customer: {
      name,
      email,
      phone: phone || undefined,
      address,
      city: city || undefined,
      postcode: postcode || undefined,
      country: 'United Kingdom',
    },
    items,
    subtotal,
    notes: notes || undefined,
    placedAt: new Date().toISOString(),
  });

  if (!result.ok) {
    return {
      status: 'error',
      message: result.error ?? 'Something went wrong placing your order. Please try again.',
    };
  }

  return { status: 'success', reference: result.reference };
}
