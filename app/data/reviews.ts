// Data-access for customer reviews. Public reads return only APPROVED reviews
// (Row Level Security enforces this for the anon key too). On any failure — or
// when Supabase isn't configured — this returns an EMPTY list, never fabricated
// reviews, so the storefront degrades to "no reviews" rather than showing fakes.

import type { Review } from './types';
import { isSupabaseConfigured, createReadClient } from '../lib/supabase';

export interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  reviewer_name: string;
  order_reference: string | null;
  product_name: string | null;
  approved: boolean;
  created_at: string;
}

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    reviewerName: row.reviewer_name,
    orderReference: row.order_reference ?? null,
    productName: row.product_name ?? null,
    approved: row.approved,
    createdAt: row.created_at,
  };
}

export async function getApprovedReviews(limit = 12): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) {
      console.warn('[data] reviews query failed, hiding reviews:', error?.message);
      return [];
    }
    return (data as ReviewRow[]).map(mapReview);
  } catch (e) {
    console.warn('[data] reviews query threw, hiding reviews:', e);
    return [];
  }
}
