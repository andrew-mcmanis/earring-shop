'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useCart } from './CartProvider';
import { OrderAgreement } from './OrderAgreement';
import { CancelOrder } from './CancelOrder';

// loadStripe once at module scope (idempotent). Gated on the key: calling
// loadStripe('') throws an uncaught IntegrationError, and this module is
// statically imported by CheckoutForm even in the no-keys fallback window. We
// only ever RENDER this component when the server returned a client secret
// (which implies the key is set), so a null promise here is never consumed.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#B5865A',
    colorText: '#1A1A1A',
    colorBackground: '#ffffff',
    borderRadius: '6px',
    fontFamily: 'Cabin, system-ui, sans-serif',
  },
};

interface Props {
  clientSecret: string;
  reference?: string;
  method: 'delivery' | 'pickup';
  collection?: { address: string | null; note: string | null } | null;
  onEdit: () => void;
}

export function StripePaymentStep(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance }}>
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({ reference, method, collection, onEdit }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // Persist the confirmation payload BEFORE confirming, so it survives a 3-D
    // Secure redirect back to the success page. Marked paid:true — we only reach
    // /checkout/success on a successful (or redirect_status=succeeded) payment.
    const q = reference ? `?ref=${encodeURIComponent(reference)}` : '';
    try {
      sessionStorage.setItem(
        'blg-last-order',
        JSON.stringify({ reference: reference ?? null, method, collection: collection ?? null, paid: true }),
      );
    } catch {
      // sessionStorage unavailable — success page falls back to ref + generic copy.
    }

    const { error: payError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/success${q}` },
      redirect: 'if_required',
    });

    if (payError) {
      setError(payError.message ?? 'Payment could not be completed. Please try again.');
      setSubmitting(false);
      return;
    }
    // No redirect required → success. Clear the cart and go to confirmation.
    clear();
    router.push(`/checkout/success${q}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
        <legend className="font-heading text-2xl font-bold text-ink mb-1">Payment</legend>
        {error && (
          <div role="alert" className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">
            {error}
          </div>
        )}
        <PaymentElement />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing…' : 'Pay now'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={submitting}
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 disabled:opacity-60"
        >
          ← Edit details
        </button>
        <CancelOrder disabled={submitting} />
      </div>
      <p className="font-body text-xs text-ink-light">
        Payments are processed securely by Stripe. Your card details never touch our servers.
      </p>
      <OrderAgreement />
    </form>
  );
}
