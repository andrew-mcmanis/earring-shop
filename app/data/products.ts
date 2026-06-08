// Data-access layer for the storefront.
//
// Phase 1 reads from the in-repo sample catalogue (app/data/sample.ts). When
// the Supabase project exists (see SETUP.md), each function gets a DB-backed
// branch — e.g.
//
//   if (isSupabaseConfigured()) {
//     const supabase = await createServerClient();
//     const { data } = await supabase.from('products').select('...');
//     return data ?? [];
//   }
//   return <sample>;
//
// The async signatures below already match, so swapping the source will not
// touch any page or component.

import type { Category, Subcategory, Colour, Product } from './types';
import {
  sampleCategories,
  sampleSubcategories,
  sampleColours,
  sampleProducts,
} from './sample';

export async function getCategories(): Promise<Category[]> {
  return [...sampleCategories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getSubcategories(): Promise<Subcategory[]> {
  return [...sampleSubcategories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getColours(): Promise<Colour[]> {
  return sampleColours;
}

export async function getProducts(): Promise<Product[]> {
  return sampleProducts
    .filter((p) => p.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProduct(id: string): Promise<Product | null> {
  return sampleProducts.find((p) => p.id === id && p.visible) ?? null;
}
