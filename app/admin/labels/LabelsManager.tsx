'use client';

import { useState, useTransition } from 'react';
import type { Category, Subcategory, Colour } from '../../data/types';
import {
  createCategory,
  renameCategory,
  deleteCategory,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
  createColour,
  updateColour,
  deleteColour,
  type LabelResult,
} from './actions';

const inputClass =
  'font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft';
const primaryBtn =
  'cursor-pointer bg-kraft text-cream font-body text-sm font-medium px-4 py-2 rounded hover:bg-kraft-dark transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60';
const linkBtn = 'cursor-pointer font-body text-sm transition-colors duration-150';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-cream-dark rounded-lg p-5 mb-6">
      <h2 className="font-heading text-2xl font-bold text-ink mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-5 h-5 rounded-full border border-cream-dark flex-shrink-0"
      style={
        hex
          ? { backgroundColor: hex }
          : {
              background:
                'conic-gradient(#C0392B 0deg, #9B59B6 90deg, #2E6DA4 180deg, #27AE60 270deg, #C0392B 360deg)',
            }
      }
      aria-hidden="true"
    />
  );
}

function TwoStepDelete({ onDelete }: { onDelete: () => Promise<LabelResult> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (error) {
    return (
      <span className="font-body text-xs text-red-600">
        {error}{' '}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(false);
          }}
          className="underline cursor-pointer"
        >
          ok
        </button>
      </span>
    );
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${linkBtn} font-medium text-red-600 hover:text-red-700`}
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onDelete();
            if (!r.ok) setError(r.error ?? 'Could not delete.');
          })
        }
        className="cursor-pointer font-body text-xs font-semibold text-cream bg-red-600 px-2.5 py-1 rounded hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={`${linkBtn} text-xs text-ink-light hover:text-ink`}>
        Cancel
      </button>
    </span>
  );
}

function RenameControl({
  name,
  onSave,
}: {
  name: string;
  onSave: (next: string) => Promise<LabelResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setError(null);
          setEditing(true);
        }}
        className={`${linkBtn} text-kraft-dark hover:text-kraft`}
      >
        Rename
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="New name"
        className={`${inputClass} py-1 w-36`}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onSave(value);
            if (r.ok) setEditing(false);
            else setError(r.error ?? 'Could not save.');
          })
        }
        className="cursor-pointer font-body text-xs font-semibold text-cream bg-kraft px-2.5 py-1 rounded hover:bg-kraft-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className={`${linkBtn} text-xs text-ink-light hover:text-ink`}>
        Cancel
      </button>
      {error && <span className="font-body text-xs text-red-600 w-full">{error}</span>}
    </span>
  );
}

function AddName({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<LabelResult>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onAdd(value);
          if (r.ok) setValue('');
          else setError(r.error ?? 'Could not add.');
        });
      }}
      className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-cream-dark"
    >
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${inputClass} flex-1 min-w-[10rem]`}
      />
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? 'Adding…' : 'Add'}
      </button>
      {error && <span className="font-body text-xs text-red-600 w-full">{error}</span>}
    </form>
  );
}

export function LabelsManager({
  categories,
  subcategories,
  colours,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  colours: Colour[];
}) {
  const categoryName = new Map(categories.map((c) => [c.slug, c.name]));

  // Add-subcategory local form state
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState(categories[0]?.slug ?? '');
  const [subError, setSubError] = useState<string | null>(null);
  const [subPending, startSub] = useTransition();

  // Add-colour local form state
  const [colName, setColName] = useState('');
  const [colHex, setColHex] = useState('#B5865A');
  const [colError, setColError] = useState<string | null>(null);
  const [colPending, startCol] = useTransition();

  return (
    <div>
      {/* Categories */}
      <Section title="Categories">
        <ul className="flex flex-col divide-y divide-cream-dark">
          {categories.map((c) => (
            <li key={c.slug} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
              <span className="font-body text-sm text-ink">{c.name}</span>
              <span className="flex items-center gap-4">
                <RenameControl name={c.name} onSave={(n) => renameCategory(c.slug, n)} />
                <TwoStepDelete onDelete={() => deleteCategory(c.slug)} />
              </span>
            </li>
          ))}
        </ul>
        <AddName placeholder="New category name" onAdd={createCategory} />
      </Section>

      {/* Subcategories */}
      <Section title="Earring types">
        <ul className="flex flex-col divide-y divide-cream-dark">
          {subcategories.map((s) => (
            <li key={s.slug} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
              <span className="font-body text-sm text-ink">
                {s.name}
                <span className="text-ink-light"> · {categoryName.get(s.categorySlug) ?? s.categorySlug}</span>
              </span>
              <span className="flex items-center gap-4">
                <RenameControl name={s.name} onSave={(n) => renameSubcategory(s.slug, n)} />
                <TwoStepDelete onDelete={() => deleteSubcategory(s.slug)} />
              </span>
            </li>
          ))}
          {subcategories.length === 0 && (
            <li className="font-body text-sm text-ink-light py-2.5">No types yet.</li>
          )}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startSub(async () => {
              const r = await createSubcategory(subName, subParent);
              if (r.ok) setSubName('');
              else setSubError(r.error ?? 'Could not add.');
            });
          }}
          className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-cream-dark"
        >
          <input
            value={subName}
            onChange={(e) => {
              setSubName(e.target.value);
              setSubError(null);
            }}
            placeholder="New type name"
            aria-label="New earring type name"
            className={`${inputClass} flex-1 min-w-[8rem]`}
          />
          <select
            value={subParent}
            onChange={(e) => setSubParent(e.target.value)}
            aria-label="Parent category"
            className={inputClass}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={subPending} className={primaryBtn}>
            {subPending ? 'Adding…' : 'Add'}
          </button>
          {subError && <span className="font-body text-xs text-red-600 w-full">{subError}</span>}
        </form>
      </Section>

      {/* Colours */}
      <Section title="Colours">
        <ul className="flex flex-col divide-y divide-cream-dark">
          {colours.map((c) => (
            <li key={c.slug} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
              <span className="inline-flex items-center gap-2.5">
                <Swatch hex={c.hex} />
                <span className="font-body text-sm text-ink">{c.name}</span>
              </span>
              <span className="flex items-center gap-4">
                <ColourEdit slug={c.slug} name={c.name} hex={c.hex} />
                <TwoStepDelete onDelete={() => deleteColour(c.slug)} />
              </span>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startCol(async () => {
              const r = await createColour(colName, colHex);
              if (r.ok) setColName('');
              else setColError(r.error ?? 'Could not add.');
            });
          }}
          className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-cream-dark"
        >
          <input
            type="color"
            value={colHex === '' ? '#B5865A' : colHex}
            onChange={(e) => setColHex(e.target.value)}
            aria-label="Colour swatch"
            className="h-9 w-12 cursor-pointer rounded border border-kraft-light bg-white"
          />
          <input
            value={colName}
            onChange={(e) => {
              setColName(e.target.value);
              setColError(null);
            }}
            placeholder="New colour name"
            aria-label="New colour name"
            className={`${inputClass} flex-1 min-w-[8rem]`}
          />
          <button type="submit" disabled={colPending} className={primaryBtn}>
            {colPending ? 'Adding…' : 'Add'}
          </button>
          {colError && <span className="font-body text-xs text-red-600 w-full">{colError}</span>}
        </form>
      </Section>
    </div>
  );
}

function ColourEdit({ slug, name, hex }: { slug: string; name: string; hex: string }) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(name);
  const [h, setH] = useState(hex || '#B5865A');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setN(name);
          setH(hex || '#B5865A');
          setError(null);
          setEditing(true);
        }}
        className={`${linkBtn} text-kraft-dark hover:text-kraft`}
      >
        Edit
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <input
        type="color"
        value={h}
        onChange={(e) => setH(e.target.value)}
        aria-label="Colour"
        className="h-7 w-9 cursor-pointer rounded border border-kraft-light bg-white"
      />
      <input value={n} onChange={(e) => setN(e.target.value)} aria-label="Colour name" className={`${inputClass} py-1 w-28`} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await updateColour(slug, n, h);
            if (r.ok) setEditing(false);
            else setError(r.error ?? 'Could not save.');
          })
        }
        className="cursor-pointer font-body text-xs font-semibold text-cream bg-kraft px-2.5 py-1 rounded hover:bg-kraft-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setEditing(false)} className={`${linkBtn} text-xs text-ink-light hover:text-ink`}>
        Cancel
      </button>
      {error && <span className="font-body text-xs text-red-600 w-full">{error}</span>}
    </span>
  );
}
