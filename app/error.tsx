'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] rendering error:', error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center text-center gap-4 px-4 bg-cream">
      <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink">Something went wrong</h1>
      <p className="font-body text-sm text-ink-light max-w-sm leading-relaxed">
        Sorry — something broke on our side. Please try again in a moment.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <button
          onClick={reset}
          className="cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Try again
        </button>
        <Link
          href="/"
          className="font-body text-sm text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150 py-2.5"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}
