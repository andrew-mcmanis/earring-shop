'use server';

import { isSupabaseConfigured, createServiceClient } from './supabase';
import { sampleDeliveryBase } from '../data/sample';

/**
 * The single flat delivery base price (£) — the first item pays this, each
 * additional item pays half (see computeShipping). Read via the service client
 * because it lives in the private settings row, but ONLY the price is ever
 * returned — never the collection address. Display-only for the cart/checkout;
 * placeOrder reads it authoritatively and fails honestly on error.
 */
export async function getDeliveryBase(): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('settings')
      .select('delivery_base')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return 0;
    return Number(data.delivery_base ?? 0);
  }
  return sampleDeliveryBase;
}
