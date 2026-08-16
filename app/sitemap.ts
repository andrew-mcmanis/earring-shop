import type { MetadataRoute } from 'next';
import { getProducts } from './data/products';
import { SITE_URL } from './lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const productEntries: MetadataRoute.Sitemap = products
    .filter((p) => p.visible)
    .map((p) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  // Static content pages (policies, care, contact). They change rarely but
  // should be crawlable/credible — especially the policy pages.
  const contentEntries: MetadataRoute.Sitemap = [
    '/returns',
    '/jewellery-care',
    '/contact',
    '/privacy',
    '/terms',
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.5,
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...contentEntries,
    ...productEntries,
  ];
}
