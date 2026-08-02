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
  },
  // Product photos now upload straight from the browser to Storage via a signed
  // URL, so no large payloads pass through Server Actions — the default request
  // body limit is fine (and avoids masking Vercel's ~4.5 MB function cap).
};

export default nextConfig;
