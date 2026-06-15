# Multiple product photos (gallery) — design

_Date: 2026-06-15_

## Problem

The shop owner (Andrew's sister) wants to add **several photos to a product**, so
that shoppers can see more than one angle when they open the product detail page.
Today each product has exactly one photo (`image_url`). She manages photos
herself from the admin panel. This is a presentation/gallery feature, not a
change to inventory or ordering.

## Decisions (confirmed via visual brainstorming)

- **Gallery layout — "thumbnails below".** On the product detail page, a large
  main photo with a row of thumbnails beneath it. Tapping/clicking (or arrow-key +
  Enter on) a thumbnail swaps the main photo; light touch-swipe on the main photo.
  Chosen over a left-side vertical strip and a bare swipe carousel.
- **Admin — one ordered photo grid.** A single grid of all photos for the product.
  The **first photo is the main one** (the shop-grid thumbnail and the first
  gallery image). Chosen over a "main photo + separate extras" split.
- **Reordering — drag and drop.** Drag a photo tile to a new position; this needs
  a small library (`dnd-kit`) for reliable desktop + touch dragging. Chosen over
  dependency-free move-buttons.
- **Cap — up to 6 photos per product.** A single constant, easy to change.
- **`image_url` kept, synced.** Rather than dropping the existing column now, the
  save action keeps it equal to the main photo, so anything still reading it keeps
  working. It can be dropped in a later cleanup.

## Approach

A **single ordered `image_urls text[]` column** is the source of truth, with
`image_urls[0]` as the main photo. This matches the chosen UX exactly ("one
ordered list, first is main, drag to reorder") and keeps the storefront grid
untouched because `Product.image` becomes a *derived* convenience field equal to
`images[0]`.

Reuses patterns already in the codebase:

- the existing Supabase Storage upload flow (`product-images` bucket, service
  client, `getPublicUrl`),
- the `ProductForm` + `parseProduct` server-action submit path,
- the null-safe data mapping used for the sold-out rollout (`?? []`, `?? false`).

Rejected alternatives:

- **Separate `product_images` table** (one-to-many) — adds a join, new RLS
  policies + grants, and a second query everywhere products load; no real gain at
  this scale (a few photos per product, single admin).
- **`image_url` + separate `gallery_urls[]` (head/tail split)** — fights the
  unified "one ordered list" admin UI; you'd constantly split and reassemble, and
  "make this photo the main one" becomes an awkward head/tail swap.
- **Dependency-free move-buttons for reorder** — owner chose drag-and-drop.

## Changes

### 1. Data model

- **Migration `supabase/migrations/0006_product_images.sql`** (also appended to
  `supabase/schema.sql` per repo convention):
  ```sql
  alter table products add column if not exists image_urls text[] not null default '{}';
  -- Backfill the ordered array from the existing single image.
  update products
    set image_urls = array[image_url]
    where image_url is not null and image_url <> '' 
      and (image_urls is null or array_length(image_urls, 1) is null);
  ```
  Run once in the Supabase SQL editor (owner/Andrew). No RLS/grant changes — the
  existing product policies cover the new column. `image_url` is **kept** and the
  save action keeps it synced to `image_urls[0]`.
- `app/data/types.ts`: `Product` keeps `image: string | null` (now documented as
  *derived* = first photo) and gains `images: string[]` (the ordered gallery).
- `app/data/products.ts`: `ProductRow` gains `image_urls: string[] | null`;
  `mapProduct` derives:
  - `images = row.image_urls ?? (row.image_url ? [row.image_url] : [])`
  - `image = images[0] ?? null`
  This is null-safe before the migration runs. **No change** to the `visible`
  filter or any query (`select('*')` already returns the new column).
- `app/data/sample.ts`: each product gains `images: []` (keeps `image: null`).
  Storefront still renders the placeholder until real photos exist.

### 2. Storefront — gallery (detail page only)

- **New client component `app/product/[id]/ProductGallery.tsx`**: props
  `{ images: string[]; alt: string; accentColor: string; category?: string }`.
  - Renders a large main image (reusing `ProductImage` semantics) plus a row of
    thumbnails when `images.length > 1`.
  - Local `useState` for the selected index; clicking/tapping a thumbnail or
    pressing arrow-keys (thumbnails are focusable buttons with `aria-current`)
    swaps the main image; light left/right touch-swipe on the main image.
  - `images.length === 1` → just the single image, no thumbnail strip (today's
    look). `images.length === 0` → the category placeholder (today's behaviour).
  - On-brand: kraft focus ring, active thumbnail outlined in kraft, no rounded-full
    controls, minimal shadow.
- **`app/product/[id]/page.tsx`**: replace the left-half `<ProductImage>` block
  with `<ProductGallery images={product.images} ... />`. The related
  ("You might also like") cards are unchanged.
- **Cards, grid, admin list** (`ProductCard`, admin `page.tsx`): unchanged — they
  read `product.image` (the derived main photo).

### 3. Admin — photo manager

- **New client components** under `app/admin/products/`:
  - `ProductPhotos.tsx` — the ordered grid: existing photos + newly-added files
    (previewed via `URL.createObjectURL`), a `+ Add` tile (multi-file `<input>`),
    `×` to remove a tile, **Main** badge on the first tile, drag to reorder via
    `dnd-kit` (`DndContext` + `SortableContext`, `PointerSensor` + touch support).
  - `SortablePhoto.tsx` — a single sortable tile (`useSortable`).
  - The grid keeps state as an ordered array of items, each either
    `{ kind: 'existing', url }` or `{ kind: 'new', file, previewUrl }`.
- **`ProductForm.tsx`**: replaces the single "Photo" field with `<ProductPhotos>`.
  Because files can't live in hidden inputs, the form uses an `onSubmit` that
  `preventDefault`s, builds a `FormData` (all normal fields + each new `File`
  under `new_image` in order + an `image_order` JSON token list describing the
  final order — existing URLs by value, new files as `new:0`, `new:1`, …), then
  calls the `useActionState` action with that `FormData`. Enforces the 6-photo cap
  client-side with a friendly message.
- **`actions.ts` / `parseProduct`**: read `image_order` (JSON) and the ordered
  `new_image` files. For each token: `new:i` → upload `files[i]` via the existing
  `uploadImage` helper and use the returned URL; otherwise it's an existing URL
  (validated as a string). Result = ordered `image_urls`. Also set
  `image_url = image_urls[0] ?? null` (synced mirror). Re-enforce the 6-photo cap
  and the per-file 8 MB / image-type checks server-side. Surface upload errors the
  same way the single-image flow does today.
- **`uploadImage`**: unchanged (already uploads one file and returns a public URL);
  now called once per new file.

### 4. Dependency

- Add `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities`). Supports
  React 19; per `AGENTS.md`, verify against the installed Next 16 / React 19 during
  implementation and load the sortable grid as a client-only component. If a real
  compatibility blocker appears, fall back to pointer-based native drag **without
  changing the UX or data model**.

## Edge cases

- Product with 1 photo → detail page shows a single image, no thumbnail strip
  (unchanged look); cards unchanged.
- Product with 0 photos → placeholder everywhere (unchanged).
- Removing all photos in admin → `image_urls = '{}'`, `image_url = null` →
  placeholder. Allowed (matches today's "remove photo").
- Reordering so a different photo is first → that photo becomes the card thumbnail
  and `image_url` on next save.
- New files added but never saved → discarded (object URLs revoked on unmount); no
  orphan uploads because uploads happen server-side at save.
- Sold-out / visibility unaffected — independent flags.

## Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds.
- Preview tool: add 3 photos to a product in admin → drag to reorder → first tile
  shows **Main** → save → shop grid uses the new main → detail page shows the
  gallery, thumbnails swap the main image, keyboard + (touch) swipe work → remove a
  photo → save → gallery updates. Single-photo and no-photo products still render
  correctly. No console errors; responsive at mobile + desktop widths.
- Run migration `0006` in Supabase, then verify live after deploy.
- Push → Vercel auto-deploy.

## Out of scope

- Deleting old files from Storage on removal/replace (matches today's behaviour —
  replacing a photo already orphans the old file; a storage-cleanup pass is a
  separate job).
- Per-photo captions / individual alt text (gallery alt = product name, optionally
  suffixed with the photo index).
- Stock quantities, Stripe/email (tracked separately).
