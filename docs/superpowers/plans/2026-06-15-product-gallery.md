# Multiple product photos (gallery) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the shop owner attach several photos to a product and let shoppers browse them in a thumbnail gallery on the product detail page.

**Architecture:** A single ordered `image_urls text[]` column on `products` is the source of truth (`image_urls[0]` = main photo). `Product.image` becomes a *derived* convenience field (`images[0]`), so the shop grid and cards need no changes; a new `Product.images` array feeds the detail-page gallery. The admin gets a drag-to-reorder photo grid (`dnd-kit`); on submit the form sends the final order as a token list plus the new files, and the server action uploads new files and writes the ordered array (keeping the legacy `image_url` synced to the main photo).

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4, Supabase (Postgres + Storage), `@dnd-kit/*`.

> **VERIFICATION CONVENTION — READ FIRST.** This project has **no unit-test runner** (no Jest/Vitest/pytest). Do **not** add one or write test files. Every task is verified with:
> - `npx tsc --noEmit` (types clean)
> - `npm run build` (production build succeeds)
> - the Claude Preview MCP tools (`preview_start`, `preview_eval`, `preview_snapshot`, `preview_screenshot`, `preview_console_logs`, `preview_resize`, `preview_stop`) for runtime/visual checks
>
> Locally (no Supabase env) the app serves the in-repo **sample catalogue** (`app/data/sample.ts`), so previews exercise sample data. The live database migration is run manually by the owner (see Task 6).
>
> **Brand rules (no "AI tells"):** Kraft `#B5865A` / cream `#FDF8F0` / ink `#1A1A1A`; Amatic SC headings, Cabin body; no glassmorphism; no `rounded-full` on controls except swatches; minimal shadows; "Main"/"Sold out" badges use `bg-ink/85 text-cream` (never red). Per `AGENTS.md`, this is a modified Next.js — consult `node_modules/next/dist/docs/` before using framework APIs you're unsure about.

---

## File structure

**Create:**
- `supabase/migrations/0006_product_images.sql` — add the `image_urls` column + backfill.
- `app/product/[id]/ProductGallery.tsx` — client gallery (main image + thumbnail strip).
- `app/admin/products/SortablePhoto.tsx` — a single draggable photo tile.
- `app/admin/products/ProductPhotos.tsx` — the drag-to-reorder photo grid + add/remove.

**Modify:**
- `supabase/schema.sql` — mirror the new column (repo convention).
- `app/data/types.ts` — add `images` to `Product`; add `MAX_PRODUCT_PHOTOS`.
- `app/data/products.ts` — `ProductRow.image_urls`; derive `image`/`images` in `mapProduct`.
- `app/data/sample.ts` — `images: []` on every sample product.
- `app/product/[id]/page.tsx` — render `<ProductGallery>` instead of the single image.
- `app/admin/products/ProductForm.tsx` — replace the single Photo field with `<ProductPhotos>`; build `FormData` on submit.
- `app/admin/products/actions.ts` — `parseProduct` resolves the token list + new files into `image_urls`; sync `image_url`.
- `package.json` — add `@dnd-kit/*`.

---

## Task 1: Data model — column, schema, types, mapping, sample

**Files:**
- Create: `supabase/migrations/0006_product_images.sql`
- Modify: `supabase/schema.sql` (products table, ~line 40)
- Modify: `app/data/types.ts`
- Modify: `app/data/products.ts`
- Modify: `app/data/sample.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_product_images.sql`:

```sql
-- 0006_product_images.sql
-- Add an ordered gallery of photo URLs. image_urls[1] (Postgres 1-indexed) is
-- the main photo; the legacy single image_url column is kept and synced to it by
-- the admin save action.
alter table products add column if not exists image_urls text[] not null default '{}';

-- Backfill the array from the existing single image for products that have one.
update products
   set image_urls = array[image_url]
 where image_url is not null
   and image_url <> ''
   and (image_urls is null or array_length(image_urls, 1) is null);
```

- [ ] **Step 2: Mirror the column in `supabase/schema.sql`**

In the `create table if not exists products (...)` block, add the `image_urls` line immediately after the `image_url` line:

```sql
  image_url        text,                              -- null = show placeholder (legacy single photo; synced to image_urls[1])
  image_urls       text[] not null default '{}',      -- ordered gallery; image_urls[1] = main photo
  visible          boolean not null default true,
```

- [ ] **Step 3: Add `images` to the `Product` type and a shared cap constant**

In `app/data/types.ts`, update the `Product` interface's image field and add `images`, then add the constant at the end of the file:

```ts
  /** Main photo (derived = images[0]), or null to show the placeholder. */
  image: string | null;
  /** Ordered gallery photos; images[0] is the main photo. */
  images: string[];
```

At the end of `app/data/types.ts`:

```ts
/** Maximum photos a product may have (admin + server both enforce this). */
export const MAX_PRODUCT_PHOTOS = 6;
```

- [ ] **Step 4: Update `ProductRow` and `mapProduct` in `app/data/products.ts`**

Add `image_urls` to `ProductRow` (after `image_url`):

```ts
  image_url: string | null;
  image_urls: string[] | null;
```

Replace the `mapProduct` function body so `image`/`images` are derived (null-safe before the migration runs):

```ts
export function mapProduct(row: ProductRow): Product {
  const images = row.image_urls ?? (row.image_url ? [row.image_url] : []);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    categorySlug: row.category_slug,
    subcategorySlug: row.subcategory_slug,
    colourSlug: row.colour_slug,
    accentColor: row.accent_color ?? '#B5865A',
    image: images[0] ?? null,
    images,
    visible: row.visible,
    soldOut: row.sold_out ?? false,
    sortOrder: row.sort_order ?? 0,
  };
}
```

- [ ] **Step 5: Add `images: []` to every sample product**

In `app/data/sample.ts`, every object in `sampleProducts` already has `image: null`. Add `images: []` immediately after each `image: null,` so each item satisfies the updated `Product` type. Example for id '1':

```ts
  { id: '1', name: 'Classic Gold Hoops', price: 28, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'gold', description: 'Simple and elegant 14K gold-filled hoops, perfect for everyday wear.', accentColor: '#D4A853', image: null, images: [], visible: true, soldOut: false, sortOrder: 1 },
```

Do this for all 18 products (ids '1'–'18').

- [ ] **Step 6: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds. (If `tsc` flags a sample product missing `images`, add it.)

- [ ] **Step 7: Verify the storefront still renders (derived main photo)**

Start the preview and confirm the grid + a product detail page still render (sample products show placeholders; nothing should change visually yet).

- `preview_start` (command: `dev`)
- `preview_snapshot` of `/` → product cards present, no errors.
- `preview_console_logs` → no errors.
- `preview_stop`

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0006_product_images.sql supabase/schema.sql app/data/types.ts app/data/products.ts app/data/sample.ts
git commit -m "Add ordered image_urls column + derived Product.images" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Detail-page gallery component

**Files:**
- Create: `app/product/[id]/ProductGallery.tsx`
- Modify: `app/product/[id]/page.tsx` (the `{/* Image */}` block, ~lines 87–100)

- [ ] **Step 1: Create `ProductGallery.tsx`**

Create `app/product/[id]/ProductGallery.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { ProductImage } from '../../components/ProductImage';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  accentColor: string;
  category?: string;
}

// Main photo plus a thumbnail strip (shown only when there's more than one
// photo). Clicking/keying a thumbnail or swiping the main photo changes the
// selection. Falls back to a single image, and then the placeholder, exactly
// like the old single-image layout.
export function ProductGallery({ images, alt, accentColor, category }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const count = images.length;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const current = count > 0 ? images[safeIndex] : null;

  function select(next: number) {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  }

  function onThumbKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % count : (i - 1 + count) % count;
    select(next);
    thumbRefs.current[next]?.focus();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) select(safeIndex + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  }

  return (
    <div className="w-full lg:w-1/2 flex-shrink-0 flex flex-col gap-3">
      <div
        className="relative overflow-hidden aspect-square w-full rounded-lg border border-cream-dark flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}12` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <ProductImage
          image={current}
          accentColor={accentColor}
          category={category}
          alt={count > 1 ? `${alt} — photo ${safeIndex + 1} of ${count}` : alt}
          sizes="(max-width: 1024px) 100vw, 50vw"
          iconClassName="w-40 h-60"
        />
      </div>

      {count > 1 && (
        <ul className="grid grid-cols-5 gap-2 list-none p-0 m-0">
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                onClick={() => select(i)}
                onKeyDown={(e) => onThumbKey(e, i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === safeIndex ? 'true' : undefined}
                className={`relative block aspect-square w-full overflow-hidden rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-1 ${
                  i === safeIndex
                    ? 'border-kraft ring-1 ring-kraft'
                    : 'border-cream-dark hover:border-kraft-light'
                }`}
                style={{ backgroundColor: `${accentColor}12` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the detail page**

In `app/product/[id]/page.tsx`, add the import near the other component imports:

```tsx
import { ProductGallery } from './ProductGallery';
```

Replace the entire `{/* Image */}` block (the `<div className="relative overflow-hidden w-full lg:w-1/2 aspect-square ...">…</div>`) with:

```tsx
        {/* Image gallery */}
        <ProductGallery
          images={product.images}
          alt={product.name}
          accentColor={product.accentColor}
          category={product.categorySlug}
        />
```

Leave the `ProductImage` import in place — it's still used by the "You might also like" section.

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Verify the gallery at runtime (temporary sample images)**

The sample products have no photos, so temporarily give one a few real image URLs to exercise the gallery, then revert.

- In `app/data/sample.ts`, temporarily change id '1' to:
  `images: ['https://picsum.photos/id/1062/600', 'https://picsum.photos/id/1025/600', 'https://picsum.photos/id/1074/600']`
  (and also set its `image` field is fine to leave as `null` — the page reads `images`).
- `preview_start` (`dev`).
- `preview_eval`: navigate to `/product/1` (`window.location.href = '/product/1'`), then `preview_snapshot` → main image + a 3-thumb strip.
- `preview_eval` to click the 2nd thumbnail (or `preview_click`), then `preview_screenshot` → main image swapped; active thumbnail outlined in kraft.
- `preview_resize` to 390×800 → thumbnails + main image still usable.
- `preview_console_logs` → no errors (note: `picsum.photos` may warn about next/image domains for the *main* image; if so, that's expected for the throwaway URLs and is irrelevant to real Supabase photos — the thumbnails use plain `<img>` and won't warn). If the main image fails to load due to domain config, verify the thumbnails + swap logic instead and rely on Task 6's live check for the main image.
- **Revert** id '1' back to `images: []`.
- `preview_stop`.

- [ ] **Step 5: Commit**

```bash
git add app/product/[id]/ProductGallery.tsx app/product/[id]/page.tsx
git commit -m "Add product detail photo gallery (thumbnails + swap)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Add the dnd-kit dependency

**Files:**
- Modify: `package.json` (+ `package-lock.json`)

- [ ] **Step 1: Install**

Run:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

If npm reports a peer-dependency conflict against React 19, retry with:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --legacy-peer-deps
```

- [ ] **Step 2: Verify the build still succeeds with the new deps**

Run: `npm run build`
Expected: succeeds.

> **Compatibility note (per `AGENTS.md` + spec):** dnd-kit must work with the installed React 19 / Next 16. If Task 4's preview shows the drag grid throwing at runtime (e.g., a hook/render error from dnd-kit), do **not** force it — fall back to a dependency-free reorder: keep the same `ProductPhotos` UI and data contract but replace drag with ◀ ▶ "move" buttons + a "Set as main" button on each tile (uninstall the `@dnd-kit/*` deps and drop the `DndContext`/`useSortable` usage). The token-list submit contract and server action are unchanged either way.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add dnd-kit for admin photo reordering" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Admin photo components (tile + grid)

**Files:**
- Create: `app/admin/products/SortablePhoto.tsx`
- Create: `app/admin/products/ProductPhotos.tsx`

- [ ] **Step 1: Create `SortablePhoto.tsx`**

Create `app/admin/products/SortablePhoto.tsx`:

```tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface PhotoItem {
  /** Stable id for dnd: the URL for existing photos, `new-<n>` for new files. */
  id: string;
  kind: 'existing' | 'new';
  /** Existing public URL, or an object URL preview for a new file. */
  url: string;
  /** Present only when kind === 'new'. */
  file?: File;
}

interface SortablePhotoProps {
  item: PhotoItem;
  isMain: boolean;
  onRemove: (id: string) => void;
}

export function SortablePhoto({ item, isMain, onRemove }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square overflow-hidden rounded-lg border border-cream-dark bg-cream touch-none"
    >
      {/* Whole tile is the drag handle (keyboard-draggable via dnd-kit). */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder photo"
        className="absolute inset-0 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="" className="pointer-events-none h-full w-full object-cover" />
      </button>

      {isMain && (
        <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-ink/85 px-1.5 py-0.5 font-body text-[10px] font-medium text-cream">
          Main
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Remove photo"
        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/85 text-xs text-cream hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `ProductPhotos.tsx`**

Create `app/admin/products/ProductPhotos.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { MAX_PRODUCT_PHOTOS } from '../../data/types';
import { SortablePhoto, type PhotoItem } from './SortablePhoto';

interface ProductPhotosProps {
  initialUrls: string[];
  /** Called whenever the ordered photo list changes, so the form can submit it. */
  onChange: (items: PhotoItem[]) => void;
}

let newCounter = 0;

export function ProductPhotos({ initialUrls, onChange }: ProductPhotosProps) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initialUrls.map((url) => ({ id: url, kind: 'existing' as const, url })),
  );
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  // Revoke object URLs when the component unmounts.
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.kind === 'new') URL.revokeObjectURL(it.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const room = MAX_PRODUCT_PHOTOS - items.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_PRODUCT_PHOTOS} photos.`);
      return;
    }
    const chosen = Array.from(fileList).slice(0, room);
    const rejected: string[] = [];
    const next: PhotoItem[] = [];
    for (const file of chosen) {
      if (!file.type.startsWith('image/')) {
        rejected.push(file.name);
        continue;
      }
      next.push({ id: `new-${newCounter++}`, kind: 'new', url: URL.createObjectURL(file), file });
    }
    if (fileList.length > room) {
      setError(`Only ${MAX_PRODUCT_PHOTOS} photos allowed — extra files were skipped.`);
    } else if (rejected.length) {
      setError(`Skipped non-image file(s): ${rejected.join(', ')}.`);
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.kind === 'new') URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-sm font-medium text-ink">Photos</span>
      <p className="font-body text-xs text-ink-light">
        The first photo is the main one shown in the shop. Drag to reorder. Up to{' '}
        {MAX_PRODUCT_PHOTOS}.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item, i) => (
              <SortablePhoto key={item.id} item={item} isMain={i === 0} onRemove={removeItem} />
            ))}

            {items.length < MAX_PRODUCT_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-kraft bg-kraft/5 text-kraft-dark transition-colors hover:bg-kraft/10">
                <span className="text-2xl leading-none">+</span>
                <span className="font-body text-xs font-medium">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {error && (
        <p className="font-body text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

> Note: the `+ Add` file input has **no `name`** attribute on purpose, so it's excluded from `new FormData(form)`. New files are appended explicitly by the form in Task 5.

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → succeeds (this is the first build that bundles dnd-kit usage; if it fails on a dnd-kit API, consult the installed package's types under `node_modules/@dnd-kit/`).

- [ ] **Step 4: Commit**

```bash
git add app/admin/products/SortablePhoto.tsx app/admin/products/ProductPhotos.tsx
git commit -m "Add admin photo grid + sortable tile (dnd-kit)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire ProductForm + server action (end-to-end)

This task changes the form and the server action **together** so the admin create/edit flow stays consistent.

**Files:**
- Modify: `app/admin/products/ProductForm.tsx`
- Modify: `app/admin/products/actions.ts`

- [ ] **Step 1: Update `parseProduct` in `actions.ts`**

At the top of `app/admin/products/actions.ts`, add the import (alongside the existing imports):

```ts
import { MAX_PRODUCT_PHOTOS } from '../../data/types';
```

Replace this block in `parseProduct`:

```ts
  // Image: upload a new file, remove the existing one, or keep what's there.
  let imageUrl: string | null = str(formData, 'current_image') || null;
  const file = formData.get('image');
  if (file instanceof File && file.size > 0) {
    const res = await uploadImage(file);
    if ('error' in res) {
      return { ok: false, state: { status: 'error', message: res.error, fieldErrors: { image: res.error } } };
    }
    imageUrl = res.url;
  } else if (formData.get('remove_image') != null) {
    imageUrl = null;
  }
```

with:

```ts
  // Photos: an ordered token list ('image_order') plus the new files ('new_image').
  // Each token is either an existing public URL (kept) or 'new:i' (upload newFiles[i]).
  const orderRaw = str(formData, 'image_order');
  let order: string[] = [];
  if (orderRaw) {
    try {
      const parsed = JSON.parse(orderRaw);
      if (Array.isArray(parsed)) order = parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      order = [];
    }
  }
  const newFiles = formData
    .getAll('new_image')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (order.length > MAX_PRODUCT_PHOTOS) {
    return {
      ok: false,
      state: {
        status: 'error',
        message: `You can add up to ${MAX_PRODUCT_PHOTOS} photos.`,
        fieldErrors: { image: `Up to ${MAX_PRODUCT_PHOTOS} photos.` },
      },
    };
  }

  const imageUrls: string[] = [];
  for (const token of order) {
    if (token.startsWith('new:')) {
      const idx = Number(token.slice(4));
      const f = newFiles[idx];
      if (!f) continue;
      const res = await uploadImage(f);
      if ('error' in res) {
        return { ok: false, state: { status: 'error', message: res.error, fieldErrors: { image: res.error } } };
      }
      imageUrls.push(res.url);
    } else {
      imageUrls.push(token);
    }
  }
  const imageUrl = imageUrls[0] ?? null;
```

Then in the returned `values` object, add `image_urls` next to `image_url`:

```ts
      image_url: imageUrl,
      image_urls: imageUrls,
```

- [ ] **Step 2: Update `ProductForm.tsx` imports and add photo state**

In `app/admin/products/ProductForm.tsx`, update the React import and add the new imports:

```tsx
import { useActionState, useCallback, useRef, useState } from 'react';
```

Add near the other component imports:

```tsx
import { ProductPhotos } from './ProductPhotos';
import type { PhotoItem } from './SortablePhoto';
```

Inside the component body (after the existing `useState`/`useActionState` lines), add:

```tsx
  const photosRef = useRef<PhotoItem[]>([]);
  const handlePhotosChange = useCallback((items: PhotoItem[]) => {
    photosRef.current = items;
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const order: string[] = [];
    let n = 0;
    for (const item of photosRef.current) {
      if (item.kind === 'existing') {
        order.push(item.url);
      } else if (item.file) {
        fd.append('new_image', item.file);
        order.push(`new:${n}`);
        n += 1;
      }
    }
    fd.set('image_order', JSON.stringify(order));
    formAction(fd);
  }
```

- [ ] **Step 3: Swap the form handler and replace the Photo field**

Change the opening form tag from `<form action={formAction} ...>` to:

```tsx
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl" noValidate>
```

Replace the entire current Photo block — the `<div className="flex flex-col gap-1.5">` that contains the `Photo` label, the current-image preview, the `image` file input, and helper text, **plus** the following `<input type="hidden" name="current_image" ... />` line — with:

```tsx
      <ProductPhotos initialUrls={product?.images ?? []} onChange={handlePhotosChange} />
```

(Server-side photo errors still surface via the top-of-form `state.message` alert, which is already rendered.)

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Runtime verification of the admin flow (preview)**

> The admin write path needs Supabase (auth + storage), which isn't configured in the local sample mode. So verify what's verifiable locally, and defer the full upload round-trip to the live check in Task 6. Locally, confirm the form **renders and behaves** (grid, add previews, drag reorder, remove, cap) without errors:

- `preview_start` (`dev`).
- `preview_eval` to go to `/admin/products/new` (it may redirect to `/admin/login` without auth — if so, note it and rely on Task 6 for the authenticated flow). If the form renders:
  - `preview_snapshot` → "Photos" section with a "+ Add" tile.
  - Use `preview_eval` to confirm no console errors from dnd-kit (`DndContext` mounted).
- `preview_console_logs` → no errors.
- `preview_stop`.

If the form is gated behind login locally, record that Step 5's full interaction is verified live in Task 6, and ensure `tsc`/`build` both pass here.

- [ ] **Step 6: Commit**

```bash
git add app/admin/products/ProductForm.tsx app/admin/products/actions.ts
git commit -m "Wire admin multi-photo upload + ordered save" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Run migration, verify live, finalize

**Files:** none (ops + verification); possibly `app/data/sample.ts` if any temp test data remains.

- [ ] **Step 1: Confirm no temporary test data remains**

Check `app/data/sample.ts` — every product should have `images: []` (revert any temporary URLs left from Task 2 Step 4).

Run: `npx tsc --noEmit` and `npm run build` → both clean.

- [ ] **Step 2: Owner runs the migration**

Ask the owner (Andrew) to run `supabase/migrations/0006_product_images.sql` in the Supabase SQL editor for the **blg-creations / production** project (the same project as the sold-out migration). Expected: "Success. No rows returned." (The backfill updates existing products' `image_urls` from `image_url`.)

- [ ] **Step 3: Push (deploys via Vercel)**

```bash
git push origin main
```

- [ ] **Step 4: Verify live**

After the Vercel deploy completes:
- Load the live shop home → product cards still show their photos (derived main image).
- In the live **admin**, edit a product → add 2–3 photos → drag to reorder so a new one is first → save.
- Confirm: the shop grid shows the new main photo; the product detail page shows the gallery (thumbnails swap the main image); removing a photo and saving updates it.
- Confirm a single-photo product still looks normal and a no-photo product shows the placeholder.

- [ ] **Step 5: Update project memory**

Update `C:\Users\admcm\.claude\projects\C--Projects-earring-shop\memory\project_blg_creations.md` noting the gallery feature shipped (multiple photos via `image_urls`, dnd-kit admin reorder, migration `0006` run live).

---

## Self-review (completed by plan author)

- **Spec coverage:** data model (Task 1) ✓; gallery thumbnails-below + single/empty fallbacks + keyboard + touch (Task 2) ✓; dnd-kit dep + fallback (Task 3) ✓; admin ordered grid, add/remove, Main badge, cap (Tasks 4–5) ✓; server token-list upload + `image_urls` + synced `image_url` (Task 5) ✓; migration + backfill (Tasks 1, 6) ✓; live verification (Task 6) ✓; out-of-scope items (storage cleanup, captions) intentionally not tasked ✓.
- **Placeholder scan:** none — every code step has complete code; verification uses the project's real commands (`tsc`, `build`, preview tools), not a fictional test runner.
- **Type consistency:** `PhotoItem` defined in `SortablePhoto.tsx` and imported by `ProductPhotos.tsx` + `ProductForm.tsx`; `MAX_PRODUCT_PHOTOS` defined once in `types.ts`, imported by client + server; `image_urls` (`string[] | null` on the row, `string[]` in values) and derived `image`/`images` are consistent across `products.ts`, the form, and the action.
