'use server';

import { isSupabaseConfigured, createReadClient } from './supabase';
import { sampleCategories } from '../data/sample';

/**
 * Category slug → delivery charge (£). Used for the cart's estimate line; the
 * authoritative charge is always recomputed server-side in placeOrder.
 */
export async function getDeliveryRates(): Promise<Record<string, number>> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase.from('categories').select('slug, delivery_charge');
    if (!error && data) {
      const rates: Record<string, number> = {};
      for (const c of data) rates[c.slug] = Number(c.delivery_charge ?? 0);
      return rates;
    }
    // Configured DB but the query failed (e.g. column missing pre-migration).
    // Don't leak sample rates (sample slugs would mismatch real categories) —
    // an empty map just yields the cart's generic estimate line.
    return {};
  }
  const rates: Record<string, number> = {};
  for (const c of sampleCategories) rates[c.slug] = c.deliveryCharge;
  return rates;
}
