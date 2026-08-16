/**
 * Canonical site origin, used for metadata, sitemap, robots and JSON-LD.
 * Prefers an explicit NEXT_PUBLIC_APP_URL (set this to a custom domain when one
 * exists), then Vercel's stable production domain, then the per-deploy URL, then
 * localhost. Using the production-domain var keeps canonical/sitemap URLs stable
 * across deploys instead of pointing at deployment-specific hostnames.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

/** Public contact / customer-service mailbox, shown on the content pages. */
export const ORDERS_EMAIL = 'orders@blgcreations.co.uk';

/** Public Instagram profile + handle, shown on the content pages. */
export const INSTAGRAM_URL = 'https://instagram.com/blg.creations';
export const INSTAGRAM_HANDLE = '@BLG.Creations';
