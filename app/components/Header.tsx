'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from './CartProvider';

const NAV_LINKS = [
  { href: '/', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalCount, openCart } = useCart();

  return (
    <>
      {/* Skip to main content — accessibility */}
      <a
        href="#products"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-kraft focus:text-cream focus:px-4 focus:py-2 focus:rounded-lg focus:font-body focus:text-sm"
      >
        Skip to products
      </a>

      <header className="sticky top-0 z-50 bg-cream border-b border-kraft-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <Link
              href="/"
              className="flex items-center hover:opacity-80 transition-opacity duration-200"
            >
              <Image
                src="/logo/BLG_Creations_logo_clean.svg"
                alt="BLG Creations"
                width={160}
                height={160}
                priority
                className="object-contain"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`font-body text-sm font-medium transition-colors duration-200 relative ${
                      isActive
                        ? 'text-kraft after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[2px] after:bg-kraft after:rounded-full'
                        : 'text-ink hover:text-kraft'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
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

              {/* Mobile hamburger */}
              <button
                className="md:hidden cursor-pointer text-ink hover:text-kraft transition-colors duration-200 p-2 rounded hover:bg-cream-dark"
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="md:hidden border-t border-cream-dark bg-cream pb-4 px-4"
          >
            <nav aria-label="Mobile navigation">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`block py-3 font-body text-base font-medium border-b border-cream-dark last:border-0 transition-colors duration-200 ${
                      isActive ? 'text-kraft' : 'text-ink hover:text-kraft'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
