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

export type OrderStatus = 'new' | 'made' | 'posted' | 'cancelled';

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  /** Delivery address; null for pickup orders. */
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  notes: string | null;
  subtotal: number;
  shipping: number;
  fulfilmentMethod: 'delivery' | 'pickup';
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
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
  /** Main photo (derived = images[0]), or null to show the placeholder. */
  image: string | null;
  /** Ordered gallery photos; images[0] is the main photo. */
  images: string[];
  visible: boolean;
  /** Sold out: stays on display but cannot be ordered. */
  soldOut: boolean;
  sortOrder: number;
}

/** Maximum photos a product may have (admin + server both enforce this). */
export const MAX_PRODUCT_PHOTOS = 6;

/** Maximum size per uploaded photo, in bytes (8 MB). Enforced client + server. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Advisory minimum photo dimension (shortest side, px). Below this the admin
 *  gets a non-blocking "may look blurry" warning — the product detail view
 *  renders photos up to ~700px, so smaller sources get upscaled. */
export const MIN_PHOTO_DIMENSION = 1000;
