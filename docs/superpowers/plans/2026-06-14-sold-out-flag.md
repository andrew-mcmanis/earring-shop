# Sold-out Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the shop owner flag a product as "sold out" so it stays on display but cannot be ordered.

**Architecture:** Add a `sold_out` boolean to products (separate from `visible`). The admin gets a form checkbox and a one-click list toggle. The storefront shows a "Sold out" badge and a disabled buy button. The cart/checkout re-check availability against the server and block sold-out lines, and `placeOrder` rejects sold-out lines as the real enforcement.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + RLS), Tailwind v4, TypeScript.

**Project verification norms (no unit-test runner installed):** type-check with `npx tsc --noEmit`, full build with `npm run build`, and browser checks with the preview tool. Commit after each task. The feature branch `feat/sold-out` already exists.

**One manual step:** the DB migration in Task 1 must be run by the owner in the Supabase SQL editor. The code is written to work both before and after it runs (`sold_out` defaults to `false` when the column is absent), so development is not blocked.

---

### Task 1: Data model — column, types, mapping, sample data

**Files:**
- Create: `supabase/migrations/0005_sold_out.sql`
- Modify: `supabase/schema.sql` (append, after the products grants block ~line 88)
- Modify: `app/data/types.ts:52-68` (Product interface)
- Modify: `app/data/products.ts:18-46` (ProductRow + mapProduct)
- Modify: `app/data/sample.ts:33-57` (all 18 products)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_sold_out.sql`:

```sql
-- Adds a "sold out" flag: keeps a product on display but un-orderable.
-- Distinct from `visible` (which hides it entirely). Run once in the
-- Supabase SQL editor.

alter table products
  add column if not exists sold_out boolean not null default false;

create index if not exists products_sold_out_idx on products(sold_out);
```

- [ ] **Step 2: Mirror it into schema.sql**

In `supabase/schema.sql`, immediately after the line
`create index if not exists products_visible_idx  on products(visible);`
(around line 48), add:

```sql
create index if not exists products_sold_out_idx on products(sold_out);
```

And in the products `create table` block, add the column after the `visible` line
(`visible          boolean not null default true,`):

```sql
  sold_out         boolean not null default false,
```

- [ ] **Step 3: Add `soldOut` to the Product type**

In `app/data/types.ts`, inside `interface Product`, add after the `visible` field:

```ts
  /** Sold out: stays on display but cannot be ordered. */
  soldOut: boolean;
```

- [ ] **Step 4: Run the type-check to see the expected failures**

Run: `npx tsc --noEmit`
Expected: FAIL — errors in `app/data/sample.ts` (18 object literals missing `soldOut`) and `app/data/products.ts` (`mapProduct` return missing `soldOut`). This confirms the type now requires the field.

- [ ] **Step 5: Map the DB column**

In `app/data/products.ts`, add to `interface ProductRow` after `visible: boolean;`:

```ts
  sold_out: boolean;
```

In `mapProduct`, add after the `visible: row.visible,` line:

```ts
    soldOut: row.sold_out ?? false,
```

(`?? false` keeps it working before the migration runs, when the column is absent.)

- [ ] **Step 6: Update the sample catalogue**

In `app/data/sample.ts`, add `soldOut: false,` to every product object (all 18), placed right after each `visible: true,`. Leave all of them `false` except set **one** earring to sold out for easy local testing — change product id `'5'` (Sapphire Huggie) to `soldOut: true`. Example for id `'5'`:

```ts
  { id: '5', name: 'Sapphire Huggie', price: 40, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'blue', description: 'Sapphire-set huggies in polished sterling silver.', accentColor: '#2E6DA4', image: null, visible: true, soldOut: true, sortOrder: 5 },
```

All others get `soldOut: false`.

- [ ] **Step 7: Type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS (no output).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0005_sold_out.sql supabase/schema.sql app/data/types.ts app/data/products.ts app/data/sample.ts
git commit -m "Add sold_out to product model, schema, and sample data"
```

---

### Task 2: Admin — form checkbox, list toggle, server action

**Files:**
- Modify: `app/admin/products/actions.ts` (parseProduct ~line 50-111; add `toggleSoldOut` near `toggleVisibility` ~line 170)
- Modify: `app/admin/products/ProductForm.tsx:201-214` (after the "Visible" checkbox)
- Create: `app/admin/products/SoldOutToggle.tsx`
- Modify: `app/admin/products/page.tsx` (import + render in the list row ~line 102)

- [ ] **Step 1: Parse `sold_out` in the form action**

In `app/admin/products/actions.ts`, inside `parseProduct`, after the line
`const visible = formData.get('visible') != null;` add:

```ts
  const soldOut = formData.get('sold_out') != null;
```

Then in the returned `values` object (the `ok: true` branch), add after `visible,`:

```ts
      sold_out: soldOut,
```

- [ ] **Step 2: Add the `toggleSoldOut` server action**

In `app/admin/products/actions.ts`, after the `toggleVisibility` function, add:

```ts
export async function toggleSoldOut(id: string, soldOut: boolean): Promise<void> {
  const supabase = await requireUser();
  await supabase.from('products').update({ sold_out: soldOut }).eq('id', id);
  revalidatePath('/admin/products');
  revalidatePath('/');
  revalidatePath(`/product/${id}`);
}
```

- [ ] **Step 3: Add the form checkbox**

In `app/admin/products/ProductForm.tsx`, directly after the closing `</label>` of the
"Visible in the shop" checkbox (the block ending around line 214), add:

```tsx
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="sold_out"
          defaultChecked={product?.soldOut ?? false}
          className="h-4 w-4 accent-kraft cursor-pointer"
        />
        <span className="font-body text-sm text-ink">
          Sold out
          <span className="block text-xs text-ink-light">
            Keeps it on display but customers can&apos;t order it.
          </span>
        </span>
      </label>
```

- [ ] **Step 4: Create the list toggle**

Create `app/admin/products/SoldOutToggle.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { toggleSoldOut } from './actions';

export function SoldOutToggle({ id, soldOut }: { id: string; soldOut: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleSoldOut(id, !soldOut))}
      aria-pressed={soldOut}
      aria-label={soldOut ? 'Sold out — click to mark in stock' : 'In stock — click to mark sold out'}
      className={`cursor-pointer inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
        soldOut
          ? 'border-ink/30 bg-ink/5 text-ink hover:border-ink/50'
          : 'border-kraft-light text-ink-light hover:border-kraft'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${soldOut ? 'bg-ink' : 'bg-green-600'}`}
        aria-hidden="true"
      />
      {soldOut ? 'Sold out' : 'In stock'}
    </button>
  );
}
```

- [ ] **Step 5: Render the toggle in the product list**

In `app/admin/products/page.tsx`, add the import near the other imports:

```tsx
import { SoldOutToggle } from './SoldOutToggle';
```

Then directly after `<VisibilityToggle id={p.id} visible={p.visible} />` (line ~102), add:

```tsx
                  <SoldOutToggle id={p.id} soldOut={p.soldOut} />
```

- [ ] **Step 6: Type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Verify in the preview tool**

Start the dev server if needed. Sign in to `/admin` (test-admin@blgcreations.test / TestPassw0rd!), open `/admin/products`. Confirm: each row shows an "In stock"/"Sold out" toggle; clicking it flips the state and persists on reload; the edit form shows and saves the "Sold out" checkbox.

- [ ] **Step 8: Commit**

```bash
git add app/admin/products/actions.ts app/admin/products/ProductForm.tsx app/admin/products/SoldOutToggle.tsx app/admin/products/page.tsx
git commit -m "Admin: sold-out checkbox, list toggle, and server action"
```

---

### Task 3: Storefront — badge and disabled buy button

**Files:**
- Modify: `app/components/AddToCartButton.tsx` (disabled state)
- Modify: `app/components/ProductCard.tsx:18-35` (badge)
- Modify: `app/product/[id]/page.tsx:121-155` (badge near price/actions)

- [ ] **Step 1: Add the disabled state to AddToCartButton**

In `app/components/AddToCartButton.tsx`, after the `const sizing = ...` line and
before the `return (`, add:

```tsx
  if (product.soldOut) {
    return (
      <span
        aria-disabled="true"
        className={`inline-flex items-center justify-center font-body font-medium rounded bg-cream-dark text-ink-light cursor-not-allowed ${sizing} ${className}`}
      >
        Sold out
      </span>
    );
  }
```

- [ ] **Step 2: Add the card badge**

In `app/components/ProductCard.tsx`, inside the `<Link>` image area, directly after
the category `<span>` badge block (the one ending `{badge}\n        </span>`), add:

```tsx
        {product.soldOut && (
          <span className="absolute top-3 right-3 z-10 bg-ink/85 text-cream text-xs font-body font-medium px-2 py-0.5 rounded">
            Sold out
          </span>
        )}
```

- [ ] **Step 3: Add the detail-page indicator**

In `app/product/[id]/page.tsx`, directly after the price `<p>` block (the
`£{product.price.toFixed(2)}` paragraph, ~line 123), add:

```tsx
            {product.soldOut && (
              <span className="inline-flex w-fit items-center bg-ink/85 text-cream text-xs font-body font-medium px-2.5 py-1 rounded">
                Sold out
              </span>
            )}
```

(The `AddToCartButton size="lg"` already renders its disabled "Sold out" state from
Step 1, so no change is needed at the button site.)

- [ ] **Step 4: Type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Verify in the preview tool**

On the shop home page, the sold-out sample item (Sapphire Huggie) shows a "Sold out"
badge and a disabled "Sold out" control instead of "Add to Cart". Its detail page
shows the indicator and a disabled large button. A normal item is unchanged and still
adds to cart. Take a screenshot of the grid for the record.

- [ ] **Step 6: Commit**

```bash
git add app/components/AddToCartButton.tsx app/components/ProductCard.tsx app/product/[id]/page.tsx
git commit -m "Storefront: sold-out badge and disabled buy button"
```

---

### Task 4: Cart + checkout — availability re-check and flagging

**Files:**
- Create: `app/lib/availability.ts`
- Modify: `app/components/CartProvider.tsx` (context value + state + effect)
- Modify: `app/components/CartDrawer.tsx` (per-line flag + disable checkout)
- Modify: `app/components/CheckoutForm.tsx` (refresh on mount + flag + disable submit)

- [ ] **Step 1: Create the availability server action**

Create `app/lib/availability.ts`:

```ts
'use server';

import { isSupabaseConfigured, createReadClient } from './supabase';
import { sampleProducts } from '../data/sample';

interface AvailabilityRow {
  id: string;
  sold_out: boolean | null;
  visible: boolean;
}

/**
 * Given cart product ids, return the subset that can no longer be ordered —
 * sold out, hidden, or missing. The cart's localStorage snapshot is never
 * trusted for availability; it is always re-checked here against the source.
 */
export async function getUnavailableProductIds(ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];

  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, sold_out, visible')
      .in('id', unique);
    if (!error && data) {
      const orderable = new Set(
        (data as AvailabilityRow[])
          .filter((p) => p.visible && !p.sold_out)
          .map((p) => p.id),
      );
      return unique.filter((id) => !orderable.has(id));
    }
    // On query failure, don't block the customer — fall through to the sample set.
  }

  const orderable = new Set(
    sampleProducts.filter((p) => p.visible && !p.soldOut).map((p) => p.id),
  );
  return unique.filter((id) => !orderable.has(id));
}
```

- [ ] **Step 2: Extend CartProvider with availability state**

In `app/components/CartProvider.tsx`:

Add the import after the React import block:

```ts
import { getUnavailableProductIds } from '../lib/availability';
```

Add to the `CartContextValue` interface (after `clear: () => void;`):

```ts
  unavailableIds: Set<string>;
  refreshAvailability: () => Promise<void>;
```

Inside `CartProvider`, after the `const [hydrated, setHydrated] = useState(false);` line, add:

```ts
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
```

After the `closeCart` useCallback, add:

```ts
  const refreshAvailability = useCallback(async () => {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) {
      setUnavailableIds(new Set());
      return;
    }
    try {
      const unavailable = await getUnavailableProductIds(ids);
      setUnavailableIds(new Set(unavailable));
    } catch {
      setUnavailableIds(new Set());
    }
  }, [items]);

  // Re-check availability whenever the cart opens (and when items change
  // while it is open). The localStorage snapshot may be stale.
  useEffect(() => {
    if (isOpen) void refreshAvailability();
  }, [isOpen, refreshAvailability]);
```

Add both to the context `value={{ ... }}` object (after `clear,`):

```ts
        unavailableIds,
        refreshAvailability,
```

- [ ] **Step 3: Flag lines and block checkout in the cart drawer**

In `app/components/CartDrawer.tsx`, change the `useCart()` destructure (line 10) to include `unavailableIds`:

```tsx
  const { items, isOpen, closeCart, setQty, removeItem, clear, totalCount, totalPrice, unavailableIds } = useCart();
```

Add, right after that line:

```tsx
  const hasUnavailable = items.some((i) => unavailableIds.has(i.id));
```

Inside the `items.map((item) => ...)` line render, directly after the quantity-stepper
+ price `<div className="flex items-center justify-between mt-2">...</div>` block closes
(before the `</div>` that closes `flex-1 min-w-0`), add:

```tsx
                  {unavailableIds.has(item.id) && (
                    <p className="font-body text-xs text-ink mt-2" role="alert">
                      Sold out — remove to continue.
                    </p>
                  )}
```

In the footer, replace the existing checkout `<Link>` (lines ~165-171) with:

```tsx
            {hasUnavailable ? (
              <span
                aria-disabled="true"
                className="text-center font-body text-sm font-semibold px-5 py-3 rounded bg-cream-dark text-ink-light cursor-not-allowed"
              >
                Remove sold-out items to checkout
              </span>
            ) : (
              <Link
                href="/checkout"
                onClick={closeCart}
                className="text-center cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-5 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
              >
                Checkout
              </Link>
            )}
```

- [ ] **Step 4: Flag lines and block submit on the checkout page**

In `app/components/CheckoutForm.tsx`, change the `useCart()` destructure (line 58) to:

```tsx
  const { items, totalPrice, totalCount, clear, unavailableIds, refreshAvailability } = useCart();
```

After the existing success-handling `useEffect` (ends ~line 69), add:

```tsx
  // Re-check availability when the checkout loads and whenever the cart changes.
  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const hasUnavailable = items.some((i) => unavailableIds.has(i.id));
```

In the summary list, inside `items.map((item) => ...)`, after the
`<p className="font-body text-xs text-ink-light">Qty {item.qty}</p>` line, add:

```tsx
                  {unavailableIds.has(item.id) && (
                    <p className="font-body text-xs text-ink" role="alert">
                      Sold out — remove to continue.
                    </p>
                  )}
```

Change the submit button (line ~144-150) `disabled` prop to also disable when unavailable, and update its label:

```tsx
        <button
          type="submit"
          disabled={isPending || hasUnavailable}
          className="bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed self-start"
        >
          {isPending ? 'Placing order…' : hasUnavailable ? 'Remove sold-out items to continue' : 'Place order'}
        </button>
```

- [ ] **Step 5: Type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Verify in the preview tool**

Add a normal item to the cart, then in admin flag that same item sold out. Reopen the
cart drawer: the line shows "Sold out — remove to continue" and the checkout action is
replaced by a disabled "Remove sold-out items to checkout". Go to `/checkout`: the same
line is flagged and "Place order" is disabled. Removing the line re-enables both.

- [ ] **Step 7: Commit**

```bash
git add app/lib/availability.ts app/components/CartProvider.tsx app/components/CartDrawer.tsx app/components/CheckoutForm.tsx
git commit -m "Cart + checkout: re-check availability and block sold-out items"
```

---

### Task 5: Server-side guard in placeOrder

**Files:**
- Modify: `app/lib/orders.ts:55-89` (the catalogue-rebuild loop + a rejection check)

- [ ] **Step 1: Reject sold-out lines when rebuilding the order**

In `app/lib/orders.ts`, replace the rebuild loop (currently lines ~55-68, from
`const catalogue = await getProducts();` through the end of the `for` loop) with:

```ts
  const catalogue = await getProducts();
  const items: OrderLine[] = [];
  const soldOutNames: string[] = [];
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!product || quantity <= 0) continue;
    if (product.soldOut) {
      soldOutNames.push(product.name);
      continue;
    }
    items.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity,
    });
  }
```

Then, directly after that loop and **before** the existing
`if (items.length === 0) { ... }` check, add:

```ts
  if (soldOutNames.length > 0) {
    const these = soldOutNames.length > 1 ? 'them' : 'it';
    return {
      status: 'error',
      message: `Sorry, ${soldOutNames.join(', ')} just sold out — please remove ${these} from your cart to continue.`,
    };
  }
```

- [ ] **Step 2: Type-check passes**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verify the server guard (defence in depth)**

This proves the guard works even if the UI is bypassed (e.g. an item sells out while
the checkout page is already open, before availability refreshes):

1. In the preview, add a normal item to the cart and open `/checkout` (button enabled).
2. In a separate admin step, flag that item sold out.
3. Return to the already-open checkout page and click "Place order" without reloading.
4. Expected: the order is rejected with the red error banner reading
   "Sorry, <name> just sold out — please remove it from your cart to continue."
   No order row is created.

- [ ] **Step 4: Commit**

```bash
git add app/lib/orders.ts
git commit -m "Reject sold-out items at order placement"
```

---

### Task 6: Full verification, sample reset, and push

**Files:**
- Modify: `app/data/sample.ts` (revert the test-only sold-out flag)

- [ ] **Step 1: Revert the sample test flag**

In `app/data/sample.ts`, change product id `'5'` (Sapphire Huggie) back to
`soldOut: false` so the in-repo sample catalogue ships with nothing sold out
(real sold-out state lives in the DB). All 18 should now be `soldOut: false`.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build completes with no type or lint errors.

- [ ] **Step 3: Commit and push the branch**

```bash
git add app/data/sample.ts
git commit -m "Reset sample catalogue: no items sold out by default"
git push -u origin feat/sold-out
```

- [ ] **Step 4: Owner action note (not a code step)**

Before the live site can use the flag, the migration must be run:
run `supabase/migrations/0005_sold_out.sql` in the Supabase SQL editor. Until then,
`sold_out` reads as `false` everywhere (graceful). After it runs and the branch is
deployed/merged, the owner can flag items from `/admin/products`.

---

## Notes for the implementer
- Sold-out items deliberately remain `visible`, so they keep showing in the shop, in
  "You might also like", and at their detail URL — just badged and un-buyable.
- The availability re-check also catches items that were hidden or deleted after being
  added to a cart, not only sold-out ones.
- Do not introduce a test runner; match the existing `tsc` + `build` + preview workflow.
- Keep all styling on-brand (kraft/cream/ink, Amatic SC + Cabin). The sold-out badge
  uses `bg-ink/85 text-cream` — no red/SaaS colours, per the project quality bar.
