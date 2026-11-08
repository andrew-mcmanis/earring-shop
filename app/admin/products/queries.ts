import { createServerSupabase } from '../../lib/supabase-server';
import { mapProduct, PRODUCT_COLUMNS, type ProductRow } from '../../data/products';
import type { Product } from '../../data/types';

// Admin reads use the signed-in user's session (RLS `authenticated`) and
// include hidden products — unlike the public storefront which only sees
// visible ones.

export async function adminGetProducts(): Promise<Product[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return (data as ProductRow[]).map(mapProduct);
}

export async function adminGetProduct(id: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapProduct(data as ProductRow);
}
