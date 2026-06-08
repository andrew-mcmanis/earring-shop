import Link from 'next/link';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

export default function NotFound() {
  return (
    <>
      <Header />

      <div className="flex flex-col items-center justify-center text-center gap-4 py-32 px-4">
        <p className="font-heading text-7xl font-bold text-kraft-light">404</p>
        <h1 className="font-heading text-3xl font-bold text-ink">Page not found</h1>
        <p className="font-body text-sm text-ink-light max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <Link
          href="/"
          className="mt-2 cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Back to shop
        </Link>
      </div>

      <Footer />
    </>
  );
}
