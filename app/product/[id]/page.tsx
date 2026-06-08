import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { ProductImage } from '../../components/ProductImage';
import { AddToCartButton } from '../../components/AddToCartButton';
import {
  getProduct,
  getProducts,
  getCategories,
  getSubcategories,
  getColours,
} from '../../data/products';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return { title: 'Not Found · BLG Creations' };
  }

  return {
    title: `${product.name} · BLG Creations`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const [allProducts, categories, subcategories, colours] = await Promise.all([
    getProducts(),
    getCategories(),
    getSubcategories(),
    getColours(),
  ]);

  const categoryName = categories.find((c) => c.slug === product.categorySlug)?.name;
  const subcategoryName = subcategories.find((s) => s.slug === product.subcategorySlug)?.name;
  const colourName = colours.find((c) => c.slug === product.colourSlug)?.name;

  // Related: same subcategory if it has one, otherwise same category.
  const related = allProducts
    .filter(
      (p) =>
        p.id !== product.id &&
        (product.subcategorySlug
          ? p.subcategorySlug === product.subcategorySlug
          : p.categorySlug === product.categorySlug),
    )
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
            className="relative overflow-hidden w-full lg:w-1/2 aspect-square rounded-lg border border-cream-dark flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${product.accentColor}12` }}
          >
            <ProductImage
              image={product.image}
              accentColor={product.accentColor}
              category={product.categorySlug}
              alt={product.name}
              sizes="(max-width: 1024px) 100vw, 50vw"
              iconClassName="w-40 h-60"
            />
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4 lg:w-1/2">
            <div className="flex items-center gap-2">
              {categoryName && (
                <span className="bg-cream-dark text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded border border-kraft-light">
                  {categoryName}
                </span>
              )}
              {subcategoryName && (
                <span className="bg-cream-dark text-ink-light text-xs font-body font-medium px-2 py-0.5 rounded border border-kraft-light">
                  {subcategoryName}
                </span>
              )}
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink leading-tight">
              {product.name}
            </h1>

            <p className="font-body text-2xl font-semibold text-kraft-dark tabular-nums">
              £{product.price.toFixed(2)}
            </p>

            <p className="font-body text-base text-ink-light leading-relaxed max-w-prose">
              {product.description}
            </p>

            <dl className="font-body text-sm text-ink-light grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mt-2">
              {categoryName && (
                <>
                  <dt className="font-medium text-ink">Category</dt>
                  <dd>{categoryName}</dd>
                </>
              )}
              {subcategoryName && (
                <>
                  <dt className="font-medium text-ink">Type</dt>
                  <dd>{subcategoryName}</dd>
                </>
              )}
              {colourName && (
                <>
                  <dt className="font-medium text-ink">Colour</dt>
                  <dd>{colourName}</dd>
                </>
              )}
            </dl>

            <div className="flex items-center gap-4 mt-4">
              <AddToCartButton product={product} size="lg" />
              <p className="font-body text-xs text-ink-light">
                Made to order · Ships within 5–7 business days
              </p>
            </div>
          </div>
        </div>

        {/* Related items */}
        {related.length > 0 && (
          <section className="mt-16" aria-label="Related products">
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
                    <ProductImage
                      image={item.image}
                      accentColor={item.accentColor}
                      category={item.categorySlug}
                      alt={item.name}
                      sizes="(max-width: 1024px) 50vw, 33vw"
                      iconClassName="w-16 h-24 transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-4 border-t border-cream-dark">
                    <h3 className="font-heading text-xl font-bold text-ink leading-tight">
                      {item.name}
                    </h3>
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">
                      £{item.price.toFixed(2)}
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
