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
  experimental: {
    // Product photos are posted together through the create/edit Server Action,
    // so this whole-request limit must cover the worst case of MAX_PRODUCT_PHOTOS
    // (6) × MAX_PHOTO_BYTES (8 MB) ≈ 48 MB, plus form-field overhead.
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
};

export default nextConfig;
