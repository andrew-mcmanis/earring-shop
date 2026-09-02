'use client';

import { MAX_UPLOAD_DIMENSION, MIN_PHOTO_DIMENSION } from '../data/types';

/**
 * Downscale a photo in the browser before it goes to Storage.
 *
 * Bev uploads straight off her phone, so the originals were arriving at ~4.5 MB
 * (5184x3888 and similar). The shop never serves those bytes — Storage resizes
 * on the way out — but they still make every upload a slog over mobile data and
 * make the first resize of each photo slower.
 *
 * Best-effort by design: any failure returns the original file untouched. A
 * photo that uploads large beats a photo that doesn't upload at all.
 */

// Re-encode as WebP; JPEG is the fallback for anything that can't produce it.
const WEBP_QUALITY = 0.85;

/** Below this, a photo isn't worth re-encoding — the saving wouldn't be real. */
const SKIP_UNDER_BYTES = 600 * 1024;

/**
 * Longest edge capped at MAX_UPLOAD_DIMENSION — except on an unusually long,
 * narrow photo, where honouring the cap would drop the shortest side below
 * MIN_PHOTO_DIMENSION and leave it blurry *after* ProductPhotos had measured
 * the original and judged it fine. There we stop at the threshold instead.
 *
 * A photo whose shortest side is already under the threshold skips that
 * protection: it has had its low-resolution warning, and exempting it would let
 * a very tall photo dodge the size cap altogether.
 */
function scaleFor(width: number, height: number): number {
  const longest = Math.max(width, height);
  const shortest = Math.min(width, height);
  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / longest);
  if (shortest < MIN_PHOTO_DIMENSION) return scale;
  return Math.max(scale, Math.min(1, MIN_PHOTO_DIMENSION / shortest));
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function resizeForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // GIFs may be animated and SVGs are already tiny — a canvas round-trip would
  // flatten one and rasterise the other.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  let bitmap: ImageBitmap | undefined;
  try {
    // `from-image` applies the EXIF orientation. Without it a portrait phone
    // photo is drawn sideways, because the canvas ignores the EXIF tag that the
    // <img> rendering path honours.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const scale = scaleFor(bitmap.width, bitmap.height);
    if (scale === 1 && file.size <= SKIP_UNDER_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob =
      (await toBlob(canvas, 'image/webp', WEBP_QUALITY)) ??
      (await toBlob(canvas, 'image/jpeg', WEBP_QUALITY));
    // Re-encoding a small or already-efficient photo can come out bigger than
    // it went in; keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
