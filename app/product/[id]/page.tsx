import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { EarringIcon } from '../../components/EarringIcon';
import { earrings } from '../../data/earrings';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return earrings.map((earring) => ({ id: earring.id }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const earring = earrings.find((e) => e.id === id);

  if (!earring) {
    return { title: 'Earring Not Found · BLG Creations' };
  }

  return {
    title: `${earring.name} · BLG Creations`,
    description: earring.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const earring = earrings.find((e) => e.id === id);

  if (!earring) {
    notFound();
  }

  const related = earrings
    .filter((e) => e.id !== earring.id && (e.type === earring.type || e.metal === earring.metal))
    .slice(0, 3);

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
            Back to shop
          </Link>
        </nav>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Image */}
          <div
            className="w-full lg:w-1/2 aspect-square rounded-lg border border-cream-dark flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${earring.accentColor}12` }}
          >
            <EarringIcon color={earring.accentColor} className="w-40 h-60" />
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4 lg:w-1/2">
            <div className="flex items-center gap-2">
              <span className="bg-cream-dark text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded capitalize border border-kraft-light">
                {earring.type}
              </span>
              <span className="bg-cream-dark text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded capitalize border border-kraft-light">
                {earring.metal}
              </span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink leading-tight">
              {earring.name}
            </h1>

            <p className="font-body text-2xl font-semibold text-kraft-dark tabular-nums">
              ${earring.price.toFixed(2)}
            </p>

            <p className="font-body text-base text-ink-light leading-relaxed max-w-prose">
              {earring.description}
            </p>

            <dl className="font-body text-sm text-ink-light grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mt-2">
              <dt className="font-medium text-ink">Type</dt>
              <dd className="capitalize">{earring.type}</dd>
              <dt className="font-medium text-ink">Metal</dt>
              <dd className="capitalize">{earring.metal}</dd>
              <dt className="font-medium text-ink">Colour</dt>
              <dd className="capitalize">{earring.colour}</dd>
            </dl>

            <div className="flex items-center gap-4 mt-4">
              <button
                className="cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
                aria-label={`Add ${earring.name} to cart`}
              >
                Add to Cart
              </button>
              <p className="font-body text-xs text-ink-light">
                Made to order · Ships within 5–7 business days
              </p>
            </div>
          </div>
        </div>

        {/* Related items */}
        {related.length > 0 && (
          <section className="mt-16" aria-label="Related earrings">
            <h2 className="font-heading text-3xl font-bold text-ink mb-5">You might also like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/product/${item.id}`}
                  className="group flex flex-col bg-white rounded-lg overflow-hidden border border-cream-dark hover:border-kraft transition-all duration-200 hover:shadow-sm"
                >
                  <div
                    className="relative aspect-square w-full overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: `${item.accentColor}12` }}
                  >
                    <div className="transition-transform duration-300 group-hover:scale-105">
                      <EarringIcon color={item.accentColor} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 p-4 border-t border-cream-dark">
                    <h3 className="font-heading text-xl font-bold text-ink leading-tight">
                      {item.name}
                    </h3>
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="mt-auto border-t border-cream-dark py-8 px-4 text-center">
        <p className="font-body text-xs text-ink-light">
          © {new Date().getFullYear()} BLG Creations · All rights reserved · Made with love
        </p>
      </footer>
    </>
  );
}
