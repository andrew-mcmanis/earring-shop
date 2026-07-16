// Data-access layer for the storefront.
//
// When Supabase is configured (see SETUP.md) these functions read from the
// database; otherwise they fall back to the in-repo sample catalogue so the
// shop always works. The async signatures are identical either way, so no page
// or component depends on the source.

import type { Category, Subcategory, Colour, Product } from './types';
import {
  sampleCategories,
  sampleSubcategories,
  sampleColours,
  sampleProducts,
} from './sample';
import { isSupabaseConfigured, createReadClient } from '../lib/supabase';

// Row shapes as returned by the database (snake_case).
export interface ProductRow {
  id: string;
  name: string;
  description: string;
  price: number | string;
  category_slug: string;
  subcategory_slug: string | null;
  colour_slug: string | null;
  accent_color: string;
  image_url: string | null;
  image_urls: string[] | null;
  visible: boolean;
  sold_out: boolean | null;
  sort_order: number;
}

export function mapProduct(row: ProductRow): Product {
  // Prefer the ordered gallery; fall back to the legacy single image when the
  // array is null OR empty (so a row with only image_url still shows its photo).
  const images =
    row.image_urls && row.image_urls.length > 0
      ? row.image_urls
      : row.image_url
        ? [row.image_url]
        : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    categorySlug: row.category_slug,
    subcategorySlug: row.subcategory_slug,
    colourSlug: row.colour_slug,
    accentColor: row.accent_color ?? '#B5865A',
    image: images[0] ?? null,
    images,
    visible: row.visible,
    soldOut: row.sold_out ?? false,
    sortOrder: row.sort_order ?? 0,
  };
}

export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name, sort_order, delivery_charge')
      .order('sort_order');
    if (!error && data) {
      return data.map((c) => ({
        slug: c.slug,
        name: c.name,
        sortOrder: c.sort_order ?? 0,
        deliveryCharge: Number(c.delivery_charge ?? 0),
      }));
    }
    console.warn('[data] categories query failed, using sample data:', error?.message);
  }
  return [...sampleCategories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getSubcategories(): Promise<Subcategory[]> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('subcategories')
      .select('slug, name, category_slug, sort_order')
      .order('sort_order');
    if (!error && data) {
      return data.map((s) => ({
        slug: s.slug,
        name: s.name,
        categorySlug: s.category_slug,
        sortOrder: s.sort_order ?? 0,
      }));
    }
    console.warn('[data] subcategories query failed, using sample data:', error?.message);
  }
  return [...sampleSubcategories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getColours(): Promise<Colour[]> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase.from('colours').select('slug, name, hex');
    if (!error && data) {
      return data.map((c) => ({ slug: c.slug, name: c.name, hex: c.hex ?? '' }));
    }
    console.warn('[data] colours query failed, using sample data:', error?.message);
  }
  return sampleColours;
}

export async function getProducts(): Promise<Product[]> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('visible', true)
      .order('sort_order');
    if (!error && data) {
      return (data as ProductRow[]).map(mapProduct);
    }
    console.warn('[data] products query failed, using sample data:', error?.message);
  }
  return sampleProducts.filter((p) => p.visible).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProduct(id: string): Promise<Product | null> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('visible', true)
      .maybeSingle();
    if (!error) {
      return data ? mapProduct(data as ProductRow) : null;
    }
    console.warn('[data] product query failed, using sample data:', error?.message);
  }
  return sampleProducts.find((p) => p.id === id && p.visible) ?? null;
}
