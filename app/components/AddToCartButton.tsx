'use client';

import type { Product } from '../data/types';
import { useCart } from './CartProvider';

interface AddToCartButtonProps {
  product: Product;
  size?: 'sm' | 'lg';
  className?: string;
}

export function AddToCartButton({ product, size = 'sm', className = '' }: AddToCartButtonProps) {
  const { addItem, openCart, items } = useCart();
  const inCart = items.some((i) => i.id === product.id);
  const sizing = size === 'lg' ? 'text-sm px-6 py-3' : 'text-sm px-4 py-2';

  if (product.soldOut) {
    return (
      <span
        aria-disabled="true"
        className={`inline-flex items-center justify-center font-body font-medium rounded bg-cream-dark text-ink-light cursor-not-allowed ${sizing} ${className}`}
      >
        Sold out
      </span>
    );
  }

  // One-of-a-kind: once the single unit is in the basket there's nothing more to
  // add, so the button turns into a link to the basket rather than adding again.
  if (inCart) {
    return (
      <button
        type="button"
        onClick={openCart}
        aria-label={`${product.name} is in your basket — view basket`}
        className={`cursor-pointer inline-flex items-center justify-center gap-1.5 font-body font-medium rounded border border-kraft-light bg-cream-dark text-ink-light hover:border-kraft hover:text-kraft transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 ${sizing} ${className}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        In your basket
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        addItem({
          id: product.id,
          name: product.name,
          price: product.price,
          accentColor: product.accentColor,
          categorySlug: product.categorySlug,
          image: product.image,
        })
      }
      aria-label={`Add ${product.name} to basket`}
      className={`cursor-pointer inline-flex items-center justify-center gap-1.5 font-body font-medium rounded bg-kraft text-cream hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 ${sizing} ${className}`}
    >
      Add to Basket
    </button>
  );
}
