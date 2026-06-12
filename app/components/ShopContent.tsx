'use client';

import { useMemo, useState } from 'react';
import type { Category, Subcategory, Colour, Product } from '../data/types';
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';

interface ShopContentProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  colours: Colour[];
}

export function ShopContent({ products, categories, subcategories, colours }: ShopContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>('all');
  const [selectedColour, setSelectedColour] = useState<string | 'all'>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const colourBySlug = useMemo(() => new Map(colours.map((c) => [c.slug, c])), [colours]);
  const subcategoryNameBySlug = useMemo(
    () => new Map(subcategories.map((s) => [s.slug, s.name])),
    [subcategories],
  );
  const categoryNameBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) return false;
        if (selectedSubcategory !== 'all' && p.subcategorySlug !== selectedSubcategory) return false;
        if (selectedColour !== 'all' && p.colourSlug !== selectedColour) return false;
        return true;
      }),
    [products, selectedCategory, selectedSubcategory, selectedColour],
  );

  // Category is chosen via the tabs above the grid, so the refine panel only
  // counts subcategory + colour.
  const activeFilterCount = [
    selectedSubcategory !== 'all',
    selectedColour !== 'all',
  ].filter(Boolean).length;

  function badgeFor(p: Product): string {
    if (p.subcategorySlug) return subcategoryNameBySlug.get(p.subcategorySlug) ?? p.subcategorySlug;
    return categoryNameBySlug.get(p.categorySlug) ?? p.categorySlug;
  }

  function selectCategory(slug: string | 'all') {
    setSelectedCategory(slug);
    setSelectedSubcategory('all');
  }

  const tabClass = (active: boolean) =>
    `cursor-pointer whitespace-nowrap font-body text-sm font-medium px-4 py-2.5 rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
      active
        ? 'bg-kraft border-kraft text-cream font-semibold'
        : 'bg-cream-dark border-kraft-light text-ink hover:border-kraft'
    }`;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Category tabs — the primary way to browse */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mb-1"
        role="group"
        aria-label="Browse by category"
      >
        <button
          onClick={() => selectCategory('all')}
          aria-pressed={selectedCategory === 'all'}
          className={tabClass(selectedCategory === 'all')}
        >
          All Products
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            onClick={() => selectCategory(c.slug)}
            aria-pressed={selectedCategory === c.slug}
            className={tabClass(selectedCategory === c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Mobile refine toggle bar */}
      <div className="lg:hidden flex items-center justify-between">
        <button
          onClick={() => setMobileFiltersOpen((o) => !o)}
          className="cursor-pointer flex items-center gap-2 bg-cream-dark border border-kraft-light text-ink font-body text-sm font-medium px-4 py-2.5 rounded hover:border-kraft transition-colors duration-150"
          aria-expanded={mobileFiltersOpen}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-kraft text-cream text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        <span className="font-body text-sm text-ink-light tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
      {/* Refine panel — always visible on desktop, toggled on mobile */}
      <div className={mobileFiltersOpen ? 'lg:block' : 'hidden lg:block'}>
        <FilterBar
          subcategories={subcategories}
          colours={colours}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          selectedColour={selectedColour}
          onSubcategoryChange={setSelectedSubcategory}
          onColourChange={setSelectedColour}
          resultCount={filtered.length}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />
      </div>

      <main className="flex-1 min-w-0" id="products" aria-label="Product listing">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="font-heading text-5xl font-bold text-kraft-light">Nothing here yet</p>
            <p className="font-body text-sm text-ink-light">
              Try adjusting your filters to see more results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                badge={badgeFor(product)}
                colour={product.colourSlug ? colourBySlug.get(product.colourSlug) : undefined}
              />
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
