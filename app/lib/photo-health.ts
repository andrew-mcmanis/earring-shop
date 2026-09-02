import { SITE_URL } from './site';

/**
 * Daily canary for product photos.
 *
 * Twice now the shop has served broken images for days without anyone noticing
 * — first when Vercel's image-transformation quota ran out and `/_next/image`
 * started answering 402, and the fault only surfaced because the owner spotted
 * it. Silent breakage is the actual problem to solve; the transformation
 * plumbing is just where it happened to bite.
 *
 * Rather than probing a hard-coded endpoint, this reads the live homepage and
 * checks the image URLs the page ACTUALLY references. That keeps it honest
 * across changes in how photos are delivered — Vercel's optimizer, Storage's
 * render endpoint, or plain objects — with no false alarms when that changes,
 * and no edits needed here.
 */

/** How many of the page's photos to sample. Enough to catch a systemic fault
 *  (a spent quota, a bad config, a deleted bucket) without a heavy daily job. */
const SAMPLE_SIZE = 6;

/** Delivery URLs a rendered page can legitimately reference. */
/** This runs inside the daily cron, so every request is bounded — a hung
 *  fetch must not stall the keep-alive behind it. */
const TIMEOUT_MS = 8000;

const IMAGE_URL_RE =
  /\/_next\/image\?url=[^"'\s,\\]+|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/(?:object|render)\/[^"'\s,\\]+/gi;

export interface PhotoFailure {
  url: string;
  status: number | string;
}

export interface PhotoHealth {
  checked: number;
  failures: PhotoFailure[];
}

/** Spread the sample across the page rather than taking the first N, so a fault
 *  affecting only later products still shows up. */
function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

async function checkOne(url: string): Promise<PhotoFailure | null> {
  const absolute = url.startsWith('/') ? `${SITE_URL}${url}` : url;
  try {
    const res = await fetch(absolute, {
      // Ask as a browser would — delivery often content-negotiates on Accept.
      headers: { Accept: 'image/avif,image/webp,image/*,*/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = res.headers.get('content-type') ?? '';
    // A 200 that isn't an image counts as a failure: that's exactly the shape
    // of the 402 "Payment required" body that broke the shop.
    if (!res.ok || !type.startsWith('image/')) {
      return { url: absolute, status: res.ok ? `200 ${type || 'no content-type'}` : res.status };
    }
    return null;
  } catch (e) {
    return { url: absolute, status: e instanceof Error ? e.message : 'fetch failed' };
  }
}

/**
 * Returns null when there was nothing to check (no photos on the page yet) —
 * distinct from an empty failure list, which means everything passed.
 */
export async function checkProductPhotos(): Promise<PhotoHealth | null> {
  let html: string;
  try {
    const res = await fetch(SITE_URL, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { checked: 0, failures: [{ url: SITE_URL, status: res.status }] };
    html = await res.text();
  } catch (e) {
    return { checked: 0, failures: [{ url: SITE_URL, status: e instanceof Error ? e.message : 'fetch failed' }] };
  }

  // Attribute values arrive HTML-escaped, so `&` shows up as `&amp;`.
  const found = [...html.matchAll(IMAGE_URL_RE)].map((m) => m[0].replace(/&amp;/g, '&'));
  const unique = [...new Set(found)];
  if (unique.length === 0) return null;

  const chosen = sample(unique, SAMPLE_SIZE);
  const results = await Promise.all(chosen.map(checkOne));
  return { checked: chosen.length, failures: results.filter((r): r is PhotoFailure => r !== null) };
}
