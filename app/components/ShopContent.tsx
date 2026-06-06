'use client';

import { useState, useMemo } from 'react';
import { earrings, type EarringType, type Metal, type Colour } from '../data/earrings';
import { FilterBar } from './FilterBar';
import { ProductCard } from './ProductCard';

export function ShopContent() {
  const [selectedType, setSelectedType] = useState<EarringType | 'all'>('all');
  const [selectedMetal, setSelectedMetal] = useState<Metal | 'all'>('all');
  const [selectedColour, setSelectedColour] = useState<Colour | 'all'>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(
    () =>
      earrings.filter((e) => {
        if (selectedType !== 'all' && e.type !== selectedType) return false;
        if (selectedMetal !== 'all' && e.metal !== selectedMetal) return false;
        if (selectedColour !== 'all' && e.colour !== selectedColour) return false;
        return true;
      }),
    [selectedType, selectedMetal, selectedColour],
  );

  const activeFilterCount = [
    selectedType !== 'all',
    selectedMetal !== 'all',
    selectedColour !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Mobile filter toggle bar */}
      <div className="lg:hidden flex items-center justify-between">
        <button
          onClick={() => setMobileFiltersOpen((o) => !o)}
          className="cursor-pointer flex items-center gap-2 bg-cream-dark border border-kraft-light text-ink font-body text-sm font-medium px-4 py-2.5 rounded-full hover:border-kraft transition-colors duration-150"
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

      {/* Filter panel — always visible on desktop, toggled on mobile */}
      {(mobileFiltersOpen || true) && (
        <div className={mobileFiltersOpen ? 'lg:block' : 'hidden lg:block'}>
          <FilterBar
            selectedType={selectedType}
            selectedMetal={selectedMetal}
            selectedColour={selectedColour}
            onTypeChange={setSelectedType}
            onMetalChange={setSelectedMetal}
            onColourChange={setSelectedColour}
            resultCount={filtered.length}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 min-w-0" id="products" aria-label="Product listing">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="font-heading text-5xl font-bold text-kraft-light">No earrings found</p>
            <p className="font-body text-sm text-ink-light">
              Try adjusting your filters to see more results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((earring) => (
              <ProductCard key={earring.id} earring={earring} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
