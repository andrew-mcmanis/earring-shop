import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { ProductIcon } from '../../components/ProductIcon';
import { ProductImage } from '../../components/ProductImage';
import { getCategories, getSubcategories, getColours } from '../../data/products';
import { adminGetProducts } from './queries';
import { DeleteProductButton } from './DeleteProductButton';
import { VisibilityToggle } from './VisibilityToggle';
import { SoldOutToggle } from './SoldOutToggle';

export const metadata = { title: 'Products · Admin' };

export default async function AdminProductsPage() {
  const [products, categories, subcategories, colours] = await Promise.all([
    adminGetProducts(),
    getCategories(),
    getSubcategories(),
    getColours(),
  ]);

  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));
  const subcategoryName = new Map(subcategories.map((s) => [s.slug, s.name]));
  const colourName = new Map(colours.map((c) => [c.slug, c.name]));

  return (
    <div className="min-h-dvh bg-cream">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <Link
              href="/admin"
              className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5 mb-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
            <h1 className="font-heading text-4xl font-bold text-ink">Products</h1>
          </div>
          <Link
            href="/admin/products/new"
            className="cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-4 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 whitespace-nowrap"
          >
            + Add product
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="bg-white border border-cream-dark rounded-lg flex flex-col items-center text-center gap-3 py-16 px-6">
            <ProductIcon color="#D4B896" className="w-12 h-16" />
            <h2 className="font-heading text-2xl font-bold text-kraft-light">No products yet</h2>
            <p className="font-body text-sm text-ink-light max-w-xs">
              Add your first item and it&apos;ll appear in the shop straight away.
            </p>
            <Link
              href="/admin/products/new"
              className="mt-1 cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200"
            >
              + Add product
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((p) => {
              const meta = [
                categoryName.get(p.categorySlug),
                p.subcategorySlug ? subcategoryName.get(p.subcategorySlug) : null,
                p.colourSlug ? colourName.get(p.colourSlug) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={p.id}
                  className="bg-white border border-cream-dark rounded-lg p-3 flex flex-wrap items-center gap-x-4 gap-y-3"
                >
                  <div
                    className="relative overflow-hidden w-14 h-14 rounded border border-cream-dark flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${p.accentColor}12` }}
                  >
                    <ProductImage
                      image={p.image}
                      accentColor={p.accentColor}
                      category={p.categorySlug}
                      alt={p.name}
                      sizes="56px"
                      iconClassName="w-6 h-9"
                    />
                  </div>

                  <div className="flex-1 min-w-[8rem]">
                    <p className="font-heading text-xl font-bold text-ink leading-tight">{p.name}</p>
                    <p className="font-body text-xs text-ink-light capitalize">{meta}</p>
                  </div>

                  <span className="font-body text-sm font-semibold text-ink tabular-nums">
                    £{p.price.toFixed(2)}
                  </span>

                  <VisibilityToggle id={p.id} visible={p.visible} />
                  <SoldOutToggle id={p.id} soldOut={p.soldOut} />

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="font-body text-sm font-medium text-kraft-dark hover:text-kraft transition-colors duration-150"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
