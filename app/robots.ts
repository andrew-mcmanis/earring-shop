import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Admin is auth-gated; checkout/confirmation aren't meant to be indexed.
      disallow: ['/admin/', '/checkout'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
