'use client';

import { useEffect, useState } from 'react';

interface LastOrder {
  reference: string | null;
  method: 'delivery' | 'pickup';
  collection: { address: string | null; note: string | null } | null;
  paid?: boolean;
}

export function OrderConfirmation({ fallbackRef }: { fallbackRef?: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [checked, setChecked] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState<string | null>(null);

  // One-shot mount read of the URL + sessionStorage, both client-only. Server
  // and first client render show nothing, then this fills them in — the SSR-safe
  // pattern, not the cascading-render anti-pattern the rule targets (reading
  // sessionStorage during render would cause a hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setRedirectStatus(params.get('redirect_status'));
    } catch {
      // ignore
    }
    try {
      const raw = sessionStorage.getItem('blg-last-order');
      if (raw) {
        setOrder(JSON.parse(raw) as LastOrder);
        // One-shot: don't leave the private collection address in storage.
        sessionStorage.removeItem('blg-last-order');
      }
    } catch {
      // ignore — fall back to the generic message below
    }
    setChecked(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const matchedOrder =
    order && (order.reference ?? null) === (fallbackRef ?? null) ? order : null;
  const reference = matchedOrder?.reference ?? fallbackRef;
  // Paid when either the stored flag says so, or Stripe redirected with success.
  const paid = Boolean(matchedOrder?.paid) || redirectStatus === 'succeeded';

  // A returned-but-not-succeeded 3-D Secure redirect: payment didn't complete.
  if (checked && redirectStatus && redirectStatus !== 'succeeded') {
    return (
      <p className="font-body text-base text-ink-light max-w-md leading-relaxed" role="alert">
        Your payment wasn&apos;t completed. Please return to the checkout and try again — you
        haven&apos;t been charged.
      </p>
    );
  }

  return (
    <>
      {reference && (
        <p className="font-body text-sm text-ink-light">
          Your reference is{' '}
          <span className="font-semibold text-ink tabular-nums">{reference}</span>.
        </p>
      )}

      {!checked ? null : matchedOrder?.method === 'pickup' && matchedOrder.collection?.address ? (
        <div className="font-body text-base text-ink-light max-w-md leading-relaxed flex flex-col gap-2">
          <p>Your order is for collection. You can pick it up from:</p>
          <p className="whitespace-pre-line font-medium text-ink bg-cream-dark rounded-lg px-4 py-3">
            {matchedOrder.collection.address}
          </p>
          {matchedOrder.collection.note && <p>{matchedOrder.collection.note}</p>}
          <p>We&apos;ll be in touch to arrange a time.</p>
        </div>
      ) : matchedOrder?.method === 'pickup' ? (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          Your order is for collection — we&apos;ll be in touch with the details shortly.
        </p>
      ) : paid ? (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          Payment received — we&apos;ve emailed your confirmation. We&apos;ll be in touch about
          delivery. Thank you!
        </p>
      ) : (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          We&apos;ll be in touch by email shortly to confirm payment and delivery. Keep an eye on
          your inbox.
        </p>
      )}
    </>
  );
}
