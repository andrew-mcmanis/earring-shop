import { createServerSupabase } from '../../lib/supabase-server';
import type { Category } from '../../data/types';

export interface PickupDetails {
  address: string;
  note: string;
}

export async function getPickupDetails(): Promise<PickupDetails> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    return { address: data?.pickup_address ?? '', note: data?.pickup_note ?? '' };
  } catch {
    return { address: '', note: '' };
  }
}

export interface DeliveryCategoriesResult {
  categories: Category[];
  error: boolean;
}

/**
 * Categories for the rate editor, read on the admin's authenticated session.
 * Fails honestly (empty + error flag) rather than falling back to sample data —
 * the owner must never edit fabricated categories.
 */
export async function getDeliveryCategories(): Promise<DeliveryCategoriesResult> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name, sort_order, delivery_charge')
      .order('sort_order');
    if (error || !data) return { categories: [], error: true };
    return {
      categories: data.map((c) => ({
        slug: c.slug,
        name: c.name,
        sortOrder: c.sort_order ?? 0,
        deliveryCharge: Number(c.delivery_charge ?? 0),
      })),
      error: false,
    };
  } catch {
    return { categories: [], error: true };
  }
}
