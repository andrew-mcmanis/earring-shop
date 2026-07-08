import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export const metadata: Metadata = {
  title: 'Order received',
  robots: { index: false, follow: false },
};

interface SuccessPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { ref } = await searchParams;

  return (
    <>
      <Header />

      <div className="flex flex-col items-center justify-center text-center gap-5 py-24 px-4">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-kraft/15 text-kraft" aria-hidden="true">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink">Thank you — order received!</h1>

        {ref && (
          <p className="font-body text-sm text-ink-light">
            Your reference is{' '}
            <span className="font-semibold text-ink tabular-nums">{ref}</span>.
          </p>
        )}

        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          We&apos;ll be in touch by email shortly to confirm payment and delivery. Keep an eye
          on your inbox.
        </p>

        <Link
          href="/"
          className="mt-2 bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Back to shop
        </Link>
      </div>

      <Footer />
    </>
  );
}
