'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from './CartProvider';

export function Header() {
  const { totalCount, openCart } = useCart();

  return (
    <>
      {/* Skip to products — accessibility */}
      <a
        href="#products"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-kraft focus:text-cream focus:px-4 focus:py-2 focus:rounded-lg focus:font-body focus:text-sm"
      >
        Skip to products
      </a>

      <header className="sticky top-0 z-50 bg-cream border-b border-kraft-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-32 sm:h-36">
            <Link
              href="/"
              className="flex items-center hover:opacity-80 transition-opacity duration-200"
              aria-label="BLG Creations — home"
            >
              <Image
                src="/logo/BLG_Creations_logo_cropped.svg"
                alt="BLG Creations — handmade jewellery & gifts"
                width={813}
                height={438}
                priority
                className="h-24 sm:h-28 w-auto object-contain"
              />
            </Link>

            {/* Cart */}
            <button
              onClick={openCart}
              className="relative cursor-pointer text-ink hover:text-kraft transition-colors duration-200 p-2 rounded hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-kraft"
              aria-label={`Shopping cart, ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                />
              </svg>
              {totalCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-kraft text-cream text-xs rounded-full h-4 w-4 flex items-center justify-center font-body font-semibold leading-none tabular-nums">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
