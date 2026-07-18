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

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...productEntries,
  ];
}
