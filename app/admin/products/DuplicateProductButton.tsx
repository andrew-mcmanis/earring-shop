'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { duplicateProduct } from './actions';

// Copies a product (hidden, "(copy)" suffix) and jumps straight to its edit
// page so the owner renames and reviews it before it can appear in the shop.
export function DuplicateProductButton({ id }: { id: string }) {
  const router = useRouter();
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
            const res = await duplicateProduct(id);
            if (res.error) setError(res.error);
            else if (res.id) router.push(`/admin/products/${res.id}/edit`);
          })
        }
        className="cursor-pointer font-body text-sm font-medium text-kraft-dark hover:text-kraft transition-colors duration-150 disabled:opacity-60"
      >
        {isPending ? 'Duplicating…' : 'Duplicate'}
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
