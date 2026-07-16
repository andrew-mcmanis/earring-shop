'use client';

import { useState, useTransition } from 'react';
import type { Category } from '../../data/types';
import { setDeliveryCharge, updatePickupDetails } from './actions';
import type { PickupDetails } from './queries';

const inputClass =
  'font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft';
const primaryBtn =
  'cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-4 py-2 rounded hover:bg-kraft-dark transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60';

function RateRow({ category }: { category: Category }) {
  const [value, setValue] = useState(category.deliveryCharge.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setDeliveryCharge(category.slug, Number(value));
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        setValue(Number(value).toFixed(2));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-cream-dark last:border-0">
      <span className="font-body text-sm font-medium text-ink flex-1 min-w-[8rem]">{category.name}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-body text-sm text-ink-light">£</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className={`${inputClass} w-24`}
          aria-label={`Delivery charge for ${category.name}`}
        />
      </div>
      <button type="button" onClick={save} disabled={isPending} className={primaryBtn}>
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {saved && <span className="font-body text-xs text-green-700">Saved</span>}
      {error && (
        <span role="alert" className="font-body text-xs text-red-600 w-full">
          {error}
        </span>
      )}
    </div>
  );
}

function PickupCard({ pickup }: { pickup: PickupDetails }) {
  const [address, setAddress] = useState(pickup.address);
  const [note, setNote] = useState(pickup.note);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updatePickupDetails(address, note);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-sm text-ink-light">
        Shown to a customer <strong>only after</strong> they place a collection order — on their
        confirmation and (later) in the confirmation email. Never shown to browsers.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-sm font-medium text-ink">Collection address</span>
        <textarea
          rows={3}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setSaved(false);
          }}
          placeholder="Where customers collect from"
          className={`${inputClass} resize-y`}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-sm font-medium text-ink">
          Note <span className="text-ink-light font-normal">(optional)</span>
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. text me to arrange a time"
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={isPending} className={primaryBtn}>
          {isPending ? 'Saving…' : 'Save collection details'}
        </button>
        {saved && <span className="font-body text-xs text-green-700">Saved</span>}
      </div>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

export function DeliveryManager({
  categories,
  pickup,
}: {
  categories: Category[];
  pickup: PickupDetails;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white border border-cream-dark rounded-lg p-5">
        <h2 className="font-heading text-2xl font-bold text-ink mb-1">Delivery rates</h2>
        <p className="font-body text-sm text-ink-light mb-4">
          A charge per category. A basket spanning categories pays the highest single rate (it
          posts as one parcel). New categories you add appear here automatically.
        </p>
        {categories.map((c) => (
          <RateRow key={c.slug} category={c} />
        ))}
      </section>

      <section className="bg-white border border-cream-dark rounded-lg p-5">
        <h2 className="font-heading text-2xl font-bold text-ink mb-4">Collection details</h2>
        <PickupCard pickup={pickup} />
      </section>
    </div>
  );
}
