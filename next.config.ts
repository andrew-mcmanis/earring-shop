import type { NextConfig } from 'next';

// Allow <Image> to load product photos from Supabase Storage.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Ensure the OG-card font files are bundled into the image routes on Vercel.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/**'],
    '/product/[id]/opengraph-image': ['./assets/**'],
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],

    // --- Keeping inside the image-transformation quota -----------------------
    // The quota blew once already. Storage serves every object with
    // `Cache-Control: no-cache`, and the default TTL here is 4 hours, so each
    // variant of each photo was re-transformed ~6x a day — tens of thousands a
    // month. The optimized image expires on whichever is LARGER of this value
    // and the upstream header, so setting it high fixes that on our side alone;
    // passing `cacheControl` on upload does NOT work (the bucket overrides it
    // back to no-cache — verified).
    //
    // Filenames are content-addressed UUIDs, so the bytes behind a URL never
    // change and a long TTL is safe: editing a photo uploads a new UUID.
    minimumCacheTTL: 2678400, // 31 days

    // One format and one quality instead of AVIF+WebP at several qualities —
    // each extra combination is another billable transformation for no visible
    // gain here (photos are already WebP masters).
    formats: ['image/webp'],
    qualities: [75],

    // Trimmed from the defaults, which run to 3840px. Photos are stored as
    // 2000px masters, so the wider entries only ever bought upscaled variants.
    deviceSizes: [640, 828, 1080, 1920, 2560],
  },
  // Product photos upload straight from the browser to Storage via a signed
  // URL, so no large payloads pass through Server Actions — the default request
  // body limit is fine (and avoids masking Vercel's ~4.5 MB function cap).
};

export default nextConfig;
