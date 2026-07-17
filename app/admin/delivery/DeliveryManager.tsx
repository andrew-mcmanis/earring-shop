'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { setDeliveryBase, updatePickupDetails } from './actions';
import type { DeliverySettings } from './queries';

const inputClass =
  'font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft';
const primaryBtn =
  'cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-4 py-2 rounded hover:bg-kraft-dark transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60';

function DeliveryBaseCard({ base, disabled }: { base: number; disabled: boolean }) {
  const [value, setValue] = useState(base.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Re-sync when a revalidation delivers a newer saved price (edited from
  // another tab/device), unless the admin has unsaved typing in the box —
  // so a stale value can't silently overwrite a newer one on Save.
  const serverValue = base.toFixed(2);
  const valueRef = useRef(value);
  valueRef.current = value;
  const prevServer = useRef(serverValue);
  useEffect(() => {
    if (prevServer.current === serverValue) return;
    prevServer.current = serverValue;
    if (valueRef.current !== serverValue) {
      setValue(serverValue);
      setSaved(false);
    }
  }, [serverValue]);

  if (disabled) {
    return (
      <p role="alert" className="font-body text-sm text-red-600">
        Couldn&apos;t load your delivery price just now — refresh to try again. Saving is disabled
        so nothing gets overwritten.
      </p>
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    const parsed = Number(value);
    if (value.trim() === '' || Number.isNaN(parsed)) {
      setError('Enter a price (0 or more).');
      return;
    }
    // EPSILON nudge so x.xx5 inputs round up (1.005 → 1.01, not 1.00).
    const rounded = Math.round((parsed + Number.EPSILON) * 100) / 100;
    const submitted = value;
    startTransition(async () => {
      const res = await setDeliveryBase(rounded);
      if (res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setValue((current) => (current === submitted ? rounded.toFixed(2) : current));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-sm text-ink-light">
        One delivery price for any order. The first item is charged the full price; every
        additional item is charged half. So at £2.00: one item is £2.00, two items £3.00, three
        items £4.00. Pickup is always free.
      </p>
      <div className="flex flex-wrap items-center gap-3">
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
          disabled={isPending}
          className={`${inputClass} w-28`}
          aria-label="Delivery price"
        />
        <button type="button" onClick={save} disabled={isPending} className={primaryBtn}>
          {isPending ? 'Saving…' : 'Save'}
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

function PickupCard({
  address: initialAddress,
  note: initialNote,
  disabled,
}: {
  address: string;
  note: string;
  disabled: boolean;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (disabled) {
    return (
      <p role="alert" className="font-body text-sm text-red-600">
        Couldn&apos;t load your collection details just now — refresh to try again. Saving is
        disabled so nothing gets overwritten.
      </p>
    );
  }

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

export function DeliveryManager({ settings }: { settings: DeliverySettings }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white border border-cream-dark rounded-lg p-5">
        <h2 className="font-heading text-2xl font-bold text-ink mb-4">Delivery price</h2>
        <DeliveryBaseCard base={settings.base} disabled={settings.error} />
      </section>

      <section className="bg-white border border-cream-dark rounded-lg p-5">
        <h2 className="font-heading text-2xl font-bold text-ink mb-4">Collection details</h2>
        <PickupCard address={settings.address} note={settings.note} disabled={settings.error} />
      </section>
    </div>
  );
}
