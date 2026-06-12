import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminHeader } from '../../../AdminHeader';
import { getCategories, getSubcategories, getColours } from '../../../../data/products';
import { adminGetProduct } from '../../queries';
import { ProductForm } from '../../ProductForm';
import { updateProduct } from '../../actions';

export const metadata = { title: 'Edit product · Admin' };

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditPageProps) {
  const { id } = await params;
  const [product, categories, subcategories, colours] = await Promise.all([
    adminGetProduct(id),
    getCategories(),
    getSubcategories(),
    getColours(),
  ]);

  if (!product) notFound();

  // Bind the product id so the form's action stays (prevState, formData).
  const action = updateProduct.bind(null, id);

  return (
    <div className="min-h-dvh bg-cream">
      <AdminHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/admin/products"
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5 mb-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Products
        </Link>
        <h1 className="font-heading text-4xl font-bold text-ink mb-6">Edit product</h1>

        <ProductForm
          action={action}
          categories={categories}
          subcategories={subcategories}
          colours={colours}
          product={product}
          submitLabel="Save changes"
        />
      </main>
    </div>
  );
}
