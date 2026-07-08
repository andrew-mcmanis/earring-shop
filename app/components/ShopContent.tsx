'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const revealObserver = useRef<IntersectionObserver | null>(null);
  const pendingCards = useRef<Set<HTMLElement>>(new Set());

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
        if (inStockOnly && p.soldOut) return false;
        return true;
      }),
    [products, selectedCategory, selectedSubcategory, selectedColour, inStockOnly],
  );

  // Category is chosen via the tabs above the grid, so the refine panel only
  // counts subcategory + colour.
  const activeFilterCount = [
    selectedSubcategory !== 'all',
    selectedColour !== 'all',
    inStockOnly,
  ].filter(Boolean).length;

  function badgeFor(p: Product): string {
    if (p.subcategorySlug) return subcategoryNameBySlug.get(p.subcategorySlug) ?? p.subcategorySlug;
    return categoryNameBySlug.get(p.categorySlug) ?? p.categorySlug;
  }

  // Reveal below-fold cards the first time they scroll into view — extends the
  // page-load rise-in. Runs once per mount: cards rendered later (filtering)
  // are never marked pending, and reduced-motion users skip it entirely.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = Array.from(grid.children) as HTMLElement[];
    const below = cards.filter(
      (c) => c.getBoundingClientRect().top > window.innerHeight,
    );
    if (below.length === 0) return;

    below.forEach((c) => c.classList.add('card-pending'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = (Array.prototype.indexOf.call(grid.children, el) % 3) * 60;
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('card-in');
          el.classList.remove('card-pending');
          io.unobserve(el);
          pendingCards.current.delete(el);
          // Once the rise-in has played, drop the reveal styles so the card's
          // normal Tailwind transitions (hover border/shadow) take back over —
          // `.card-in`'s transition list would otherwise override them forever.
          setTimeout(() => {
            el.classList.remove('card-in');
            el.style.transitionDelay = '';
          }, 700 + delay);
        }
      },
      { rootMargin: '0px 0px -5% 0px' },
    );
    below.forEach((c) => io.observe(c));
    revealObserver.current = io;
    pendingCards.current = new Set(below);
    return () => {
      io.disconnect();
      below.forEach((c) => c.classList.remove('card-pending'));
      revealObserver.current = null;
      pendingCards.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cards filtered out before they ever revealed unmount without unobserve —
  // release them so the observer doesn't hold detached nodes.
  useEffect(() => {
    const io = revealObserver.current;
    if (!io) return;
    for (const el of pendingCards.current) {
      if (!document.contains(el)) {
        io.unobserve(el);
        pendingCards.current.delete(el);
      }
    }
  }, [filtered]);

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
        className="flex flex-wrap gap-2 reveal"
        style={{ animationDelay: '0.1s' }}
        role="group"
        aria-label="Browse by category"
      >
        <button
          onClick={() => selectCategory('all')}
          aria-pressed={selectedCategory === 'all'}
          className={tabClass(selectedCategory === 'all')}
        >
          All
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
      <div className="lg:hidden flex items-center justify-between reveal" style={{ animationDelay: '0.15s' }}>
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

      <div className="flex flex-col lg:flex-row gap-8 reveal" style={{ animationDelay: '0.2s' }}>
      {/* Refine panel — always visible on desktop, toggled on mobile */}
      <div className={mobileFiltersOpen ? 'lg:block' : 'hidden lg:block'}>
        <FilterBar
          subcategories={subcategories}
          colours={colours}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          selectedColour={selectedColour}
          inStockOnly={inStockOnly}
          activeFilterCount={activeFilterCount}
          onSubcategoryChange={setSelectedSubcategory}
          onColourChange={setSelectedColour}
          onInStockOnlyChange={setInStockOnly}
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
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                badge={badgeFor(product)}
                colour={product.colourSlug ? colourBySlug.get(product.colourSlug) : undefined}
                priority={index < 3}
              />
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
