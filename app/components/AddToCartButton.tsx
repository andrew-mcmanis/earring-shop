'use client';

import { useEffect, useRef, useState } from 'react';
import type { Product } from '../data/types';
import { useCart } from './CartProvider';

interface AddToCartButtonProps {
  product: Product;
  size?: 'sm' | 'lg';
  className?: string;
}

export function AddToCartButton({ product, size = 'sm', className = '' }: AddToCartButtonProps) {
  const { addItem, openCart } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleAdd() {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      accentColor: product.accentColor,
      categorySlug: product.categorySlug,
      image: product.image,
    });
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  }

  const sizing = size === 'lg' ? 'text-sm px-6 py-3' : 'text-sm px-4 py-2';

  return (
    <button
      type="button"
      onClick={handleAdd}
      onDoubleClick={openCart}
      aria-label={`Add ${product.name} to cart`}
      className={`cursor-pointer inline-flex items-center justify-center gap-1.5 font-body font-medium rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 ${sizing} ${
        added ? 'bg-kraft-dark text-cream' : 'bg-kraft text-cream hover:bg-kraft-dark'
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1.5" aria-live="polite">
        {added && (
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
        )}
        {added ? 'Added' : 'Add to Cart'}
      </span>
    </button>
  );
}
