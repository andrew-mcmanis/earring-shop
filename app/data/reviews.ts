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

/**
 * Count + average rating across ALL approved reviews (not just the displayed
 * page), so the homepage aggregate stays accurate beyond the display limit.
 * Returns { count: 0, average: 0 } on any failure or when there are none.
 */
export async function getApprovedReviewStats(): Promise<{ count: number; average: number }> {
  if (!isSupabaseConfigured()) return { count: 0, average: 0 };
  try {
    const supabase = createReadClient();
    const { data, count, error } = await supabase
      .from('reviews')
      .select('rating', { count: 'exact' })
      .eq('approved', true);
    if (error || !data || !count) {
      if (error) console.warn('[data] review stats query failed:', error.message);
      return { count: 0, average: 0 };
    }
    const rows = data as { rating: number }[];
    const average = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
    return { count, average };
  } catch (e) {
    console.warn('[data] review stats query threw:', e);
    return { count: 0, average: 0 };
  }
}
