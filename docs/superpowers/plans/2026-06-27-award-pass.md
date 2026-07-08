# Award pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the shop to award-level polish: a full-screen gallery lightbox, scroll-staggered grid motion, a live owner dashboard, a duplicate-product action, and a bundle of small tighten-ups.

**Architecture:** Storefront additions are client components extending existing patterns (`ProductGallery` gains a portal-rendered lightbox; `ShopContent` gains an IntersectionObserver reveal). Admin additions reuse the hardened server-action pattern (`{ error?: string }` returns, `requireUser()`, inline `role="alert"` errors) and the existing admin card language. Spec: `docs/superpowers/specs/2026-06-27-award-pass-design.md`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4, Supabase.

> **VERIFICATION CONVENTION — READ FIRST.** This project has **no unit-test runner**. Do NOT add one or write test files. Every task is verified with `npx tsc --noEmit` (clean), `npm run build` (succeeds), and — for storefront-visible changes — the Claude Preview MCP tools. Admin pages need auth + Supabase and cannot be driven in local preview; they are verified by tsc/build/code review and validated live by the owner after deploy.
>
> **Brand rules (no AI tells):** kraft `#B5865A` / cream `#FDF8F0` / ink `#1A1A1A`; Amatic SC headings (`font-heading`), Cabin body (`font-body`); no glassmorphism/backdrop-blur; no `rounded-full` on controls (swatches + the in-stock switch are the only exceptions); minimal shadows; plain human copy. Per `AGENTS.md`, consult `node_modules/next/dist/docs/` before using framework APIs you're unsure of.

---

## File structure

**Create:**
- `app/product/[id]/GalleryLightbox.tsx` — full-screen photo dialog (portal).
- `app/admin/queries.ts` — `getDashboardStats()` for the admin dashboard.
- `app/admin/products/DuplicateProductButton.tsx` — client button for the duplicate action.

**Modify:**
- `app/product/[id]/ProductGallery.tsx` — main photo becomes a zoom button; owns lightbox open state.
- `app/components/ShopContent.tsx` — scroll-stagger observer; pass `activeFilterCount` to FilterBar.
- `app/components/FilterBar.tsx` — receive `activeFilterCount` instead of re-deriving.
- `app/components/CartProvider.tsx` — validate hydrated cart items.
- `app/components/Footer.tsx` — brand closing treatment.
- `app/globals.css` — grain custom properties, `blg-fade` keyframe, card reveal classes.
- `app/checkout/page.tsx`, `app/checkout/success/page.tsx` — `robots` noindex.
- `app/admin/page.tsx` — live dashboard.
- `app/admin/products/actions.ts` — `duplicateProduct` action.
- `app/admin/products/page.tsx` — render `DuplicateProductButton`.
- `ROADMAP.md` — Phase 3 checklist gains the parked about/contact item.

**Delete:**
- `app/lib/clearinvoice.ts` — dead code (concept documented in ROADMAP; git history keeps it).

---

## Task 1: Tighten-up bundle

**Files:**
- Modify: `app/components/Footer.tsx`, `app/globals.css`, `app/components/CartProvider.tsx`, `app/components/ShopContent.tsx`, `app/components/FilterBar.tsx`, `app/checkout/page.tsx`, `app/checkout/success/page.tsx`, `ROADMAP.md`
- Delete: `app/lib/clearinvoice.ts`

- [ ] **Step 1: Footer brand close**

Replace the entire contents of `app/components/Footer.tsx` with:

```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-cream-dark py-10 px-4 text-center">
      <p className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</p>
      <p className="font-body text-[10px] sm:text-xs font-medium tracking-[0.2em] uppercase text-ink-light mt-1.5">
        Handmade Jewellery &amp; Gifts
      </p>
      <p className="font-body text-xs text-ink-light mt-5">
        © {new Date().getFullYear()} BLG Creations · All rights reserved
        <span aria-hidden="true"> · </span>
        <Link
          href="/admin/login"
          className="text-ink-light/60 hover:text-kraft underline underline-offset-2 transition-colors duration-150"
        >
          Sign in
        </Link>
      </p>
    </footer>
  );
}
```

- [ ] **Step 2: Grain custom properties in `app/globals.css`**

In the `:root` block, add after the existing colour tokens (keep everything else):

```css
  /* Paper grain (SVG fractal noise). Soft = the cream page surface; strong =
     the dark hero. Same tile, different baked-in opacity. */
  --grain-soft: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E");
  --grain-strong: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
```

Then change the `body` rule's `background-image:` line to:

```css
  background-image: var(--grain-soft);
```

and the `.surface-ink` rule's `background-image:` to:

```css
  background-image:
    var(--grain-strong),
    radial-gradient(120% 95% at 50% -10%, rgba(181, 134, 90, 0.18), transparent 55%);
```

(The long inline data-URIs previously on `body` and `.surface-ink` are removed — the variables replace them. No visual change.)

- [ ] **Step 3: Cart hydration validation**

In `app/components/CartProvider.tsx`, add this function just below the `STORAGE_KEY` constant:

```ts
// Persisted carts can be stale (old schema) or hand-edited; a malformed item
// would poison the totals with NaN. Validate each one and drop the rest.
function isValidItem(v: unknown): v is CartItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.name === 'string' &&
    typeof o.price === 'number' &&
    Number.isFinite(o.price) &&
    o.price >= 0 &&
    typeof o.accentColor === 'string' &&
    typeof o.categorySlug === 'string' &&
    (o.image === null || typeof o.image === 'string') &&
    typeof o.qty === 'number' &&
    Number.isInteger(o.qty) &&
    o.qty >= 1 &&
    o.qty <= 99
  );
}
```

Then in the hydration effect, change:

```ts
        if (Array.isArray(parsed)) dispatch({ type: 'hydrate', items: parsed });
```

to:

```ts
        if (Array.isArray(parsed)) {
          dispatch({ type: 'hydrate', items: parsed.filter(isValidItem) });
        }
```

- [ ] **Step 4: Filter-active single source**

In `app/components/FilterBar.tsx`:
- In `FilterBarProps`, add `activeFilterCount: number;` after `inStockOnly: boolean;`.
- Add `activeFilterCount,` to the destructured parameters (after `inStockOnly,`).
- Replace:

```ts
  // Category lives in the tabs above the grid; this panel only refines.
  const hasActiveFilters =
    selectedSubcategory !== 'all' || selectedColour !== 'all' || inStockOnly;
```

with:

```ts
  // Category lives in the tabs above the grid; this panel only refines.
  // The count comes from ShopContent so the two never drift.
  const hasActiveFilters = activeFilterCount > 0;
```

In `app/components/ShopContent.tsx`, in the `<FilterBar` JSX, add the prop `activeFilterCount={activeFilterCount}` on the line after `inStockOnly={inStockOnly}`.

- [ ] **Step 5: noindex on checkout pages**

In `app/checkout/page.tsx` and `app/checkout/success/page.tsx`, add this property inside the existing `export const metadata: Metadata = { ... }` object literal (after the existing properties):

```ts
  robots: { index: false, follow: false },
```

- [ ] **Step 6: Delete dead module + ROADMAP note**

```bash
git rm app/lib/clearinvoice.ts
```

In `ROADMAP.md`, in the **Phase 3 — Launch readiness → go live** bullet list, add after the "Legal / policy pages" bullet:

```markdown
- **About the maker + contact route** — a short "meet the maker" section and a
  customer contact link. Needs content from the owner (her words + a shop email;
  photo optional). Parked from the 2026-06-27 award pass — the two biggest
  remaining trust gaps for a handmade shop.
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds. (Grep check: `grep -r "clearinvoice" app/` → no hits.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Tighten-ups: footer brand close, cart validation, grain vars, filter single-source, checkout noindex, drop dead clearinvoice module" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Gallery lightbox

**Files:**
- Create: `app/product/[id]/GalleryLightbox.tsx`
- Modify: `app/product/[id]/ProductGallery.tsx`, `app/globals.css`

- [ ] **Step 1: `blg-fade` keyframe**

In `app/globals.css`, immediately after the `blg-rise` keyframes block, add:

```css
@keyframes blg-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

(The global `prefers-reduced-motion` rule already zeroes animation durations, so no extra handling is needed.)

- [ ] **Step 2: Create `app/product/[id]/GalleryLightbox.tsx`**

```tsx
'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface GalleryLightboxProps {
  images: string[];
  alt: string;
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

// Full-screen photo viewer over a deep-ink backdrop. Rendered through a portal
// (z-[100], above the header and cart drawer). Esc closes, arrows navigate,
// focus stays trapped inside; the opener restores focus on close.
export function GalleryLightbox({ images, alt, index, onIndexChange, onClose }: GalleryLightboxProps) {
  const count = images.length;
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  function step(delta: number) {
    onIndexChange(((index + delta) % count + count) % count);
  }

  // Lock page scroll while open and move focus into the dialog.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
      return;
    }
    if (e.key === 'Tab') {
      // Keep focus cycling inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  }

  const controlClass =
    'cursor-pointer flex items-center justify-center rounded bg-cream/10 border border-cream/30 text-cream hover:bg-cream/20 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${alt}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[100] bg-ink/95 flex flex-col focus:outline-none"
      style={{ animation: 'blg-fade 0.2s ease-out both' }}
    >
      {/* Top bar: counter + close */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-body text-sm text-cream/75 tabular-nums" aria-live="polite">
          {count > 1 ? `${index + 1} / ${count}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photo viewer" className={`${controlClass} h-10 w-10 text-xl leading-none`}>
          ×
        </button>
      </div>

      {/* Photo area — clicking the backdrop (not the photo) closes */}
      <div
        className="relative flex-1 min-h-0 mx-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <Image
          src={images[index]}
          alt={`${alt} — photo ${index + 1} of ${count}`}
          fill
          sizes="100vw"
          className="object-contain pointer-events-none"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className={`${controlClass} absolute left-0 top-1/2 -translate-y-1/2 h-11 w-11 text-2xl`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className={`${controlClass} absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 text-2xl`}
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <ul className="flex justify-center gap-2 px-4 py-4 list-none m-0 overflow-x-auto">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="flex-shrink-0">
              <button
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                className={`relative block h-14 w-14 overflow-hidden rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
                  i === index ? 'border-kraft ring-1 ring-kraft' : 'border-cream/30 hover:border-kraft-light'
                }`}
              >
                <Image src={src} alt="" fill sizes="56px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
```

- [ ] **Step 3: Wire into `app/product/[id]/ProductGallery.tsx`**

Make these exact changes:

1. Update the React import line to include the new hook usage (it already imports `useRef, useState` — no change needed) and add the lightbox import after the `ProductImage` import:

```tsx
import { GalleryLightbox } from './GalleryLightbox';
```

2. Inside the component, after the `thumbRefs` line, add:

```tsx
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const zoomBtnRef = useRef<HTMLButtonElement>(null);
```

3. Replace the main-image block (the `<div className="relative overflow-hidden aspect-square ...">…</div>` containing `<ProductImage …/>`) with:

```tsx
      <div
        className="relative overflow-hidden aspect-square w-full rounded-lg border border-cream-dark flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}12` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {count > 0 ? (
          <button
            type="button"
            ref={zoomBtnRef}
            onClick={() => setLightboxOpen(true)}
            aria-label="View photo full screen"
            className="relative block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-inset"
          >
            <ProductImage
              image={current}
              accentColor={accentColor}
              category={category}
              alt={count > 1 ? `${alt} — photo ${safeIndex + 1} of ${count}` : alt}
              sizes="(max-width: 1024px) 100vw, 50vw"
              iconClassName="w-40 h-60"
              priority
            />
          </button>
        ) : (
          <ProductImage
            image={current}
            accentColor={accentColor}
            category={category}
            alt={alt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            iconClassName="w-40 h-60"
            priority
          />
        )}
      </div>
```

4. At the end of the returned JSX, just before the closing `</div>` of the outer wrapper, add:

```tsx
      {lightboxOpen && count > 0 && (
        <GalleryLightbox
          images={images}
          alt={alt}
          index={safeIndex}
          onIndexChange={select}
          onClose={() => {
            setLightboxOpen(false);
            zoomBtnRef.current?.focus();
          }}
        />
      )}
```

- [ ] **Step 4: Verify (types + build)**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds.

- [ ] **Step 5: Runtime verification (preview, temporary sample images)**

The controller runs this (needs temporary test data): give sample product '1' three picsum URLs in `app/data/sample.ts` and temporarily add picsum hosts to `next.config.ts` remotePatterns (same as the gallery task in the 2026-06-15 plan); `preview_start`; open `/product/1`; click the main photo → dialog opens showing "1 / 3", arrows + thumbnails render; ArrowRight advances; Esc closes and focus returns to the photo button; backdrop click closes; body scroll locked while open; `preview_console_logs` clean; **revert both temporary edits**; `preview_stop`.

- [ ] **Step 6: Commit**

```bash
git add "app/product/[id]/GalleryLightbox.tsx" "app/product/[id]/ProductGallery.tsx" app/globals.css
git commit -m "Add full-screen gallery lightbox (thumbnails, arrows, focus trap)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Scroll-stagger grid reveal

**Files:**
- Modify: `app/globals.css`, `app/components/ShopContent.tsx`

- [ ] **Step 1: Reveal classes in `app/globals.css`**

After the `.reveal` rule, add:

```css
/* Below-fold product cards: JS marks them pending after load (progressive
   enhancement — nothing is hidden without JS), then reveals on first
   intersection. Reduced-motion users never get the pending state. */
.card-pending {
  opacity: 0;
  transform: translateY(14px);
}
.card-in {
  opacity: 1;
  transform: none;
  transition:
    opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: Observer in `app/components/ShopContent.tsx`**

1. Change the React import to include the new hooks:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
```

2. Inside the component, after the existing `useState` declarations, add:

```tsx
  const gridRef = useRef<HTMLDivElement>(null);
```

3. After the `badgeFor` function, add:

```tsx
  // Reveal below-fold cards the first time they scroll into view — extends the
  // page-load rise-in. Runs once per mount: cards rendered later (filtering)
  // are never marked pending, and reduced-motion users skip it entirely.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = Array.from(grid.children) as HTMLElement[];
    const below = cards.filter(
      (c) => c.getBoundingClientRect().top > window.innerHeight,
    );
    if (below.length === 0) return;

    below.forEach((c) => c.classList.add('card-pending'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const col = Array.prototype.indexOf.call(grid.children, el) % 3;
          el.style.transitionDelay = `${col * 60}ms`;
          el.classList.add('card-in');
          el.classList.remove('card-pending');
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -5% 0px' },
    );
    below.forEach((c) => io.observe(c));
    return () => {
      io.disconnect();
      below.forEach((c) => c.classList.remove('card-pending'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

4. Attach the ref to the product grid — change:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
```

to:

```tsx
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
```

(Note: the empty-state branch means the grid may not exist on mount if there are no products — the `if (!grid…) return;` guard covers that. Each `ProductCard` renders an `<article>` as the grid child, so `grid.children` are the cards.)

- [ ] **Step 3: Verify (types + build)**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds.

- [ ] **Step 4: Runtime verification (preview)**

Controller: `preview_start`; load `/`; via `preview_eval` confirm (a) cards below the fold have `card-pending` right after load, (b) after `window.scrollTo` toward the bottom + a short wait, those cards have `card-in` and computed `opacity === '1'`, (c) switching category tabs leaves all rendered cards fully visible (no `card-pending` on any), (d) console clean. `preview_stop`.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/components/ShopContent.tsx
git commit -m "Reveal below-fold product cards on first scroll into view" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Live owner dashboard

**Files:**
- Create: `app/admin/queries.ts`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create `app/admin/queries.ts`**

```ts
import { createServerSupabase } from '../lib/supabase-server';

export interface DashboardOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  subtotal: number;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  productCount: number | null;
  soldOutCount: number | null;
  newOrderCount: number | null;
  categoryCount: number | null;
  colourCount: number | null;
  latestOrders: DashboardOrder[];
}

const EMPTY: DashboardStats = {
  productCount: null,
  soldOutCount: null,
  newOrderCount: null,
  categoryCount: null,
  colourCount: null,
  latestOrders: [],
};

// Glanceable numbers for /admin. Runs on the signed-in session (RLS), and any
// failure degrades to null counts — the dashboard renders placeholders rather
// than crashing.
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = await createServerSupabase();
    const head = { count: 'exact' as const, head: true };
    const [products, soldOut, newOrders, categories, colours, latest] = await Promise.all([
      supabase.from('products').select('*', head),
      supabase.from('products').select('*', head).eq('sold_out', true),
      supabase.from('orders').select('*', head).eq('status', 'new'),
      supabase.from('categories').select('*', head),
      supabase.from('colours').select('*', head),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, subtotal, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    return {
      productCount: products.count ?? null,
      soldOutCount: soldOut.count ?? null,
      newOrderCount: newOrders.count ?? null,
      categoryCount: categories.count ?? null,
      colourCount: colours.count ?? null,
      latestOrders: (latest.data ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        subtotal: Number(o.subtotal),
        status: o.status,
        createdAt: o.created_at,
      })),
    };
  } catch {
    return EMPTY;
  }
}
```

- [ ] **Step 2: Rewrite the dashboard body in `app/admin/page.tsx`**

Keep the file's imports/header/auth exactly as they are, with two changes: add the import

```tsx
import { getDashboardStats } from './queries';
```

and inside `AdminPage`, after the `if (!user) redirect('/admin/login');` line, add:

```tsx
  const stats = await getDashboardStats();
  const n = (v: number | null) => (v === null ? '—' : String(v));
```

Then DELETE the `SECTIONS` constant and replace everything inside `<main>…</main>` with:

```tsx
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <h2 className="font-heading text-4xl font-bold text-ink">Welcome back</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Link
            href="/admin/products"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Products</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">{n(stats.productCount)}</p>
            <p className="font-body text-sm text-ink-light">
              {stats.soldOutCount ? `${stats.soldOutCount} sold out` : 'All in stock'}
            </p>
          </Link>

          <Link
            href="/admin/orders"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">New orders</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">{n(stats.newOrderCount)}</p>
            <p className="font-body text-sm text-ink-light">
              {stats.newOrderCount ? 'Awaiting action' : 'Nothing waiting'}
            </p>
          </Link>

          <Link
            href="/admin/labels"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Labels</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">
              {stats.categoryCount === null ? '—' : stats.categoryCount + (stats.colourCount ?? 0)}
            </p>
            <p className="font-body text-sm text-ink-light">
              {stats.categoryCount === null
                ? 'Categories & colours'
                : `${stats.categoryCount} categories · ${stats.colourCount ?? 0} colours`}
            </p>
          </Link>
        </div>

        <section aria-label="Latest orders" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-2xl font-bold text-ink">Latest orders</h3>
            <Link
              href="/admin/orders"
              className="font-body text-sm text-kraft-dark hover:text-kraft transition-colors duration-150"
            >
              View all
            </Link>
          </div>
          {stats.latestOrders.length === 0 ? (
            <p className="font-body text-sm text-ink-light bg-white border border-cream-dark rounded-lg px-4 py-6 text-center">
              No orders yet — they&apos;ll appear here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.latestOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href="/admin/orders"
                    className="bg-white border border-cream-dark rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-kraft transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
                  >
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">BLG-{o.orderNumber}</span>
                    <span className="font-body text-sm text-ink flex-1 min-w-[8rem]">{o.customerName}</span>
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">£{o.subtotal.toFixed(2)}</span>
                    <span className="font-body text-xs font-medium capitalize bg-cream-dark border border-kraft-light text-ink-light px-2 py-0.5 rounded">
                      {o.status}
                    </span>
                    <span className="font-body text-xs text-ink-light">
                      {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds. (Auth-gated page: runtime is owner-validated after deploy.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/queries.ts app/admin/page.tsx
git commit -m "Make the admin dashboard glanceable: live counts + latest orders" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Duplicate product

**Files:**
- Modify: `app/admin/products/actions.ts`, `app/admin/products/page.tsx`
- Create: `app/admin/products/DuplicateProductButton.tsx`

- [ ] **Step 1: Server action**

In `app/admin/products/actions.ts`, add after `toggleSoldOut`:

```ts
export async function duplicateProduct(id: string): Promise<{ id?: string; error?: string }> {
  const supabase = await requireUser();

  const { data: source, error: readError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (readError || !source) {
    return { error: `Could not load the product: ${readError?.message ?? 'not found'}` };
  }

  const { data: last } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  // The copy shares photo URLs (nothing ever deletes storage files, so that is
  // safe) and stays hidden until the owner has renamed and reviewed it.
  const { data: created, error } = await supabase
    .from('products')
    .insert({
      name: `${source.name} (copy)`,
      description: source.description,
      price: source.price,
      category_slug: source.category_slug,
      subcategory_slug: source.subcategory_slug,
      colour_slug: source.colour_slug,
      accent_color: source.accent_color,
      image_url: source.image_url,
      image_urls: source.image_urls,
      visible: false,
      sold_out: source.sold_out,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single();
  if (error || !created) {
    return { error: `Could not duplicate: ${error?.message ?? 'no row returned'}` };
  }

  revalidatePath('/admin/products');
  return { id: created.id };
}
```

- [ ] **Step 2: Create `app/admin/products/DuplicateProductButton.tsx`**

```tsx
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
```

- [ ] **Step 3: Wire into the product list**

In `app/admin/products/page.tsx`: add the import

```tsx
import { DuplicateProductButton } from './DuplicateProductButton';
```

and in the actions cell (`<div className="flex items-center gap-3">`), add `<DuplicateProductButton id={p.id} />` before the Edit `<Link>`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → succeeds. (Auth-gated: owner validates live after deploy — duplicate a product, confirm it lands hidden with "(copy)" and opens in edit.)

- [ ] **Step 5: Commit**

```bash
git add app/admin/products/actions.ts app/admin/products/DuplicateProductButton.tsx app/admin/products/page.tsx
git commit -m "Add one-click product duplication (hidden copy, straight to edit)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Holistic verification + finish

**Files:** none (verification; possibly reverts of temporary test data).

- [ ] **Step 1: Confirm no temporary test data remains**

`git status` must show a clean tree; `app/data/sample.ts` product '1' has `images: []`; `next.config.ts` has only the Supabase remotePattern.

- [ ] **Step 2: Full storefront preview pass**

`preview_start`; walk `/` (footer brand close, scroll-stagger, filters incl. "Clear filters" badge parity), a product page (gallery + lightbox against live photos — real Supabase images need no config changes), cart drawer open/close with the lightbox closed, mobile width for all of the above; console clean throughout; `preview_stop`.

- [ ] **Step 3: Final `tsc` + `build`**

Both clean.

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch (merge to `main`, verify, push — deploys via Vercel). After deploy: live smoke test of `/` and a product page; owner validates dashboard + duplicate on her next sign-in.

---

## Self-review (completed by plan author)

- **Spec coverage:** lightbox incl. single-photo/no-photo/portal/focus/scroll-lock (Task 2) ✓; scroll-stagger with progressive enhancement + reduced-motion skip + once-only (Task 3) ✓; dashboard tiles + latest orders + resilient nulls (Task 4) ✓; duplicate with hidden copy → edit redirect (Task 5) ✓; footer, noindex, cart validation, grain vars, filter single source, clearinvoice deletion, ROADMAP note (Task 1) ✓; verification + finish (Task 6) ✓.
- **Placeholder scan:** none — every code step shows complete code; verification uses the project's real commands.
- **Type consistency:** `GalleryLightboxProps` matches the call site in Task 2 step 3; `DashboardStats`/`DashboardOrder` match the page usage; `duplicateProduct` return `{ id?, error? }` matches the button; `activeFilterCount` prop name identical in FilterBar and ShopContent; `isValidItem` uses the existing `CartItem` fields exactly.
