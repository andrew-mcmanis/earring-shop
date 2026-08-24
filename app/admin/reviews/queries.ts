import { createServerSupabase } from '../../lib/supabase-server';
import { mapReview, type ReviewRow } from '../../data/reviews';
import type { Review } from '../../data/types';

// All reviews for moderation (pending first, then newest). Uses the signed-in
// admin client, whose RLS policy ("admin read reviews") returns every row.
export async function adminGetReviews(): Promise<Review[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('approved', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as ReviewRow[]).map(mapReview);
}
