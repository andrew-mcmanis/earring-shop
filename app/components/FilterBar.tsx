'use client';

import type { Category, Subcategory, Colour } from '../data/types';

interface FilterBarProps {
  categories: Category[];
  subcategories: Subcategory[];
  colours: Colour[];
  selectedCategory: string | 'all';
  selectedSubcategory: string | 'all';
  selectedColour: string | 'all';
  onCategoryChange: (slug: string | 'all') => void;
  onSubcategoryChange: (slug: string | 'all') => void;
  onColourChange: (slug: string | 'all') => void;
  resultCount: number;
  onMobileClose?: () => void;
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="font-body text-xs font-semibold text-ink-light uppercase tracking-widest">
        {label}
      </h3>
      {children}
    </div>
  );
}

export function FilterBar({
  categories,
  subcategories,
  colours,
  selectedCategory,
  selectedSubcategory,
  selectedColour,
  onCategoryChange,
  onSubcategoryChange,
  onColourChange,
  resultCount,
  onMobileClose,
}: FilterBarProps) {
  const hasActiveFilters =
    selectedCategory !== 'all' || selectedSubcategory !== 'all' || selectedColour !== 'all';

  // Subcategories only apply to Earrings — show them only when that's selected.
  const showSubcategories = selectedCategory === 'earrings';
  const earringSubs = subcategories.filter((s) => s.categorySlug === 'earrings');

  function clearAll() {
    onCategoryChange('all');
    onSubcategoryChange('all');
    onColourChange('all');
  }

  return (
    <aside className="w-full lg:w-52 flex-shrink-0" aria-label="Product filters">
      <div className="bg-cream-dark rounded-lg p-5 flex flex-col gap-6 lg:sticky lg:top-32">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-ink">Filter</h2>
          <div className="flex items-center gap-3">
            <span className="font-body text-xs text-ink-light tabular-nums">
              {resultCount} {resultCount === 1 ? 'item' : 'items'}
            </span>
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden cursor-pointer font-body text-xs font-semibold text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark transition-colors duration-150"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* Category */}
        <FilterSection label="Category">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                onCategoryChange('all');
                onSubcategoryChange('all');
              }}
              aria-pressed={selectedCategory === 'all'}
              className={`cursor-pointer text-left font-body text-sm px-3 py-2 rounded transition-colors duration-150 ${
                selectedCategory === 'all'
                  ? 'bg-kraft text-cream font-semibold'
                  : 'text-ink hover:bg-kraft-light/40'
              }`}
            >
              All Products
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => {
                  onCategoryChange(c.slug);
                  onSubcategoryChange('all');
                }}
                aria-pressed={selectedCategory === c.slug}
                className={`cursor-pointer text-left font-body text-sm px-3 py-2 rounded transition-colors duration-150 ${
                  selectedCategory === c.slug
                    ? 'bg-kraft text-cream font-semibold'
                    : 'text-ink hover:bg-kraft-light/40'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Subcategory — Earrings only */}
        {showSubcategories && (
          <FilterSection label="Earring type">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onSubcategoryChange('all')}
                aria-pressed={selectedSubcategory === 'all'}
                className={`cursor-pointer font-body text-xs px-3 py-1.5 rounded border transition-colors duration-150 ${
                  selectedSubcategory === 'all'
                    ? 'bg-kraft border-kraft text-cream font-semibold'
                    : 'border-kraft-light text-ink hover:border-kraft'
                }`}
              >
                All
              </button>
              {earringSubs.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => onSubcategoryChange(s.slug)}
                  aria-pressed={selectedSubcategory === s.slug}
                  className={`cursor-pointer font-body text-xs px-3 py-1.5 rounded border transition-colors duration-150 ${
                    selectedSubcategory === s.slug
                      ? 'bg-kraft border-kraft text-cream font-semibold'
                      : 'border-kraft-light text-ink hover:border-kraft'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Colour */}
        <FilterSection label="Colour">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => onColourChange('all')}
              aria-pressed={selectedColour === 'all'}
              className={`cursor-pointer font-body text-xs px-3 py-1.5 rounded border transition-colors duration-150 ${
                selectedColour === 'all'
                  ? 'bg-kraft border-kraft text-cream font-semibold'
                  : 'border-kraft-light text-ink hover:border-kraft'
              }`}
            >
              All
            </button>
            {colours.map((c) => {
              const isActive = selectedColour === c.slug;
              return (
                <button
                  key={c.slug}
                  onClick={() => onColourChange(c.slug)}
                  title={c.name}
                  aria-label={`Filter by ${c.name}${isActive ? ' (selected)' : ''}`}
                  aria-pressed={isActive}
                  className="group cursor-pointer w-11 h-11 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
                >
                  <span
                    className={`block w-7 h-7 rounded-full border-2 transition-transform duration-150 group-hover:scale-110 ${
                      isActive
                        ? 'border-kraft ring-2 ring-kraft ring-offset-1 scale-110'
                        : 'border-transparent group-hover:border-kraft-light'
                    }`}
                    style={
                      c.slug === 'multicolour'
                        ? {
                            background:
                              'conic-gradient(#C0392B 0deg, #9B59B6 90deg, #2E6DA4 180deg, #27AE60 270deg, #C0392B 360deg)',
                          }
                        : { backgroundColor: c.hex }
                    }
                  />
                </button>
              );
            })}
          </div>
        </FilterSection>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="cursor-pointer font-body text-xs text-kraft-dark underline underline-offset-2 hover:text-kraft transition-colors duration-150 self-start"
          >
            Clear all filters
          </button>
        )}
      </div>
    </aside>
  );
}
