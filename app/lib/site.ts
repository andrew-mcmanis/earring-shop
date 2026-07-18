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
