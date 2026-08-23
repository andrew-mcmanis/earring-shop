'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '../../lib/admin-auth';

export async function setReviewApproved(id: string, approved: boolean): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('reviews').update({ approved }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}

export async function updateReview(
  id: string,
  fields: { rating: number; reviewerName: string; body: string },
): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const rating = Math.floor(Number(fields.rating));
  const reviewerName = fields.reviewerName.trim();
  const body = fields.body.trim();
  if (!reviewerName || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Name, a 1–5 rating and review text are all required.' };
  }
  const { error } = await supabase
    .from('reviews')
    .update({ reviewer_name: reviewerName, body, rating })
    .eq('id', id);
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}

export async function deleteReview(id: string): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return { error: `Could not delete: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}
