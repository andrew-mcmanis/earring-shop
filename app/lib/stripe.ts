import Stripe from 'stripe';

// Instantiate lazily so importing this module never throws when keys are
// absent (keeps local/demo builds and the graceful no-payment fallback working).
let cached: Stripe | null = null;

/** True once both Stripe keys are present. Drives the payment-vs-fallback path. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

/** Server-only Stripe client (secret key). Throws only when actually called
 *  without a key. Uses the account's default API version. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured — STRIPE_SECRET_KEY missing.');
  if (!cached) cached = new Stripe(key);
  return cached;
}
