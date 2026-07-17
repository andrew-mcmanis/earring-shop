'use client';

import { useEffect, useState } from 'react';

interface LastOrder {
  reference: string | null;
  method: 'delivery' | 'pickup';
  collection: { address: string | null; note: string | null } | null;
}

export function OrderConfirmation({ fallbackRef }: { fallbackRef?: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('blg-last-order');
      if (raw) setOrder(JSON.parse(raw) as LastOrder);
    } catch {
      // ignore — fall back to the generic message below
    }
  }, []);

  // Only trust the cached payload when it belongs to the order this page is for.
  // Otherwise a stale payload (shared device / old bookmark / different ?ref=)
  // could show a previous order's private collection address.
  const matchedOrder =
    order && fallbackRef && order.reference === fallbackRef ? order : null;
  const reference = matchedOrder?.reference ?? fallbackRef;

  return (
    <>
      {reference && (
        <p className="font-body text-sm text-ink-light">
          Your reference is{' '}
          <span className="font-semibold text-ink tabular-nums">{reference}</span>.
        </p>
      )}

      {matchedOrder?.method === 'pickup' && matchedOrder.collection?.address ? (
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
      ) : (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          We&apos;ll be in touch by email shortly to confirm payment and delivery. Keep an eye on
          your inbox.
        </p>
      )}
    </>
  );
}
