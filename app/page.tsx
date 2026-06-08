import { Header } from './components/Header';
import { ShopContent } from './components/ShopContent';
import { getProducts, getCategories, getSubcategories, getColours } from './data/products';

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

      <section className="bg-ink text-cream py-16 px-4 text-center">
        <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 leading-[1.05]">
          Handmade with love,
          <br className="hidden sm:block" /> made just for you
        </h1>
        <p className="font-body text-base text-kraft-light max-w-md mx-auto leading-relaxed">
          Earrings, bookmarks and little gifts — each one crafted to order, so no two are
          ever quite the same.
        </p>
      </section>

      <ShopContent
        products={products}
        categories={categories}
        subcategories={subcategories}
        colours={colours}
      />

      <footer className="mt-auto border-t border-cream-dark py-8 px-4 text-center">
        <p className="font-body text-xs text-ink-light">
          © {new Date().getFullYear()} BLG Creations · All rights reserved · Made with love
        </p>
      </footer>
    </>
  );
}
