import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { CheckoutForm } from '../components/CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout · BLG Creations',
};

export default function CheckoutPage() {
  return (
    <>
      <Header />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/"
            className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Continue shopping
          </Link>
        </nav>

        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink mb-8">Checkout</h1>

        <CheckoutForm />
      </div>

      <footer className="mt-auto border-t border-cream-dark py-8 px-4 text-center">
        <p className="font-body text-xs text-ink-light">
          © {new Date().getFullYear()} BLG Creations · All rights reserved · Made with love
        </p>
      </footer>
    </>
  );
}
