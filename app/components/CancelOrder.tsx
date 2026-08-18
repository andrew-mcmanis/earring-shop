'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';

/**
 * An obvious escape hatch on the checkout. On confirmation it empties the basket
 * and returns to the shop. It's deliberately secondary to the primary CTA — it
 * must be easy to find, not compete with "Continue to payment" / "Pay now".
 *
 * Confirmation is inline: no native confirm(), no modal. The trigger expands in
 * place into an alert + two choices, and focus moves to the safe "keep shopping"
 * option so a keyboard / screen-reader user never lands on the destructive
 * default. The destructive choice is the visually quieter of the two.
 *
 * `disabled` lets the caller lock the trigger while a submit is mid-flight
 * (placing the order, or a payment being processed).
 */
export function CancelOrder({ disabled = false }: { disabled?: boolean }) {
  const { clear } = useCart();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  // Move focus to the safe option when the confirmation appears.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (confirming) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-kraft-light bg-cream-dark px-3 py-2"
      >
        <span className="font-body text-xs text-ink">
          This will empty your basket and cancel your order.
        </span>
        <div className="flex items-center gap-3">
          {/* Destructive action, kept visually quieter than the safe one. */}
          <button
            type="button"
            onClick={() => {
              clear();
              router.push('/');
            }}
            className="cursor-pointer font-body text-xs font-semibold text-red-700 underline underline-offset-2 rounded-sm px-1 py-1 transition-colors duration-150 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Yes, cancel order
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={() => setConfirming(false)}
            className="cursor-pointer font-body text-xs font-semibold text-cream bg-kraft rounded px-3 py-1.5 transition-colors duration-150 hover:bg-kraft-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-1"
          >
            No, keep shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={disabled}
      className="cursor-pointer font-body text-sm font-medium text-ink-light border border-kraft-light rounded px-4 py-2.5 transition-colors duration-150 hover:text-kraft hover:border-kraft focus:outline-none focus:ring-2 focus:ring-kraft disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Cancel order
    </button>
  );
}
