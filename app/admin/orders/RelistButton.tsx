'use client';

import { useState, useTransition } from 'react';
import { toggleSoldOut } from '../products/actions';

// On a refunded order, put a returned piece back on sale — an explicit set to
// in-stock (a no-op if it's already listed). Reuses the product stock action,
// which revalidates the storefront. Owner clicks it only if the piece is
// resaleable, so this is never automatic.
export function RelistButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="font-body text-xs text-green-700">&#10003; Relisted</span>;
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await toggleSoldOut(productId, false);
            if (res?.error) setError(res.error);
            else setDone(true);
          })
        }
        className="cursor-pointer font-body text-xs font-medium text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft rounded"
      >
        Relist
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
