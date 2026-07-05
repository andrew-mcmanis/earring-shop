'use client';

import { useState, useTransition } from 'react';
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
  // Controlled so a failed save can revert the visible selection — an
  // uncontrolled select would keep showing the unsaved status.
  const [value, setValue] = useState<OrderStatus>(status);
  const [error, setError] = useState<string | null>(null);

  function change(next: OrderStatus) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatus(id, next);
      if (res?.error) {
        setValue(previous);
        setError(res.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex items-center gap-2">
        <span className="font-body text-xs font-medium text-ink-light">Status</span>
        <select
          value={value}
          disabled={pending}
          onChange={(e) => change(e.target.value as OrderStatus)}
          className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft disabled:opacity-60"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
