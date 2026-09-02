import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure the OG-card font files are bundled into the image routes on Vercel.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/**'],
    '/product/[id]/opengraph-image': ['./assets/**'],
  },
  images: {
    // Product photos are resized by Supabase Storage, not Vercel — see the
    // loader for why. `remotePatterns` no longer applies: with a custom loader
    // nothing goes through `/_next/image`, so there's no host allowlist to keep.
    loader: 'custom',
    loaderFile: './app/lib/supabase-image-loader.ts',
    // Trimmed from the defaults (which run up to 3840px). The widest a photo is
    // ever shown is half of a large desktop viewport, so the top entries only
    // ever bought us extra transformations.
    deviceSizes: [640, 828, 1080, 1920, 2560],
  },
  // Product photos now upload straight from the browser to Storage via a signed
  // URL, so no large payloads pass through Server Actions — the default request
  // body limit is fine (and avoids masking Vercel's ~4.5 MB function cap).
};

export default nextConfig;
