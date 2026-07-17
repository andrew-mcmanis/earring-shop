'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '../../lib/admin-auth';

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

export async function setDeliveryBase(price: number): Promise<DeliveryResult> {
  const supabase = await requireUser();
  if (!Number.isFinite(price) || price < 0 || price > 1000) {
    return { ok: false, error: 'Enter a valid price between £0 and £1000.' };
  }
  const { error } = await supabase
    .from('settings')
    .upsert({ id: true, delivery_base: price, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  // /checkout renders per-request and the cart fetches the base live, so only
  // the admin page itself needs revalidating.
  revalidatePath('/admin/delivery');
  return { ok: true };
}

export async function updatePickupDetails(address: string, note: string): Promise<DeliveryResult> {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('settings')
    .upsert({
      id: true,
      pickup_address: address.trim() || null,
      pickup_note: note.trim() || null,
      updated_at: new Date().toISOString(),
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/delivery');
  return { ok: true };
}
