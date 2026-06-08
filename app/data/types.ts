// Core product model. Mirrors the eventual Supabase tables (see
// supabase/schema.sql) so moving from the in-repo sample data to the database
// won't change any component or these shapes.

export interface Category {
  slug: string;
  name: string;
  sortOrder: number;
}

export interface Subcategory {
  slug: string;
  name: string;
  categorySlug: string;
  sortOrder: number;
}

export interface Colour {
  slug: string;
  name: string;
  /** Swatch colour. Empty for "multicolour", which renders a special swatch. */
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categorySlug: string;
  /** Only meaningful for Earrings; null for Bookmarks/Gifts. */
  subcategorySlug: string | null;
  /** Optional — left null when colour doesn't apply. */
  colourSlug: string | null;
  /** Tint used for the placeholder graphic until a real photo exists. */
  accentColor: string;
  /** Public URL of the product photo, or null to show the placeholder. */
  image: string | null;
  visible: boolean;
  sortOrder: number;
}
