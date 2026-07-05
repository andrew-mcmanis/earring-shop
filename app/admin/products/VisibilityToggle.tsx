'use client';

import { useState, useTransition } from 'react';
import { toggleVisibility } from './actions';

export function VisibilityToggle({ id, visible }: { id: string; visible: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-0.5">
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          setError(null);
          const res = await toggleVisibility(id, !visible);
          if (res?.error) setError(res.error);
        })
      }
      aria-pressed={visible}
      aria-label={visible ? 'Visible in shop — click to hide' : 'Hidden — click to show'}
      className={`cursor-pointer inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
        visible
          ? 'border-kraft-light text-ink-light hover:border-kraft'
          : 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${visible ? 'bg-green-600' : 'bg-amber-500'}`}
        aria-hidden="true"
      />
      {visible ? 'Visible' : 'Hidden'}
    </button>
    {error && (
      <span role="alert" className="font-body text-xs text-red-600">
        {error}
      </span>
    )}
    </span>
  );
}
