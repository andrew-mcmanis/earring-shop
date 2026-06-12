'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useCart } from './CartProvider';
import { ProductIcon } from './ProductIcon';
import { ProductImage } from './ProductImage';

export function CartDrawer() {
  const { items, isOpen, closeCart, setQty, removeItem, clear, totalCount, totalPrice } = useCart();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // While open: focus the close button, close on Escape, and lock body scroll.
  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeCart]);

  return (
    <div className={`fixed inset-0 z-[100] ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* Scrim */}
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-ink/50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-cream shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-dark flex-shrink-0">
          <h2 className="font-heading text-3xl font-bold text-ink">
            Your Cart{totalCount > 0 ? ` (${totalCount})` : ''}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={closeCart}
            aria-label="Close cart"
            className="cursor-pointer text-ink hover:text-kraft transition-colors duration-200 p-2 rounded hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-kraft"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
            <ProductIcon color="#D4B896" className="w-14 h-20" />
            <p className="font-heading text-3xl font-bold text-kraft-light">Your cart is empty</p>
            <p className="font-body text-sm text-ink-light max-w-xs">
              Browse the collection and add something you love — it&apos;ll show up here.
            </p>
            <button
              onClick={closeCart}
              className="mt-2 cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
            >
              Start shopping
            </button>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-cream-dark px-5">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-4">
                <div
                  className="relative overflow-hidden w-16 h-16 rounded border border-cream-dark flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.accentColor}12` }}
                >
                  <ProductImage
                    image={item.image}
                    accentColor={item.accentColor}
                    category={item.categorySlug}
                    alt={item.name}
                    sizes="64px"
                    iconClassName="w-7 h-10"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-xl font-bold text-ink leading-tight">
                      {item.name}
                    </h3>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="cursor-pointer text-ink-light hover:text-kraft transition-colors duration-150 w-11 h-11 -m-3 flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-kraft flex-shrink-0"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    {/* Quantity stepper */}
                    <div className="inline-flex items-center border border-kraft-light rounded">
                      <button
                        onClick={() => setQty(item.id, item.qty - 1)}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="cursor-pointer w-10 h-10 flex items-center justify-center text-ink hover:bg-cream-dark transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft rounded-l"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" d="M5 12h14" />
                        </svg>
                      </button>
                      <span className="w-10 text-center font-body text-sm font-medium text-ink tabular-nums" aria-live="polite">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => setQty(item.id, item.qty + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="cursor-pointer w-10 h-10 flex items-center justify-center text-ink hover:bg-cream-dark transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft rounded-r"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>

                    <span className="font-body text-sm font-semibold text-ink tabular-nums">
                      £{(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-cream-dark px-5 py-4 flex flex-col gap-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-ink-light">Subtotal</span>
              <span className="font-body text-xl font-semibold text-ink tabular-nums">
                £{totalPrice.toFixed(2)}
              </span>
            </div>
            <p className="font-body text-xs text-ink-light">
              Shipping is arranged after checkout.
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="text-center cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-5 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
            >
              Checkout
            </Link>
            <button
              onClick={clear}
              className="cursor-pointer font-body text-xs text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150 self-center"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
