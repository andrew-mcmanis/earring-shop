'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import type { Category, Subcategory, Colour, Product } from '../../data/types';
import type { ProductFormState } from './actions';
import { ProductPhotos } from './ProductPhotos';
import type { PhotoItem } from './SortablePhoto';

const initialState: ProductFormState = { status: 'idle' };

interface ProductFormProps {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  categories: Category[];
  subcategories: Subcategory[];
  colours: Colour[];
  product?: Product;
  submitLabel: string;
}

const inputClass =
  'font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft';

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="font-body text-xs text-red-600" role="alert">
      {error}
    </p>
  );
}

export function ProductForm({
  action,
  categories,
  subcategories,
  colours,
  product,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [category, setCategory] = useState(product?.categorySlug ?? '');
  const errs = state.fieldErrors ?? {};

  const photosRef = useRef<PhotoItem[]>([]);
  const handlePhotosChange = useCallback((items: PhotoItem[]) => {
    photosRef.current = items;
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const order: string[] = [];
    let n = 0;
    for (const item of photosRef.current) {
      if (item.kind === 'existing') {
        order.push(item.url);
      } else if (item.file) {
        fd.append('new_image', item.file);
        order.push(`new:${n}`);
        n += 1;
      }
    }
    fd.set('image_order', JSON.stringify(order));
    formAction(fd);
  }

  const showSubcategory = category === 'earrings';
  const earringSubs = subcategories.filter((s) => s.categorySlug === 'earrings');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl" noValidate>
      {state.status === 'error' && state.message && (
        <div
          role="alert"
          className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3"
        >
          {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="font-body text-sm font-medium text-ink">
          Name <span className="text-kraft-dark">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={product?.name}
          aria-invalid={errs.name ? true : undefined}
          className={`${inputClass} ${errs.name ? 'border-red-500' : ''}`}
        />
        <FieldError id="name" error={errs.name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className="font-body text-sm font-medium text-ink">
          Price (£) <span className="text-kraft-dark">*</span>
        </label>
        <input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          required
          defaultValue={product ? product.price.toFixed(2) : ''}
          aria-invalid={errs.price ? true : undefined}
          className={`${inputClass} ${errs.price ? 'border-red-500' : ''} w-40`}
        />
        <FieldError id="price" error={errs.price} />
      </div>

      <ProductPhotos initialUrls={product?.images ?? []} onChange={handlePhotosChange} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category_slug" className="font-body text-sm font-medium text-ink">
          Category <span className="text-kraft-dark">*</span>
        </label>
        <select
          id="category_slug"
          name="category_slug"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-invalid={errs.category_slug ? true : undefined}
          className={`${inputClass} ${errs.category_slug ? 'border-red-500' : ''} w-56`}
        >
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError id="category_slug" error={errs.category_slug} />
      </div>

      {showSubcategory && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subcategory_slug" className="font-body text-sm font-medium text-ink">
            Earring type
          </label>
          <select
            id="subcategory_slug"
            name="subcategory_slug"
            defaultValue={product?.subcategorySlug ?? ''}
            className={`${inputClass} w-56`}
          >
            <option value="">No type</option>
            {earringSubs.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="colour_slug" className="font-body text-sm font-medium text-ink">
          Colour <span className="text-ink-light font-normal">(optional)</span>
        </label>
        <select
          id="colour_slug"
          name="colour_slug"
          defaultValue={product?.colourSlug ?? ''}
          className={`${inputClass} w-56`}
        >
          <option value="">No colour</option>
          {colours.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-body text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={product?.description}
          className={`${inputClass} resize-y`}
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="visible"
          defaultChecked={product ? product.visible : true}
          className="h-4 w-4 accent-kraft cursor-pointer"
        />
        <span className="font-body text-sm text-ink">
          Visible in the shop
          <span className="block text-xs text-ink-light">
            Untick to hide this item from customers while you work on it.
          </span>
        </span>
      </label>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="sold_out"
          defaultChecked={product?.soldOut ?? false}
          className="h-4 w-4 accent-kraft cursor-pointer"
        />
        <span className="font-body text-sm text-ink">
          Sold out
          <span className="block text-xs text-ink-light">
            Keeps it on display but customers can&apos;t order it.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href="/admin/products"
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
