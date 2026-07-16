'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '../../lib/supabase-server';

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

async function requireUser(): Promise<SupabaseClient> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authorised.');
  return supabase;
}

export async function setDeliveryCharge(slug: string, charge: number): Promise<DeliveryResult> {
  const supabase = await requireUser();
  if (!Number.isFinite(charge) || charge < 0 || charge > 1000) {
    return { ok: false, error: 'Enter a valid charge between £0 and £1000.' };
  }
  const { error } = await supabase
    .from('categories')
    .update({ delivery_charge: charge })
    .eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/delivery');
  revalidatePath('/');
  revalidatePath('/checkout');
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
