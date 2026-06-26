import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ShopContent } from './components/ShopContent';
import { getProducts, getCategories, getSubcategories, getColours } from './data/products';

// Four-point twinkle, echoing the sparkle marks in the BLG Creations logo.
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0 Q13 11 24 12 Q13 13 12 24 Q11 13 0 12 Q11 11 12 0 Z" />
    </svg>
  );
}

export default async function Home() {
  const [products, categories, subcategories, colours] = await Promise.all([
    getProducts(),
    getCategories(),
    getSubcategories(),
    getColours(),
  ]);

  return (
    <>
      <Header />

      <section className="surface-ink text-cream overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 reveal">
          {/* Sparkle accents — echo the twinkles in the logo */}
          <Sparkle className="pointer-events-none absolute top-6 left-3 sm:left-8 w-4 sm:w-5 text-kraft/70 rotate-12" />
          <Sparkle className="pointer-events-none absolute top-12 right-8 sm:right-16 w-7 sm:w-10 text-kraft-light/55 -rotate-6" />
          <Sparkle className="pointer-events-none absolute bottom-8 right-1/3 w-3 sm:w-4 text-kraft/50 rotate-6" />

          <h1 className="font-heading text-6xl sm:text-7xl lg:text-8xl font-bold leading-[0.95] max-w-3xl">
            Every piece<br />made by hand
          </h1>
          <p className="font-body text-base sm:text-lg text-kraft-light mt-5 max-w-md leading-relaxed">
            Earrings, bookmarks and gifts, ready to wrap and post.
          </p>
        </div>
      </section>

      <ShopContent
        products={products}
        categories={categories}
        subcategories={subcategories}
        colours={colours}
      />

      <Footer />
    </>
  );
}
