import type { NextConfig } from 'next';

// Allow <Image> to load product photos from Supabase Storage.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
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
    // Product photos are posted through the create/edit Server Action.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
