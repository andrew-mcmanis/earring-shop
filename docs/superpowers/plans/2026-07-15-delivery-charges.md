# Delivery charges + pickup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner set a delivery charge per category (auto-syncing with new categories) from a dedicated admin page, and let customers choose delivery or collection at checkout — with the collection address revealed only after a confirmed order.

**Architecture:** Rates live on `categories.delivery_charge`; a single-row `settings` table holds the private pickup address/note. Checkout gets a Deliver/Pick-up choice; the shipping charge (highest category rate for a mixed basket, £0 for pickup) is recomputed server-side in `placeOrder`, which returns the collection address only for pickup — handed to the confirming customer via `sessionStorage`, never anon-readable. Spec: `docs/superpowers/specs/2026-07-15-delivery-charges-design.md`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4, Supabase.

> **VERIFICATION CONVENTION — READ FIRST.** No unit-test runner exists; do NOT add one. Verify each task with `npx tsc --noEmit` (clean) + `npm run build` (succeeds), and the Claude Preview MCP tools for storefront-visible changes. Admin pages (auth + Supabase) can't be driven in local preview — verify by tsc/build/code-review; the owner validates live after deploy. The live DB is used by local dev; do NOT create real orders against it during preview unless cleaned up.
>
> **Brand rules (no AI tells):** kraft `#B5865A` / cream `#FDF8F0` / ink `#1A1A1A`; Amatic SC headings (`font-heading`), Cabin body (`font-body`); no glassmorphism; no `rounded-full` on controls (swatches + the in-stock switch excepted); minimal shadows; plain copy. Per `AGENTS.md`, consult `node_modules/next/dist/docs/` before unfamiliar framework APIs.

---

## File structure

**Create:**
- `supabase/migrations/0007_delivery.sql` — column + settings table + order columns.
- `app/lib/delivery.ts` — `getDeliveryRates()` server action (cart estimate).
- `app/admin/delivery/page.tsx`, `app/admin/delivery/DeliveryManager.tsx`, `app/admin/delivery/actions.ts`, `app/admin/delivery/queries.ts` — the Delivery admin.
- `app/checkout/success/OrderConfirmation.tsx` — client confirmation reader.

**Modify:**
- `supabase/schema.sql` — mirror the migration.
- `app/data/types.ts` — `Category.deliveryCharge`; `Order.fulfilmentMethod`/`shipping`; `Order.address` → `string | null`.
- `app/data/products.ts` — `getCategories` reads/maps `delivery_charge`.
- `app/data/sample.ts` — sample categories get demo rates.
- `app/components/CartProvider.tsx` — fetch rates on cart open; expose `shippingEstimate`.
- `app/components/CartDrawer.tsx` — show the delivery estimate line.
- `app/lib/orders.ts` — `placeOrder` computes shipping, validates per method, stores fields, returns collection payload; `PlaceOrderState` gains `collection`.
- `app/checkout/page.tsx` — fetch categories, pass rates to the form.
- `app/components/CheckoutForm.tsx` — Deliver/Pick-up UI, conditional address, summary, sessionStorage handoff.
- `app/checkout/success/page.tsx` — render `<OrderConfirmation>`.
- `app/admin/orders/queries.ts` — map `fulfilment_method`/`shipping`/nullable `address`.
- `app/admin/orders/page.tsx` — show method chip, shipping, total, "Collection" for pickup.
- `app/admin/page.tsx` — add a Delivery dashboard tile.
- `ROADMAP.md` — mark shipping decision resolved; note Phase-2 email must include collection/delivery detail.

---

## Task 1: Data model + read surfaces

**Files:**
- Create: `supabase/migrations/0007_delivery.sql`
- Modify: `supabase/schema.sql`, `app/data/types.ts`, `app/data/products.ts`, `app/data/sample.ts`, `app/admin/orders/queries.ts`, `app/admin/orders/page.tsx`

- [ ] **Step 1: Migration**

Create `supabase/migrations/0007_delivery.sql`:

```sql
-- 0007_delivery.sql
-- Per-category delivery charge, a private single-row pickup settings table,
-- and order fulfilment fields.

alter table products add column if not exists dummy_noop boolean;  -- (no-op guard removed below)
alter table products drop column if exists dummy_noop;

-- Per-category delivery rate (public, part of categories).
alter table categories add column if not exists delivery_charge numeric(10,2) not null default 0;

-- Private shop settings (pickup address/note). Single row (id always true).
create table if not exists settings (
  id             boolean primary key default true check (id),
  pickup_address text,
  pickup_note    text,
  updated_at     timestamptz not null default now()
);
insert into settings (id) values (true) on conflict (id) do nothing;

alter table settings enable row level security;
create policy "admin read settings"  on settings for select using (auth.role() = 'authenticated');
create policy "admin write settings" on settings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Deliberately NOT granted to anon: the pickup address is never publicly readable.
grant select, insert, update on settings to authenticated;
grant all on settings to service_role;

-- Order fulfilment.
alter table orders add column if not exists fulfilment_method text not null default 'delivery';
alter table orders add column if not exists shipping numeric(10,2) not null default 0;
-- Pickup orders have no delivery address.
alter table orders alter column address drop not null;
```

(Delete the two `dummy_noop` lines — they were a paste artifact; do NOT include them. The real first statement is the `categories` alter.)

- [ ] **Step 2: Mirror in `supabase/schema.sql`**

In the `create table if not exists categories (...)` block, add a `delivery_charge` line:

```sql
create table if not exists categories (
  slug           text primary key,
  name           text not null,
  sort_order     int  not null default 0,
  delivery_charge numeric(10,2) not null default 0
);
```

In the `create table if not exists orders (...)` block, change the `address` line to nullable and add the two fulfilment columns:

```sql
  address        text,                          -- null for pickup orders
  city           text,
  postcode       text,
  country        text not null default 'United Kingdom',
  notes          text,
  subtotal       numeric(10,2) not null default 0,
  shipping       numeric(10,2) not null default 0,
  fulfilment_method text not null default 'delivery',  -- delivery | pickup
  status         text not null default 'new',  -- new | made | posted | cancelled
  created_at     timestamptz not null default now()
);
```

After the `grant all on orders, order_items to service_role;` region (near the end of the orders block), add the settings table + its RLS/grants:

```sql
-- Private shop settings (pickup address/note). Not readable by anon.
create table if not exists settings (
  id             boolean primary key default true check (id),
  pickup_address text,
  pickup_note    text,
  updated_at     timestamptz not null default now()
);
alter table settings enable row level security;
create policy "admin read settings"  on settings for select using (auth.role() = 'authenticated');
create policy "admin write settings" on settings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
grant select, insert, update on settings to authenticated;
grant all on settings to service_role;
```

- [ ] **Step 3: Types (`app/data/types.ts`)**

Add `deliveryCharge` to `Category`:

```ts
export interface Category {
  slug: string;
  name: string;
  sortOrder: number;
  /** Delivery charge for items in this category, in £. */
  deliveryCharge: number;
}
```

Change `Order` — `address` becomes nullable, add the two fields:

```ts
export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  /** Delivery address; null for pickup orders. */
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  notes: string | null;
  subtotal: number;
  shipping: number;
  fulfilmentMethod: 'delivery' | 'pickup';
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}
```

- [ ] **Step 4: `getCategories` reads the rate (`app/data/products.ts`)**

Replace the `getCategories` function body's query + map:

```ts
export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name, sort_order, delivery_charge')
      .order('sort_order');
    if (!error && data) {
      return data.map((c) => ({
        slug: c.slug,
        name: c.name,
        sortOrder: c.sort_order ?? 0,
        deliveryCharge: Number(c.delivery_charge ?? 0),
      }));
    }
    console.warn('[data] categories query failed, using sample data:', error?.message);
  }
  return [...sampleCategories].sort((a, b) => a.sortOrder - b.sortOrder);
}
```

- [ ] **Step 5: Sample categories get demo rates (`app/data/sample.ts`)**

Replace the `sampleCategories` array:

```ts
export const sampleCategories: Category[] = [
  { slug: 'earrings', name: 'Earrings', sortOrder: 1, deliveryCharge: 3.5 },
  { slug: 'bookmarks', name: 'Bookmarks', sortOrder: 2, deliveryCharge: 1.5 },
  { slug: 'gifts', name: 'Gifts', sortOrder: 3, deliveryCharge: 2.5 },
];
```

- [ ] **Step 6: Admin orders read model (`app/admin/orders/queries.ts`)**

In `OrderItemRow`/`OrderRow`, change `address: string;` to `address: string | null;` and add `shipping: number | string;` and `fulfilment_method: string;` to `OrderRow`. Update `mapOrder`'s return to include:

```ts
    address: r.address,
    city: r.city,
    postcode: r.postcode,
    country: r.country,
    notes: r.notes,
    subtotal: Number(r.subtotal),
    shipping: Number(r.shipping ?? 0),
    fulfilmentMethod: r.fulfilment_method === 'pickup' ? 'pickup' : 'delivery',
    status: r.status as OrderStatus,
```

(The `select('*, order_items(*)')` already returns the new columns.)

- [ ] **Step 7: Admin orders page display (`app/admin/orders/page.tsx`)**

The page currently renders `order.address` (now `string | null`) and a subtotal. Make two edits:
1. Wherever the address block renders, guard it: show the address only when `order.fulfilmentMethod === 'delivery' && order.address`, otherwise show a **"Collection — no delivery address"** line. Find the address rendering (search the file for `.address`) and wrap it:

```tsx
{order.fulfilmentMethod === 'pickup' ? (
  <p className="font-body text-sm text-ink-light">Collection — no delivery address</p>
) : (
  <p className="font-body text-sm text-ink-light">
    {order.address}
    {order.city ? `, ${order.city}` : ''}
    {order.postcode ? `, ${order.postcode}` : ''}
  </p>
)}
```

2. Where the order total/subtotal shows, add a **Delivery** line and a **Total**:

```tsx
<div className="flex items-center justify-between font-body text-sm">
  <span className="text-ink-light capitalize">{order.fulfilmentMethod}</span>
  <span className="text-ink-light tabular-nums">
    {order.shipping > 0 ? `+£${order.shipping.toFixed(2)} delivery` : order.fulfilmentMethod === 'pickup' ? 'Pickup' : 'Free delivery'}
  </span>
</div>
<div className="flex items-center justify-between font-body text-sm font-semibold">
  <span className="text-ink">Total</span>
  <span className="text-ink tabular-nums">£{(order.subtotal + order.shipping).toFixed(2)}</span>
</div>
```

(Match the file's existing markup/spacing; the exact wrapper classes are illustrative — keep it consistent with the surrounding order card. Read the file first and place these near the existing subtotal.)

- [ ] **Step 8: Verify + preview**

Run `npx tsc --noEmit` (clean) and `npm run build` (succeeds). Preview: `preview_start`, confirm `/` still renders and product pages load (categories now carry a rate; nothing visual changes yet), `preview_console_logs` clean, `preview_stop`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0007_delivery.sql supabase/schema.sql app/data/types.ts app/data/products.ts app/data/sample.ts app/admin/orders/queries.ts app/admin/orders/page.tsx
git commit -m "Delivery data model: per-category rate, settings table, order fulfilment fields" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Cart delivery estimate

**Files:**
- Create: `app/lib/delivery.ts`
- Modify: `app/components/CartProvider.tsx`, `app/components/CartDrawer.tsx`

- [ ] **Step 1: `getDeliveryRates` server action**

Create `app/lib/delivery.ts`:

```ts
'use server';

import { isSupabaseConfigured, createReadClient } from './supabase';
import { sampleCategories } from '../data/sample';

/**
 * Category slug → delivery charge (£). Used for the cart's estimate line; the
 * authoritative charge is always recomputed server-side in placeOrder.
 */
export async function getDeliveryRates(): Promise<Record<string, number>> {
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase.from('categories').select('slug, delivery_charge');
    if (!error && data) {
      const rates: Record<string, number> = {};
      for (const c of data) rates[c.slug] = Number(c.delivery_charge ?? 0);
      return rates;
    }
    return {};
  }
  const rates: Record<string, number> = {};
  for (const c of sampleCategories) rates[c.slug] = c.deliveryCharge;
  return rates;
}
```

- [ ] **Step 2: CartProvider fetches rates + exposes `shippingEstimate`**

In `app/components/CartProvider.tsx`:

1. Add the import:

```ts
import { getDeliveryRates } from '../lib/delivery';
```

2. Add `deliveryRates` state after the `unavailableIds` state:

```ts
  const [deliveryRates, setDeliveryRates] = useState<Record<string, number>>({});
```

3. Extend the cart-open effect (the one that calls `refreshAvailability` when `isOpen`) to also fetch rates once:

```ts
  useEffect(() => {
    if (!isOpen) return;
    void refreshAvailability();
    if (Object.keys(deliveryRates).length === 0) {
      getDeliveryRates()
        .then(setDeliveryRates)
        .catch(() => {});
    }
  }, [isOpen, refreshAvailability, deliveryRates]);
```

4. Compute the estimate (highest applicable rate) after `totalPrice`:

```ts
  const shippingEstimate = items.reduce(
    (max, i) => Math.max(max, deliveryRates[i.categorySlug] ?? 0),
    0,
  );
```

5. Add `shippingEstimate: number;` to the `CartContextValue` interface and include `shippingEstimate,` in the context `value`.

- [ ] **Step 3: CartDrawer shows the estimate**

In `app/components/CartDrawer.tsx`, destructure `shippingEstimate` from `useCart()` (add it to the existing destructure). Replace:

```tsx
            <p className="font-body text-xs text-ink-light">
              Shipping is arranged after checkout.
            </p>
```

with:

```tsx
            <p className="font-body text-xs text-ink-light">
              {shippingEstimate > 0
                ? `Delivery from £${shippingEstimate.toFixed(2)} · or free pickup at checkout`
                : 'Delivery calculated at checkout · or free pickup'}
            </p>
```

- [ ] **Step 4: Verify + preview**

`npx tsc --noEmit` clean; `npm run build` succeeds. Preview: `preview_start`; add an item to the cart; open the drawer; confirm the line reads "Delivery from £3.50 · or free pickup at checkout" (earrings sample rate); `preview_console_logs` clean; `preview_stop`.

- [ ] **Step 5: Commit**

```bash
git add app/lib/delivery.ts app/components/CartProvider.tsx app/components/CartDrawer.tsx
git commit -m "Show a delivery estimate in the cart (per-category, highest rate)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Admin Delivery page

**Files:**
- Create: `app/admin/delivery/queries.ts`, `app/admin/delivery/actions.ts`, `app/admin/delivery/DeliveryManager.tsx`, `app/admin/delivery/page.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Pickup-details query (`app/admin/delivery/queries.ts`)**

```ts
import { createServerSupabase } from '../../lib/supabase-server';

export interface PickupDetails {
  address: string;
  note: string;
}

export async function getPickupDetails(): Promise<PickupDetails> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    return { address: data?.pickup_address ?? '', note: data?.pickup_note ?? '' };
  } catch {
    return { address: '', note: '' };
  }
}
```

- [ ] **Step 2: Actions (`app/admin/delivery/actions.ts`)**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '../../lib/supabase-server';

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

async function requireUser(): Promise<SupabaseClient> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authorised.');
  return supabase;
}

export async function setDeliveryCharge(slug: string, charge: number): Promise<DeliveryResult> {
  const supabase = await requireUser();
  if (!Number.isFinite(charge) || charge < 0) {
    return { ok: false, error: 'Enter a valid charge (0 or more).' };
  }
  const { error } = await supabase
    .from('categories')
    .update({ delivery_charge: charge })
    .eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/delivery');
  revalidatePath('/');
  revalidatePath('/checkout');
  return { ok: true };
}

export async function updatePickupDetails(address: string, note: string): Promise<DeliveryResult> {
  const supabase = await requireUser();
  const { error } = await supabase
    .from('settings')
    .update({ pickup_address: address.trim() || null, pickup_note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/delivery');
  return { ok: true };
}
```

- [ ] **Step 3: `DeliveryManager.tsx` (client)**

```tsx
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
```

- [ ] **Step 4: `page.tsx`**

Create `app/admin/delivery/page.tsx`:

```tsx
import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { getCategories } from '../../data/products';
import { getPickupDetails } from './queries';
import { DeliveryManager } from './DeliveryManager';

export const metadata = { title: 'Delivery · Admin' };

export default async function DeliveryPage() {
  const [categories, pickup] = await Promise.all([getCategories(), getPickupDetails()]);

  return (
    <div className="min-h-dvh bg-cream">
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/admin"
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5 mb-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>
        <h1 className="font-heading text-4xl font-bold text-ink">Delivery</h1>
        <p className="font-body text-sm text-ink-light mt-1 mb-8 max-w-prose">
          Set a delivery charge for each category, and the collection details customers see once
          they order a pickup.
        </p>
        <DeliveryManager categories={categories} pickup={pickup} />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Dashboard tile (`app/admin/page.tsx`)**

In the stat-tiles grid, change `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` on the tiles' wrapper `div`, and add a fourth tile after the Labels tile:

```tsx
          <Link
            href="/admin/delivery"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Delivery</h3>
            <p className="font-body text-sm text-ink-light mt-1">Set delivery rates & collection.</p>
          </Link>
```

- [ ] **Step 6: Verify**

`npx tsc --noEmit` clean; `npm run build` succeeds. (Auth-gated page — runtime validated by the owner after deploy.)

- [ ] **Step 7: Commit**

```bash
git add app/admin/delivery/ app/admin/page.tsx
git commit -m "Add the Delivery admin page: per-category rates + collection details" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: placeOrder server authority

**Files:**
- Modify: `app/lib/orders.ts`

- [ ] **Step 1: `PlaceOrderState` gains the collection payload**

In `app/lib/orders.ts`, extend the interface:

```ts
export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
  /** Set only for a successful pickup order — the private collection details. */
  collection?: { address: string | null; note: string | null };
}
```

- [ ] **Step 2: Read method + rates, compute shipping, validate per method**

Replace the top of `placeOrder` (the field reads through the `fieldErrors.address` line) with method-aware logic:

```ts
  const name = str(formData, 'name');
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  const address = str(formData, 'address');
  const city = str(formData, 'city');
  const postcode = str(formData, 'postcode');
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter your name.';
  if (!email) fieldErrors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';
```

Then, in the rebuild loop, collect the ordered categories. Change the loop so it also records `categorySlug`. Replace the loop + subtotal block with:

```ts
  const items: OrderLine[] = [];
  const soldOutNames: string[] = [];
  const orderedCategories = new Set<string>();
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!product || quantity <= 0) continue;
    if (product.soldOut) {
      soldOutNames.push(product.name);
      continue;
    }
    orderedCategories.add(product.categorySlug);
    items.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity });
  }
```

(The field-errors / sold-out / empty-cart guards that follow stay exactly as they are.)

After `const subtotal = ...`, compute shipping authoritatively:

```ts
  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // Delivery = the highest category rate among the ordered items (one parcel);
  // pickup = £0. Rates read from the DB here, never trusted from the client.
  let shipping = 0;
  if (!isPickup && isSupabaseConfigured() && orderedCategories.size > 0) {
    const supabase = createReadClient();
    const { data: cats } = await supabase
      .from('categories')
      .select('slug, delivery_charge')
      .in('slug', [...orderedCategories]);
    if (cats) {
      shipping = cats.reduce((max, c) => Math.max(max, Number(c.delivery_charge ?? 0)), 0);
    }
  }
```

- [ ] **Step 3: Persist the new fields + read collection details**

In the demo/no-DB branch, leave `return { status: 'success' }` as-is.

In the DB insert, change the `.insert({...})` object to store the method, shipping, and null address for pickup:

```ts
      .insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        address: isPickup ? null : address,
        city: isPickup ? null : city || null,
        postcode: isPickup ? null : postcode || null,
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
        shipping,
        fulfilment_method: isPickup ? 'pickup' : 'delivery',
        status: 'new',
      })
```

Then change the success return (after the sold-out flip block) to include the collection payload for pickup. Replace:

```ts
    return { status: 'success', reference: `BLG-${order.order_number}` };
```

with:

```ts
    let collection: { address: string | null; note: string | null } | undefined;
    if (isPickup) {
      const { data: settings } = await supabase
        .from('settings')
        .select('pickup_address, pickup_note')
        .eq('id', true)
        .maybeSingle();
      collection = { address: settings?.pickup_address ?? null, note: settings?.pickup_note ?? null };
    }
    return { status: 'success', reference: `BLG-${order.order_number}`, collection };
```

(`supabase` here is the service client already created for the insert, so it can read `settings`.)

- [ ] **Step 4: Verify**

`npx tsc --noEmit` clean; `npm run build` succeeds. (Full runtime path exercised in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add app/lib/orders.ts
git commit -m "Compute delivery/pickup shipping server-side in placeOrder" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Checkout Deliver/Pick-up + shipping

**Files:**
- Modify: `app/checkout/page.tsx`, `app/components/CheckoutForm.tsx`

- [ ] **Step 1: Checkout page passes rates**

Replace `app/checkout/page.tsx` so it fetches categories and passes a rates map (make the component async):

```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { CheckoutForm } from '../components/CheckoutForm';
import { getCategories } from '../data/products';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const categories = await getCategories();
  const deliveryRates: Record<string, number> = {};
  for (const c of categories) deliveryRates[c.slug] = c.deliveryCharge;

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href="/"
            className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Continue shopping
          </Link>
        </nav>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink mb-8">Checkout</h1>
        <CheckoutForm deliveryRates={deliveryRates} />
      </div>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: CheckoutForm — method state, conditional address, summary, hidden field**

In `app/components/CheckoutForm.tsx`:

1. Add `useState` to the React import (`import { useActionState, useEffect, useState } from 'react';`).
2. Change the component signature to accept the prop:

```tsx
export function CheckoutForm({ deliveryRates }: { deliveryRates: Record<string, number> }) {
```

3. After the `hasUnavailable` line, add method state + shipping calc:

```tsx
  const [method, setMethod] = useState<'delivery' | 'pickup'>('delivery');
  const shipping =
    method === 'pickup'
      ? 0
      : items.reduce((max, i) => Math.max(max, deliveryRates[i.categorySlug] ?? 0), 0);
  const total = totalPrice + shipping;
```

4. Add the hidden method field next to the existing hidden `items` input:

```tsx
        <input type="hidden" name="fulfilment_method" value={method} />
```

5. Replace the entire **Delivery** `<fieldset>` (legend "Delivery" + address/city/postcode + notes) with a fulfilment section that has the radios, conditional address, and always-present notes:

```tsx
        <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
          <legend className="font-heading text-2xl font-bold text-ink mb-1">How to get it</legend>

          <div className="flex flex-col sm:flex-row gap-3">
            {(['delivery', 'pickup'] as const).map((m) => (
              <label
                key={m}
                className={`flex-1 cursor-pointer rounded-lg border p-3 flex items-center gap-3 transition-colors duration-150 ${
                  method === m ? 'border-kraft bg-kraft/5' : 'border-kraft-light hover:border-kraft'
                }`}
              >
                <input
                  type="radio"
                  name="fulfilment_choice"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="h-4 w-4 accent-kraft cursor-pointer"
                />
                <span className="font-body text-sm">
                  <span className="font-medium text-ink">{m === 'delivery' ? 'Deliver' : 'Pick up'}</span>
                  <span className="block text-xs text-ink-light">
                    {m === 'delivery' ? 'Posted to your address' : 'Collect — free'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {method === 'delivery' ? (
            <>
              <Field id="address" label="Address" required autoComplete="street-address" error={state.fieldErrors?.address} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field id="city" label="Town / City" autoComplete="address-level2" />
                <Field id="postcode" label="Postcode" autoComplete="postal-code" />
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-ink-light bg-cream-dark rounded-lg px-4 py-3">
              Collection details will be sent once your order&apos;s confirmed.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="font-body text-sm font-medium text-ink">
              Order notes <span className="text-ink-light font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything we should know — colour preferences, gift message, etc."
              className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft resize-y"
            />
          </div>
        </fieldset>
```

6. In the order-summary `<aside>`, replace the single Subtotal row with Subtotal + Delivery + Total:

```tsx
          <div className="flex flex-col gap-2 border-t border-kraft-light pt-3">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-ink-light">Subtotal</span>
              <span className="font-body text-sm text-ink tabular-nums">£{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-ink-light">
                {method === 'pickup' ? 'Collection' : 'Delivery'}
              </span>
              <span className="font-body text-sm text-ink tabular-nums">
                {shipping > 0 ? `£${shipping.toFixed(2)}` : 'Free'}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-kraft-light pt-2">
              <span className="font-body text-sm font-semibold text-ink">Total</span>
              <span className="font-body text-xl font-semibold text-ink tabular-nums">£{total.toFixed(2)}</span>
            </div>
          </div>
```

- [ ] **Step 3: Verify + preview**

`npx tsc --noEmit` clean; `npm run build` succeeds. Preview: `preview_start`; add an item; go to `/checkout`; confirm the Deliver/Pick-up radios; toggling to **Pick up** hides the address fields, shows "Collection details will be sent…", and the summary shows Collection **Free** with Total = subtotal; toggling to **Deliver** shows the address fields and Delivery = the category rate with Total = subtotal + delivery; `preview_console_logs` clean; `preview_stop`.

- [ ] **Step 4: Commit**

```bash
git add app/checkout/page.tsx app/components/CheckoutForm.tsx
git commit -m "Checkout: deliver/pick-up choice with live shipping in the summary" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Confirmation handoff + holistic verification + finish

**Files:**
- Create: `app/checkout/success/OrderConfirmation.tsx`
- Modify: `app/components/CheckoutForm.tsx`, `app/checkout/success/page.tsx`, `ROADMAP.md`

- [ ] **Step 1: CheckoutForm writes the confirmation payload to sessionStorage**

In `app/components/CheckoutForm.tsx`, replace the success effect so it stashes the payload before redirecting. The current effect is:

```tsx
  useEffect(() => {
    if (state.status === 'success') {
      clear();
      const q = state.reference ? `?ref=${encodeURIComponent(state.reference)}` : '';
      router.push(`/checkout/success${q}`);
    }
  }, [state, clear, router]);
```

Replace with (captures method + delivery address / collection details, keeps the collection address out of the URL):

```tsx
  useEffect(() => {
    if (state.status !== 'success') return;
    try {
      const payload = {
        reference: state.reference ?? null,
        method,
        delivery:
          method === 'delivery'
            ? {
                address: (document.getElementById('address') as HTMLInputElement | null)?.value ?? '',
                city: (document.getElementById('city') as HTMLInputElement | null)?.value ?? '',
                postcode: (document.getElementById('postcode') as HTMLInputElement | null)?.value ?? '',
              }
            : null,
        collection: state.collection ?? null,
      };
      sessionStorage.setItem('blg-last-order', JSON.stringify(payload));
    } catch {
      // sessionStorage unavailable — the success page falls back to the ref.
    }
    clear();
    const q = state.reference ? `?ref=${encodeURIComponent(state.reference)}` : '';
    router.push(`/checkout/success${q}`);
  }, [state, method, clear, router]);
```

- [ ] **Step 2: `OrderConfirmation.tsx` (client)**

Create `app/checkout/success/OrderConfirmation.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface LastOrder {
  reference: string | null;
  method: 'delivery' | 'pickup';
  delivery: { address: string; city: string; postcode: string } | null;
  collection: { address: string | null; note: string | null } | null;
}

export function OrderConfirmation({ fallbackRef }: { fallbackRef?: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('blg-last-order');
      if (raw) setOrder(JSON.parse(raw) as LastOrder);
    } catch {
      // ignore
    }
  }, []);

  const reference = order?.reference ?? fallbackRef;

  return (
    <>
      {reference && (
        <p className="font-body text-sm text-ink-light">
          Your reference is{' '}
          <span className="font-semibold text-ink tabular-nums">{reference}</span>.
        </p>
      )}

      {order?.method === 'pickup' && order.collection?.address ? (
        <div className="font-body text-base text-ink-light max-w-md leading-relaxed flex flex-col gap-2">
          <p>Your order is for collection. You can pick it up from:</p>
          <p className="whitespace-pre-line font-medium text-ink bg-cream-dark rounded-lg px-4 py-3">
            {order.collection.address}
          </p>
          {order.collection.note && <p>{order.collection.note}</p>}
          <p>We&apos;ll be in touch to arrange a time.</p>
        </div>
      ) : order?.method === 'pickup' ? (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          Your order is for collection — we&apos;ll be in touch with the details shortly.
        </p>
      ) : (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          We&apos;ll be in touch by email shortly to confirm payment and delivery. Keep an eye on
          your inbox.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 3: Success page renders it**

In `app/checkout/success/page.tsx`, add the import and replace the static `{ref && (...)}` block **and** the following generic `<p>` (the "We'll be in touch by email…" paragraph) with the component:

```tsx
import { OrderConfirmation } from './OrderConfirmation';
```

Replace both blocks (the `{ref && (<p>…reference…</p>)}` and the generic email `<p>`) with:

```tsx
        <OrderConfirmation fallbackRef={ref} />
```

- [ ] **Step 4: ROADMAP note**

In `ROADMAP.md`, update the Phase 2 "Automatic emails" bullet to note the collection/delivery detail, and mark the shipping decision resolved. In the **Decisions the owner needs to make** list, change item 1 to:

```markdown
1. ~~**Shipping model**~~ — RESOLVED (2026-07-15): per-category rates (highest wins for
   mixed baskets) + free pickup, set on the `/admin/delivery` page. Built.
```

And in the Phase 2 emails bullet, append: "The confirmation email must include the **delivery address** (delivery orders) or the **collection address + note** (pickup orders), read from `settings` at send time — the checkout/confirmation flow already captures the method."

- [ ] **Step 5: Runtime verification (preview, careful with the live DB)**

`npx tsc --noEmit` clean; `npm run build` succeeds. Preview: `preview_start`. Because local dev uses the live DB, verify the **display** paths without leaving junk:
- Add an item, go to checkout, toggle Pick up → confirm summary + copy (no real order placed).
- To exercise the confirmation screen without a live order, in `preview_eval` set `sessionStorage['blg-last-order']` to a sample pickup payload `{reference:'BLG-TEST',method:'pickup',delivery:null,collection:{address:'12 Craft Lane\nWhitby',note:'text me to arrange'}}`, navigate to `/checkout/success`, and confirm the collection address + note render; then a delivery payload; then clear the key.
- `preview_console_logs` clean; `preview_stop`.

(The full place-a-real-order path is validated by the owner after deploy, since it writes to the production DB and flips sold-out.)

- [ ] **Step 6: Commit**

```bash
git add app/checkout/success/OrderConfirmation.tsx app/components/CheckoutForm.tsx app/checkout/success/page.tsx ROADMAP.md
git commit -m "Reveal collection details only on the confirmed-order screen (session handoff)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Finish the branch**

Confirm the working tree is clean (no temp sample edits). Use superpowers:finishing-a-development-branch to merge to `main` + push (Vercel deploys). After deploy: **the owner runs migration `0007_delivery.sql` in Supabase**, then sets a rate + the collection address on `/admin/delivery`, and validates a delivery and a pickup order end-to-end.

---

## Self-review (completed by plan author)

- **Spec coverage:** per-category rate + auto-sync (T1 column, T3 lists all categories) ✓; highest-rate-for-mixed (T4 compute, T5 display, T2 estimate) ✓; dedicated `/admin/delivery` + dashboard tile (T3) ✓; deliver/pickup at checkout with editable address for delivery / none for pickup (T5) ✓; collection address private + revealed only post-order via session (T4 returns it, T6 session handoff + OrderConfirmation) ✓; server-authoritative shipping + nullable pickup address (T4, T1) ✓; settings table not anon-readable (T1 grants) ✓; admin orders show method/shipping/total (T1 step 7) ✓; Phase-2 email note (T6) ✓.
- **Placeholder scan:** none — every code step is complete. (The migration's two `dummy_noop` lines are explicitly called out to be omitted.)
- **Type consistency:** `Category.deliveryCharge:number`, `Order.address:string|null` + `fulfilmentMethod`/`shipping`, `PlaceOrderState.collection?:{address:string|null;note:string|null}`, `getDeliveryRates():Record<string,number>`, `PickupDetails{address,note}`, `CheckoutForm({deliveryRates})`, and the sessionStorage `blg-last-order` payload shape are used identically across tasks.
