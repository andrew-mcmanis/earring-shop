'use client';

import { useTransition } from 'react';
import { updateOrderStatus } from './actions';
import type { OrderStatus } from '../../data/types';

const OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'made', label: 'Made' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function OrderStatusControl({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-body text-xs font-medium text-ink-light">Status</span>
      <select
        defaultValue={status}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => updateOrderStatus(id, e.target.value as OrderStatus))
        }
        className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
