import { Header } from './components/Header';
import { Footer } from './components/Footer';
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

      <section className="surface-ink text-cream py-16 px-4 text-center">
        <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 leading-[1.05]">
          Every piece
          <br className="sm:hidden" /> made by hand
        </h1>
        <p className="font-body text-base text-kraft-light max-w-md mx-auto leading-relaxed">
          Earrings, bookmarks and gifts, ready to wrap and post.
        </p>
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
