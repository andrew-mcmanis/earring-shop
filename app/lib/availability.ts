'use server';

import { isSupabaseConfigured, createReadClient } from './supabase';
import { sampleProducts } from '../data/sample';

interface AvailabilityRow {
  id: string;
  sold_out: boolean | null;
  visible: boolean;
}

/**
 * Given cart product ids, return the subset that can no longer be ordered —
 * sold out, hidden, or missing. The cart's localStorage snapshot is never
 * trusted for availability; it is always re-checked here against the source.
 */
export async function getUnavailableProductIds(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];

  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, sold_out, visible')
      .in('id', unique);
    if (!error && data) {
      const orderable = new Set(
        (data as AvailabilityRow[])
          .filter((p) => p.visible && !p.sold_out)
          .map((p) => p.id),
      );
      return unique.filter((id) => !orderable.has(id));
    }
    // Configured DB but the query failed (e.g. column missing pre-migration, or a
    // transient error). Don't block the customer — the placeOrder server guard is
    // the authoritative backstop. The sample fallback below is keyed by sample IDs
    // which never match real DB UUIDs, so it must NOT run here.
    return [];
  }

  // Unconfigured / demo mode only: cart IDs are the sample IDs.
  const orderable = new Set(
    sampleProducts.filter((p) => p.visible && !p.soldOut).map((p) => p.id),
  );
  return unique.filter((id) => !orderable.has(id));
}
