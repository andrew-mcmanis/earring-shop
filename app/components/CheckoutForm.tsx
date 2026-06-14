'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useCart } from './CartProvider';
import { ProductIcon } from './ProductIcon';
import { ProductImage } from './ProductImage';
import { placeOrder, type PlaceOrderState } from '../lib/orders';

const initialState: PlaceOrderState = { status: 'idle' };

function Field({
  id,
  label,
  type = 'text',
  required = false,
  autoComplete,
  error,
  className = '',
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-body text-sm font-medium text-ink">
        {label}
        {required && <span className="text-kraft-dark"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`font-body text-sm text-ink bg-white border rounded px-3 py-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft ${
          error ? 'border-red-500' : 'border-kraft-light focus:border-kraft'
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="font-body text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm() {
  const { items, totalPrice, totalCount, clear, unavailableIds, refreshAvailability } = useCart();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(placeOrder, initialState);

  // On success, clear the cart and move to the confirmation page.
  useEffect(() => {
    if (state.status === 'success') {
      clear();
      const q = state.reference ? `?ref=${encodeURIComponent(state.reference)}` : '';
      router.push(`/checkout/success${q}`);
    }
  }, [state, clear, router]);

  // Re-check availability when the checkout loads and whenever the cart changes.
  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const hasUnavailable = items.some((i) => unavailableIds.has(i.id));

  if (state.status === 'success') {
    return (
      <p className="font-body text-sm text-ink-light py-20 text-center">Placing your order…</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-20">
        <ProductIcon color="#D4B896" className="w-14 h-20" />
        <h2 className="font-heading text-3xl font-bold text-kraft-light">Your cart is empty</h2>
        <p className="font-body text-sm text-ink-light max-w-xs">
          Add something you love, then come back to check out.
        </p>
        <Link
          href="/"
          className="mt-2 bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      {/* Details form */}
      <form action={formAction} className="flex-1 flex flex-col gap-5" noValidate>
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(items.map((i) => ({ id: i.id, qty: i.qty })))}
        />

        {state.status === 'error' && state.message && (
          <div
            role="alert"
            className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3"
          >
            {state.message}
          </div>
        )}

        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="font-heading text-2xl font-bold text-ink mb-1">Your details</legend>
          <Field id="name" label="Full name" required autoComplete="name" error={state.fieldErrors?.name} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="email" label="Email" type="email" required autoComplete="email" error={state.fieldErrors?.email} />
            <Field id="phone" label="Phone" type="tel" autoComplete="tel" />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="font-heading text-2xl font-bold text-ink mb-1">Delivery</legend>
          <Field id="address" label="Address" required autoComplete="street-address" error={state.fieldErrors?.address} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="city" label="Town / City" autoComplete="address-level2" />
            <Field id="postcode" label="Postcode" autoComplete="postal-code" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="font-body text-sm font-medium text-ink">
              Order notes <span className="text-ink-light font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything we should know — colour preferences, gift message, etc."
              className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft resize-y"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={isPending || hasUnavailable}
          className="bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed self-start"
        >
          {isPending ? 'Placing order…' : hasUnavailable ? 'Remove sold-out items to continue' : 'Place order'}
        </button>
        <p className="font-body text-xs text-ink-light">
          We&apos;ll email you to confirm payment and delivery — no
          payment is taken on this page.
        </p>
      </form>

      {/* Order summary */}
      <aside className="lg:w-80 flex-shrink-0" aria-label="Order summary">
        <div className="bg-cream-dark rounded-lg p-5 flex flex-col gap-4 lg:sticky lg:top-32">
          <h2 className="font-heading text-2xl font-bold text-ink">
            Order summary{totalCount > 0 ? ` (${totalCount})` : ''}
          </h2>
          <ul className="flex flex-col divide-y divide-kraft-light/50">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
                <div
                  className="relative overflow-hidden w-12 h-12 rounded border border-kraft-light flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.accentColor}12` }}
                >
                  <ProductImage
                    image={item.image}
                    accentColor={item.accentColor}
                    category={item.categorySlug}
                    alt={item.name}
                    sizes="48px"
                    iconClassName="w-5 h-7"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-ink leading-tight">{item.name}</p>
                  <p className="font-body text-xs text-ink-light">Qty {item.qty}</p>
                  {unavailableIds.has(item.id) && (
                    <p className="font-body text-xs text-ink" role="alert">
                      Sold out — remove to continue.
                    </p>
                  )}
                </div>
                <span className="font-body text-sm font-semibold text-ink tabular-nums">
                  £{(item.price * item.qty).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-kraft-light pt-3">
            <span className="font-body text-sm text-ink-light">Subtotal</span>
            <span className="font-body text-xl font-semibold text-ink tabular-nums">
              £{totalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
