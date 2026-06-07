'use client';

import type { EarringType, Metal, Colour } from '../data/earrings';
import { TYPES, METALS, COLOURS } from '../data/earrings';

interface FilterBarProps {
  selectedType: EarringType | 'all';
  selectedMetal: Metal | 'all';
  selectedColour: Colour | 'all';
  onTypeChange: (type: EarringType | 'all') => void;
  onMetalChange: (metal: Metal | 'all') => void;
  onColourChange: (colour: Colour | 'all') => void;
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
  selectedType,
  selectedMetal,
  selectedColour,
  onTypeChange,
  onMetalChange,
  onColourChange,
  resultCount,
  onMobileClose,
}: FilterBarProps) {
  const hasActiveFilters =
    selectedType !== 'all' || selectedMetal !== 'all' || selectedColour !== 'all';

  function clearAll() {
    onTypeChange('all');
    onMetalChange('all');
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

        {/* Type */}
        <FilterSection label="Type">
          <div className="flex flex-col gap-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => onTypeChange(t.value)}
                aria-pressed={selectedType === t.value}
                className={`cursor-pointer text-left font-body text-sm px-3 py-2 rounded transition-colors duration-150 ${
                  selectedType === t.value
                    ? 'bg-kraft text-cream font-semibold'
                    : 'text-ink hover:bg-kraft-light/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Metal */}
        <FilterSection label="Metal">
          <div className="flex flex-wrap gap-2">
            {METALS.map((m) => (
              <button
                key={m.value}
                onClick={() => onMetalChange(m.value)}
                aria-pressed={selectedMetal === m.value}
                className={`cursor-pointer font-body text-xs px-3 py-1.5 rounded border transition-colors duration-150 ${
                  selectedMetal === m.value
                    ? 'bg-kraft border-kraft text-cream font-semibold'
                    : 'border-kraft-light text-ink hover:border-kraft'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Colour */}
        <FilterSection label="Colour">
          <div className="flex flex-wrap gap-2 items-center">
            {COLOURS.map((c) => {
              const isActive = selectedColour === c.value;

              if (c.value === 'all') {
                return (
                  <button
                    key="all"
                    onClick={() => onColourChange('all')}
                    aria-pressed={isActive}
                    className={`cursor-pointer font-body text-xs px-3 py-1.5 rounded border transition-colors duration-150 ${
                      isActive
                        ? 'bg-kraft border-kraft text-cream font-semibold'
                        : 'border-kraft-light text-ink hover:border-kraft'
                    }`}
                  >
                    All
                  </button>
                );
              }

              return (
                <button
                  key={c.value}
                  onClick={() => onColourChange(c.value)}
                  title={c.label}
                  aria-label={`Filter by ${c.label}${isActive ? ' (selected)' : ''}`}
                  aria-pressed={isActive}
                  className={`cursor-pointer w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                    isActive
                      ? 'border-kraft ring-2 ring-kraft ring-offset-1 scale-110'
                      : 'border-transparent hover:border-kraft-light'
                  }`}
                  style={
                    c.value === 'multicolour'
                      ? {
                          background:
                            'conic-gradient(#C0392B 0deg, #9B59B6 90deg, #2E6DA4 180deg, #27AE60 270deg, #C0392B 360deg)',
                        }
                      : { backgroundColor: c.hex }
                  }
                />
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
