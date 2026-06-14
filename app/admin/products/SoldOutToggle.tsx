'use client';

import { useTransition } from 'react';
import { toggleSoldOut } from './actions';

export function SoldOutToggle({ id, soldOut }: { id: string; soldOut: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleSoldOut(id, !soldOut))}
      aria-pressed={soldOut}
      aria-label={soldOut ? 'Sold out — click to mark in stock' : 'In stock — click to mark sold out'}
      className={`cursor-pointer inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
        soldOut
          ? 'border-ink/30 bg-ink/5 text-ink hover:border-ink/50'
          : 'border-kraft-light text-ink-light hover:border-kraft'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${soldOut ? 'bg-ink' : 'bg-green-600'}`}
        aria-hidden="true"
      />
      {soldOut ? 'Sold out' : 'In stock'}
    </button>
  );
}
