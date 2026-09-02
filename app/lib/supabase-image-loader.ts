'use client';

/**
 * Custom `next/image` loader — product photos are resized by Supabase Storage
 * rather than Vercel's image optimizer.
 *
 * Storage serves the originals with `Cache-Control: no-cache`, so Vercel's
 * optimizer re-transformed every variant of every photo each time its (4 hour)
 * TTL lapsed. That burned the Hobby plan's monthly transformation quota, after
 * which `/_next/image` answered 402 — old photos survived only while their
 * optimized copy sat in the edge cache, and newly added ones never showed at
 * all. Going straight to Storage's own render endpoint removes the quota from
 * the picture entirely, and still gives us a properly sized `srcset`.
 */

const OBJECT_PREFIX = '/storage/v1/object/public/';
const RENDER_PREFIX = '/storage/v1/render/image/public/';

// Storage clamps transformations at 3000px; asking for more just spends a
// second cache entry on a byte-identical image.
const MAX_WIDTH = 2500;

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({ src, width, quality }: LoaderArgs): string {
  // Anything that isn't a Storage object (the logo, static assets) is served
  // as-is — there's no optimizer behind us to fall back to.
  if (!src.includes(OBJECT_PREFIX)) return src;

  const url = new URL(src);
  url.pathname = url.pathname.replace(OBJECT_PREFIX, RENDER_PREFIX);
  url.searchParams.set('width', String(Math.min(width, MAX_WIDTH)));
  url.searchParams.set('quality', String(quality ?? 75));
  // Storage's default resize mode ignores the source aspect ratio — it holds the
  // original height and squashes the width. `contain` caps the longest edge at
  // `width` and scales the other side to match, which is what the `object-cover`
  // cards and the `object-contain` lightbox both expect.
  url.searchParams.set('resize', 'contain');
  return url.toString();
}
