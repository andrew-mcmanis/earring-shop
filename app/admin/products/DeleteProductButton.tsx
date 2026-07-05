'use client';

import { useState, useTransition } from 'react';
import { deleteProduct } from './actions';

// Two-step inline confirm (no native dialog) — on-brand and accessible.
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer font-body text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded px-1"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-body text-xs text-ink-light">Delete “{name}”?</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await deleteProduct(id);
            if (res?.error) setError(res.error);
          })
        }
        className="cursor-pointer font-body text-xs font-semibold text-cream bg-red-600 px-2.5 py-1 rounded hover:bg-red-700 transition-colors duration-150 disabled:opacity-60"
      >
        {isPending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        className="cursor-pointer font-body text-xs text-ink-light hover:text-ink transition-colors duration-150"
      >
        Cancel
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
