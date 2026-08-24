'use server';

import { headers } from 'next/headers';
import { createServiceClient } from './supabase';

export interface ReviewFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

const NAME_MAX = 80;
const BODY_MAX = 1000;

// Public-submission throttle: at most this many submissions per IP per window.
const REVIEW_RATE_LIMIT = 5;
const REVIEW_RATE_WINDOW_S = 600; // 10 minutes

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return h.get('x-real-ip');
}

// Durable per-IP throttle via the shared check_rate_limit RPC. Fail-open: any
// missing config / limiter error returns false so a real customer is never
// blocked over infrastructure.
async function isRateLimited(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const ip = await getClientIp();
  if (!ip) return false;
  try {
    const { data: allowed, error } = await createServiceClient().rpc('check_rate_limit', {
      p_key: `review:${ip}`,
      p_limit: REVIEW_RATE_LIMIT,
      p_window_seconds: REVIEW_RATE_WINDOW_S,
    });
    if (error) {
      console.error('[review] rate-limit check failed (allowing):', error.message);
      return false;
    }
    return allowed === false;
  } catch (e) {
    console.error('[review] rate-limit check threw (allowing):', e);
    return false;
  }
}

export async function submitReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  if (await isRateLimited()) {
    return {
      status: 'error',
      message: 'Too many submissions in a short time — please wait a little and try again.',
    };
  }

  const reviewerName = str(formData, 'reviewer_name');
  const body = str(formData, 'body');
  const ratingRaw = str(formData, 'rating');
  const rating = Math.floor(Number(ratingRaw));
  const orderReference = str(formData, 'ref') || null;

  const fieldErrors: Record<string, string> = {};
  if (!reviewerName) fieldErrors.reviewer_name = 'Please enter your name.';
  else if (reviewerName.length > NAME_MAX) fieldErrors.reviewer_name = `Please keep your name under ${NAME_MAX} characters.`;
  if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5) fieldErrors.rating = 'Please choose a star rating.';
  if (!body) fieldErrors.body = 'Please write a few words.';
  else if (body.length > BODY_MAX) fieldErrors.body = `Please keep your review under ${BODY_MAX} characters.`;

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }

  // No DB configured (dev/demo) — accept without persisting so the form still works.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[review] DB not configured — review received but not saved:', { reviewerName, rating });
    return { status: 'success' };
  }

  try {
    const { error } = await createServiceClient().from('reviews').insert({
      rating,
      body,
      reviewer_name: reviewerName,
      order_reference: orderReference,
      approved: false,
    });
    if (error) throw error;
    return { status: 'success' };
  } catch (err) {
    console.error('[review] failed to save submission:', err);
    return {
      status: 'error',
      message: 'Sorry, something went wrong saving your review — please try again in a moment.',
    };
  }
}
