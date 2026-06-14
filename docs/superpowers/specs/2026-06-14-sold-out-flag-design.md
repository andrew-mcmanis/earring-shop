# Sold-out flag — design

_Date: 2026-06-14_

## Problem

The shop owner (Andrew's sister) needs a way to mark a product as **sold out** so
that customers can see it's unavailable and cannot order it. She controls this
herself from the admin panel. This is a simple availability flag, **not**
stock-quantity inventory.

## Decisions (confirmed)

- **Flag, not inventory.** A single on/off `sold_out` boolean per product. Real
  stock counts are explicitly out of scope (the natural future path if ever
  wanted, but YAGNI now).
- **Separate from `visible`.** `visible` hides an item from the shop entirely;
  `sold_out` keeps it **on display** but un-buyable.
- **Storefront display:** sold-out items stay in the grid and on their detail
  page with a **"Sold out" badge**, and the "Add to Cart" button becomes a
  disabled "Sold out".
- **Cart handling:** if an item sells out while already in a customer's
  (localStorage) cart, the cart drawer and checkout flag it as "Sold out —
  remove to continue" and disable the checkout button until it's removed. The
  server also rejects sold-out lines at order placement (real enforcement).

## Approach

Chosen: **a `sold_out` boolean column plus a live availability check.** It reuses
patterns already in the codebase:
- the `visible` boolean (column, form checkbox, list toggle, server action),
- the `placeOrder` "rebuild from authoritative catalogue" guard.

Rejected alternatives:
- **`status` enum** (`active`/`hidden`/`sold_out`) replacing `visible` — bigger
  migration touching every visible query + RLS policy; no real gain.
- **Stock-quantity inventory** — much larger (decrement, races, restock UI); the
  ask is a flag.

## Changes

### 1. Data model
- **Migration `supabase/migrations/0005_sold_out.sql`** (also appended to
  `supabase/schema.sql` per repo convention):
  ```sql
  alter table products add column if not exists sold_out boolean not null default false;
  create index if not exists products_sold_out_idx on products(sold_out);
  ```
  Run once in the Supabase SQL editor (owner/Andrew). No RLS/grant changes — the
  existing product policies cover the new column.
- `app/data/types.ts`: `Product` gains `soldOut: boolean`.
- `app/data/products.ts`: `ProductRow` gains `sold_out: boolean`; `mapProduct`
  maps `sold_out → soldOut`. **No change to the `visible` filter** — sold-out
  items remain `visible`, so `getProducts()` / `getProduct()` keep returning
  them. The sample catalogue (`app/data/sample.ts`) gets `soldOut: false` on each
  item (and the TS shape requires it).

### 2. Admin
- **`app/admin/products/ProductForm.tsx`**: add a "Sold out" checkbox (mirroring
  the existing "Visible in the shop" checkbox), with helper text: "Keeps it on
  display but customers can't order it." Default unchecked (or the product's
  current value when editing).
- **`app/admin/products/actions.ts`**: `parseProduct` reads `sold_out`
  (`formData.get('sold_out') != null`) into the insert/update values.
- **`app/admin/products/SoldOutToggle.tsx`**: new client component mirroring
  `VisibilityToggle` — one-click flag/unflag from the product list. On-brand
  styling (kraft/cream/amber, no SaaS red); `aria-pressed`, `aria-label`,
  visible focus ring.
- **`actions.ts`**: `toggleSoldOut(id, soldOut)` server action (mirrors
  `toggleVisibility`); revalidates `/admin/products`, `/`, and `/product/{id}`.
- **`app/admin/products/page.tsx`**: render `<SoldOutToggle>` alongside
  `<VisibilityToggle>` in each list row.

### 3. Storefront display
- **`app/components/ProductCard.tsx`**: when `product.soldOut`, show a "Sold out"
  badge (reuse the existing badge style/position language; distinct enough to
  read but on-brand).
- **`app/product/[id]/page.tsx`**: show a "Sold out" indicator near the
  title/price.
- **`app/components/AddToCartButton.tsx`**: when `product.soldOut`, render a
  disabled "Sold out" control instead of "Add to Cart" — not clickable,
  `aria-disabled`, greyed; does not call `addItem`.

### 4. Cart + checkout
- **Availability action** — new `'use server'` function
  `getUnavailableProductIds(ids: string[]): Promise<string[]>` (e.g.
  `app/lib/availability.ts`). Uses the public read client; returns the subset of
  `ids` that are now **sold out, hidden, or missing** (so it also covers items
  deleted/hidden after being added — a robustness bonus). Empty input → empty
  output (no query).
- **`app/components/CartProvider.tsx`**: add `unavailableIds: Set<string>` and
  `refreshAvailability()` to the context. Refresh when the drawer opens and when
  items change. (Cart snapshots in localStorage are NOT trusted for availability;
  this is always re-checked against the server.)
- **`app/components/CartDrawer.tsx`**: lines whose id is in `unavailableIds` show
  "Sold out — remove to continue"; the checkout button is disabled while any
  unavailable line remains. Removing the line re-enables it.
- **Checkout** (`app/checkout` + `CheckoutForm`): call `refreshAvailability()` on
  mount; flag affected lines and disable "Place order" until removed.
- **Server guard** — `app/lib/orders.ts` `placeOrder`: when rebuilding the order
  from the catalogue, reject any line whose product is `soldOut` (and, as today,
  any missing/invisible product). Return `status: 'error'` with a clear message
  naming the affected item(s) so the checkout can surface it. This is the real
  enforcement and extends to the future Stripe PaymentIntent (same rebuild path).

## Edge cases
- Sold-out items still appear in "You might also like" (badged; that section has
  no add-to-cart anyway).
- Sold-out items still have a detail page and remain in `generateStaticParams`.
- A cart full of sold-out items → checkout disabled with guidance; server would
  also reject. Empty/normal carts unaffected.

## Verification
- `tsc` clean.
- Preview tool: flag an item in admin → badge + disabled button on shop & detail
  → add an item then flag it sold out → cart drawer flags it + checkout disabled
  → removing it re-enables → forced sold-out order is rejected server-side.
- Push → Vercel auto-deploy.

## Out of scope
- Stock quantities / auto-decrement.
- Email/Stripe (tracked separately; the server guard is written so the Stripe
  PaymentIntent path inherits it).
