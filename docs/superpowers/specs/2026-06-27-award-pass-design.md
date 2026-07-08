# Award pass — gallery lightbox, scroll motion, owner dashboard, tighten-ups

_Date: 2026-06-27_

## Problem

Phase 1 is complete and reviewed; the owner wants the site raised to an
award-level standard for both shoppers and the owner, with zero AI-tell
patterns. A fresh-eyes audit of every page found the fundamentals strong
(typography, palette, texture, motion, accessibility, empty states, branded
404, admin brand consistency) and identified a short list of genuine gaps.

## Decisions (confirmed with Andrew)

- **Content-dependent items are parked.** A "meet the maker" section and a
  customer contact route are the two biggest trust gaps, but both need content
  from the owner ("neither for now"). They move to the Phase 3 launch
  checklist in ROADMAP.md rather than this pass.
- **Scope of this pass (all four confirmed):** gallery zoom, scroll-stagger
  grid motion, owner upgrades (live dashboard + duplicate product), and a
  tighten-up bundle.
- **Zoom treatment: full lightbox with thumbnails** (chosen over an immersive
  minimal viewer via visual comparison): shoppers comparing jewellery details
  need to jump between photos while zoomed.

## Changes

### 1. Gallery lightbox (`app/product/[id]/GalleryLightbox.tsx`, new)

Client component rendered by `ProductGallery` (which already owns the
selected-index state):

- The main photo (when `images.length > 0`) becomes a `<button>` with
  `cursor-zoom-in` and `aria-label="View photo full screen"`. The category
  placeholder (no photos) is NOT zoomable.
- Open state lives in `ProductGallery`; the lightbox receives
  `{ images, alt, index, onIndexChange, onClose }` so gallery and lightbox
  stay in sync.
- Rendered through `createPortal(document.body)` at `z-[100]` (above header
  `z-50` and the cart drawer), backdrop `bg-ink/95` (solid — no blur).
- Contents: large image via `next/image` (`fill`, `object-contain`,
  `sizes="100vw"`), ‹ › arrow buttons, "n / count" counter, × close button,
  and the thumbnail strip (same visual language as the gallery's strip:
  kraft-outlined active thumb, focus rings).
- Interactions: Esc closes; ArrowLeft/Right navigate; touch-swipe navigates
  (same 40px threshold as the gallery); × and backdrop click close. Focus is
  trapped inside while open and returned to the main-photo button on close.
  Body scroll locked while open (restore on unmount).
- Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-label` naming the
  product. Thumbnails are buttons with `aria-current`, arrows and close have
  labels.
- Motion: a short opacity fade only (no scale/slide); the global
  reduced-motion rule makes it instant.
- Single photo: lightbox still opens (zoom is the point); arrows/thumbnails
  hidden when `count === 1`.

### 2. Scroll-stagger grid reveal (`app/components/ShopContent.tsx` + `app/globals.css`)

Extends the existing `.reveal` load-motion language to below-fold cards:

- Progressive enhancement: cards render fully visible in HTML. On mount, an
  IntersectionObserver marks only cards **below the initial viewport** as
  pending (opacity 0 / translateY(14px) via a class), then reveals each card
  the first time it intersects (class swap → CSS transition, 0.5s, same
  easing as `blg-rise`), with a small stagger by column position
  (`transitionDelay = (index % 3) * 60ms`).
- Once-only: revealed cards are unobserved; filtering/category switches never
  re-hide or re-animate cards. New cards appearing due to a filter change
  render visible (no pending state applied after initial load).
- No-JS: nothing is ever hidden. Reduced motion: the existing global rule
  zeroes the transition, so cards appear instantly.

### 3. Live owner dashboard (`app/admin/page.tsx` + `app/admin/queries.ts`, new)

`/admin` becomes glanceable while keeping the existing card language (white
cards, cream-dark borders, Amatic headings — no SaaS dashboard styling):

- **Stat tiles** (each links to its section):
  - Products — total count, with "n sold out" as the secondary line when any
    are (products table, authenticated session client).
  - Orders — count of status `'new'`, secondary "awaiting action"; 0 state
    reads "No new orders".
  - Labels — counts of categories/colours as the secondary line.
- **Latest orders**: the 5 newest orders (reference `BLG-n`, customer name,
  £total, status badge, en-GB date), each row linking to `/admin/orders`.
  Empty state: "No orders yet — they'll appear here."
- Data via a new `app/admin/queries.ts` (`getDashboardStats()`), running on
  the authenticated session (RLS), resilient: any query error renders the
  shell with em-dash placeholders rather than crashing.

### 4. Duplicate product (`app/admin/products/actions.ts` + `DuplicateProductButton.tsx`, new)

- Server action `duplicateProduct(id): Promise<{ id?: string; error?: string }>`:
  `requireUser()`, fetch the source row, insert a copy with
  `name: `${name} (copy)``, `visible: false`, `sold_out` copied as-is, same
  category/subcategory/colour/price/description/accent, `image_url` +
  `image_urls` copied by URL (no storage duplication — deleting a product
  never deletes storage files today, so shared URLs are safe), `sort_order`
  at the end. Returns the new id; checks and returns the Supabase `error`
  (same hardened pattern as the other actions). Revalidates
  `/admin/products` only (the copy is hidden, the shop is unaffected).
- Client `DuplicateProductButton` in each product-list row (quiet text-button
  style matching Edit/Delete): pending state "Duplicating…", inline
  `role="alert"` error on failure, and on success `router.push` to
  `/admin/products/{newId}/edit` so the owner renames it immediately.

### 5. Tighten-up bundle

- **Footer (`app/components/Footer.tsx`)**: brand close — "BLG Creations" in
  the heading face with the tagline "Handmade jewellery & gifts" above the
  © row; "Sign in" kept but visually quieter. No category links (they would
  require URL-driven filter state — out of scope, no shopper value at this
  catalogue size).
- **`noindex`**: `robots: { index: false, follow: false }` metadata on
  `/checkout` and `/checkout/success`.
- **Cart hydration validation (`app/components/CartProvider.tsx`)**: validate
  each stored item on load (string `id`/`name`, finite `price >= 0`, integer
  `1 <= qty <= 99`, `image` string-or-null, string `categorySlug`); drop
  invalid entries silently. Kills the £NaN edge case from corrupted/legacy
  localStorage.
- **Grain dedupe (`app/globals.css`)**: the two noise data-URIs move to
  adjacent named custom properties (`--grain-soft`, `--grain-strong`) on
  `:root`; `body` and `.surface-ink` reference the variables. No visual
  change.
- **Filter-active single source**: `ShopContent` passes `activeFilterCount`
  to `FilterBar`; FilterBar derives `hasActiveFilters = count > 0` and drops
  its own duplicate boolean logic.
- **Delete `app/lib/clearinvoice.ts`**: dead code with a misleading header
  comment; the Path 2 concept stays documented in ROADMAP.md and git history
  keeps the implementation.
- **ROADMAP.md**: add "About the maker section + customer contact route —
  needs content from the owner" to the Phase 3 launch-readiness list.

## Edge cases

- Lightbox with 1 photo: opens, no arrows/thumbnails/counter.
- Lightbox vs cart drawer: portal + `z-[100]` guarantees stacking; the cart
  can't be opened while the dialog traps focus.
- Scroll-stagger with few products: if everything fits in the viewport,
  nothing is marked pending and behavior is identical to today.
- Duplicate of a sold-out/hidden product: copies flags as-is; copy is always
  `visible: false` regardless.
- Dashboard with DB unavailable: tiles render with placeholders, no crash.
- Duplicate name collisions ("x (copy)" twice) are allowed — names aren't
  unique anywhere else either.

## Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds (per task).
- Preview: lightbox open/navigate/Esc/backdrop-close/focus-return at desktop
  + mobile widths; swipe path exercised via touch events; scroll-stagger
  reveals below-fold cards once and never re-triggers on filtering; footer
  renders at both widths; cart survives a corrupted localStorage payload.
- Dashboard + duplicate are auth-gated: verified via build + code review and
  the shared hardened-action pattern; owner-validated live after deploy
  (same approach as all prior admin features).
- Push → Vercel auto-deploy; live smoke test of the storefront surfaces.

## Out of scope

- "Meet the maker" + contact route (parked → Phase 3 checklist).
- URL-driven filters / footer category links.
- Sold-out "notify me", product badges, search (Phase 4 candidates).
- Any Stripe/email work (Phase 2, separately planned).
