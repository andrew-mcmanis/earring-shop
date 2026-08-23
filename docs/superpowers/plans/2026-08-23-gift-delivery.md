# Gift Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer buy a piece as a gift and have it posted to someone else — a capsule toggle at checkout reveals a recipient name + address, the order records it, and the buyer/owner emails reflect it (the recipient is never emailed).

**Architecture:** The existing `orders.address/city/postcode` columns already hold the *ship-to* address; we add `is_gift` + `recipient_name`, so a gift order simply stores the recipient's details there. The checkout form gets a `role="switch"` capsule (reusing the FilterBar "In stock only" pattern) that reveals recipient fields; the server validates + persists them; the confirmation email (already sent only to buyer + owner) labels the destination accordingly.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres), Stripe (Node SDK), Resend (email). No test runner — verification is `npx tsc --noEmit` + `npm run build`, a local dev-server check of the toggle, and a Stripe **test-mode** order for the email path.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify each task with `npx tsc --noEmit` and, where noted, `npm run build`. Runtime behaviour is verified in the final task (dev server + a test-mode order), not with unit tests.
- **Commits are LOCAL only.** Work is on branch `feat/gift-delivery` (already checked out). **Do not push** — pushing `main` auto-deploys production. The owner pushes/merges after review.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Migration ordering is critical.** The checkout INSERT (Task 4) references the two new columns. If the code deploys before migration `0013` runs, **every** order INSERT fails (unknown column), not just gift orders. So migration `0013` MUST be applied in Supabase **before** the branch is deployed. This is the owner op in Task 7.
- Follow existing patterns exactly (the `role="switch"` capsule, the `str()` form helper, the `fulfilmentBlock` email helper). Do not introduce new dependencies or design language.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0013_gift_delivery.sql` | Create | Add `is_gift` + `recipient_name` to `orders` + gift CHECK constraint |
| `supabase/schema.sql` | Modify | Mirror the two columns + constraint (repo convention) |
| `app/data/types.ts` | Modify | `Order` gains `isGift` + `recipientName` |
| `app/admin/orders/queries.ts` | Modify | Map the two new columns in `OrderRow`/`mapOrder` |
| `app/components/CheckoutForm.tsx` | Modify | Capsule gift toggle, recipient fields, hidden `is_gift` input |
| `app/lib/orders.ts` | Modify | Read/validate/persist `is_gift` + `recipient_name` |
| `app/lib/email.ts` | Modify | `OrderEmailData` fields + gift-aware `fulfilmentBlock` (buyer vs owner) |
| `app/api/stripe/webhook/route.ts` | Modify | Carry `is_gift`/`recipient_name` into `OrderEmailData` |
| `app/admin/orders/page.tsx` | Modify | Show gift marker + recipient in the order detail |

---

## Task 1: Migration + schema mirror (data model)

SQL files aren't type-checked; verify by review. Existing rows get `is_gift = false`, so the new CHECK passes for all of them.

**Files:**
- Create: `supabase/migrations/0013_gift_delivery.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/migrations/0013_gift_delivery.sql`**

```sql
-- 0013_gift_delivery.sql
-- Gift orders: posted to someone other than the buyer. The existing address
-- columns hold the RECIPIENT's address; recipient_name is who it's addressed to.
-- A gift is always a delivery (never pickup). The app enforces this too; this is
-- the DB backstop for any other write path.
-- (drop + add keeps re-runs safe — ADD CONSTRAINT has no IF NOT EXISTS.)

alter table orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists recipient_name text;

alter table orders drop constraint if exists orders_gift_requires_recipient;
alter table orders add constraint orders_gift_requires_recipient
  check (
    is_gift = false
    or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null)
  );
```

- [ ] **Step 2: Mirror the `recipient_name` column in `supabase/schema.sql`**

Find:

```sql
  address        text,                          -- null for pickup orders
  city           text,
  postcode       text,
  country        text not null default 'United Kingdom',
```

Replace with:

```sql
  address        text,                          -- null for pickup orders
  city           text,
  postcode       text,
  recipient_name text,                          -- gift orders: who it's addressed to
  country        text not null default 'United Kingdom',
```

- [ ] **Step 3: Mirror the `is_gift` column in `supabase/schema.sql`**

Find:

```sql
  fulfilment_method text not null default 'delivery'
                 check (fulfilment_method in ('delivery', 'pickup')),
  status         text not null default 'new',  -- new | made | posted | cancelled
```

Replace with:

```sql
  fulfilment_method text not null default 'delivery'
                 check (fulfilment_method in ('delivery', 'pickup')),
  is_gift        boolean not null default false, -- posted to someone other than the buyer
  status         text not null default 'new',  -- new | made | posted | cancelled
```

- [ ] **Step 4: Mirror the gift CHECK constraint in `supabase/schema.sql`**

Find:

```sql
  -- A delivery order must carry an address (pickup orders store null).
  check (fulfilment_method = 'pickup' or address is not null)
);
```

Replace with:

```sql
  -- A delivery order must carry an address (pickup orders store null).
  check (fulfilment_method = 'pickup' or address is not null),
  -- A gift is always a delivery with a named recipient + address.
  check (is_gift = false or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null))
);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_gift_delivery.sql supabase/schema.sql
git commit -m "Add migration 0013: gift delivery columns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `Order` type + admin query mapping

Adding required fields to `Order` makes `tsc` fail until `mapOrder` sets them, so both files change together. `mapOrder` in `app/admin/orders/queries.ts` is the only place that constructs an `Order` (verified).

**Files:**
- Modify: `app/data/types.ts`
- Modify: `app/admin/orders/queries.ts`

- [ ] **Step 1: Add `recipientName` to the `Order` interface in `app/data/types.ts`**

Find:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
```

Replace with:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  /** Gift orders: who the parcel is addressed to. Null for non-gift orders. */
  recipientName: string | null;
  country: string;
```

- [ ] **Step 2: Add `isGift` to the `Order` interface in `app/data/types.ts`**

Find:

```ts
  fulfilmentMethod: 'delivery' | 'pickup';
  status: OrderStatus;
```

Replace with:

```ts
  fulfilmentMethod: 'delivery' | 'pickup';
  /** True when the order is posted to someone other than the buyer. */
  isGift: boolean;
  status: OrderStatus;
```

- [ ] **Step 3: Add the columns to `OrderRow` in `app/admin/orders/queries.ts`**

Find:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  status: string;
```

Replace with:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  recipient_name?: string | null;
  country: string;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  is_gift?: boolean;
  status: string;
```

- [ ] **Step 4: Map them in `mapOrder` (same file)**

Find:

```ts
    address: r.address,
    city: r.city,
    postcode: r.postcode,
    country: r.country,
```

Replace with:

```ts
    address: r.address,
    city: r.city,
    postcode: r.postcode,
    recipientName: r.recipient_name ?? null,
    country: r.country,
```

- [ ] **Step 5: Map `isGift` in `mapOrder` (same file)**

Find:

```ts
    fulfilmentMethod: r.fulfilment_method === 'pickup' ? 'pickup' : 'delivery',
    status: r.status as OrderStatus,
```

Replace with:

```ts
    fulfilmentMethod: r.fulfilment_method === 'pickup' ? 'pickup' : 'delivery',
    isGift: r.is_gift ?? false,
    status: r.status as OrderStatus,
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (the `Order` shape and its only constructor now agree).

- [ ] **Step 7: Commit**

```bash
git add app/data/types.ts app/admin/orders/queries.ts
git commit -m "Add isGift/recipientName to the Order model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Checkout form — capsule gift toggle + recipient fields

Reuses the exact `role="switch"` capsule from `app/components/FilterBar.tsx` (the "In stock only" switch) for visual consistency. The toggle lives inside the delivery-only block, so it's automatically hidden for pickup. A hidden `is_gift` input carries the state to the server, mirroring the existing hidden `fulfilment_method` input.

**Files:**
- Modify: `app/components/CheckoutForm.tsx`

- [ ] **Step 1: Add `isGift` state next to the existing `method` state**

Find:

```tsx
  const inPayment = Boolean(state.clientSecret) && !editing;
  const [method, setMethod] = useState<'delivery' | 'pickup'>('delivery');
```

Replace with:

```tsx
  const inPayment = Boolean(state.clientSecret) && !editing;
  const [method, setMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [isGift, setIsGift] = useState(false);
```

- [ ] **Step 2: Add the hidden `is_gift` input beside the existing hidden inputs**

Find:

```tsx
        <input type="hidden" name="fulfilment_method" value={method} />
```

Replace with:

```tsx
        <input type="hidden" name="fulfilment_method" value={method} />
        {/* Only a delivery order can be a gift; false otherwise so the server never stores stray recipient data. */}
        <input type="hidden" name="is_gift" value={method === 'delivery' && isGift ? 'true' : 'false'} />
```

- [ ] **Step 3: Add the capsule toggle + recipient field + gift-aware address labels**

Find:

```tsx
          <div className={method === 'delivery' ? 'flex flex-col gap-4' : 'hidden'}>
            <Field id="address" label="Address" required autoComplete="street-address" error={state.fieldErrors?.address} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="city" label="Town / City" autoComplete="address-level2" />
              <Field id="postcode" label="Postcode" autoComplete="postal-code" />
            </div>
          </div>
```

Replace with:

```tsx
          <div className={method === 'delivery' ? 'flex flex-col gap-4' : 'hidden'}>
            {/* Gift toggle — same capsule switch as FilterBar's "In stock only" */}
            <button
              type="button"
              role="switch"
              aria-checked={isGift}
              onClick={() => setIsGift((v) => !v)}
              disabled={isPending}
              className="group flex items-center gap-2.5 cursor-pointer focus:outline-none disabled:opacity-60 self-start"
            >
              <span
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-kraft group-focus-visible:ring-offset-1 ${
                  isGift ? 'bg-kraft border-kraft' : 'bg-cream border-kraft-light'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                    isGift ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span className="font-body text-sm text-ink">This is a gift — send it to someone else</span>
            </button>

            {isGift && (
              <Field
                id="recipient_name"
                label="Recipient's name"
                required
                autoComplete="off"
                error={state.fieldErrors?.recipient_name}
              />
            )}

            <Field
              id="address"
              label={isGift ? "Recipient's address" : 'Address'}
              required
              autoComplete={isGift ? 'off' : 'street-address'}
              error={state.fieldErrors?.address}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="city" label="Town / City" autoComplete={isGift ? 'off' : 'address-level2'} />
              <Field id="postcode" label="Postcode" autoComplete={isGift ? 'off' : 'postal-code'} />
            </div>
          </div>
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`Field` already supports `label`, `autoComplete`, and `error` props; `isPending` is already in scope from `useActionState`.)

- [ ] **Step 5: Commit**

```bash
git add app/components/CheckoutForm.tsx
git commit -m "Checkout: gift capsule toggle + recipient fields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Server — validate + persist the gift fields

`createOrderAndIntent` rebuilds the order server-side. Add the gift reads, a validation rule, and the two insert columns. A gift is forced false for pickup so a tampered payload can't store stray recipient data.

**Files:**
- Modify: `app/lib/orders.ts`

- [ ] **Step 1: Read the gift fields from the form**

Find:

```ts
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';
```

Replace with:

```ts
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';
  const recipientName = str(formData, 'recipient_name');
  // A gift is always a delivery — never honour it for pickup.
  const isGift = !isPickup && formData.get('is_gift') === 'true';
```

- [ ] **Step 2: Validate the recipient name for gift orders**

Find:

```ts
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';
```

Replace with:

```ts
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';
  if (isGift && !recipientName) fieldErrors.recipient_name = "Please enter the recipient's name.";
```

- [ ] **Step 3: Persist the gift columns in the order INSERT**

Find:

```ts
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
        shipping,
        fulfilment_method: isPickup ? 'pickup' : 'delivery',
        status: 'new',
```

Replace with:

```ts
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
        shipping,
        fulfilment_method: isPickup ? 'pickup' : 'delivery',
        is_gift: isGift,
        recipient_name: isGift ? recipientName : null,
        status: 'new',
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add app/lib/orders.ts
git commit -m "Checkout server: validate + store gift recipient

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Emails — gift-aware destination block

`fulfilmentBlock` is shared by the buyer (`customerHtml`) and owner (`ownerHtml`) emails. Add an `audience` argument so the buyer sees "Sending to" and the owner sees a clear "Deliver to (gift)" marker, both with the recipient name. Then carry the two new fields through the webhook that builds the email data.

**Files:**
- Modify: `app/lib/email.ts`
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add the two fields to `OrderEmailData` in `app/lib/email.ts`**

Find:

```ts
  fulfilmentMethod: 'delivery' | 'pickup';
  /** Delivery orders only. */
  address: { line: string | null; city: string | null; postcode: string | null } | null;
```

Replace with:

```ts
  fulfilmentMethod: 'delivery' | 'pickup';
  /** True when the order is a gift posted to someone other than the buyer. */
  isGift: boolean;
  /** Gift orders: who the parcel is addressed to. Null otherwise. */
  recipientName: string | null;
  /** Delivery orders only. */
  address: { line: string | null; city: string | null; postcode: string | null } | null;
```

- [ ] **Step 2: Make `fulfilmentBlock` gift-aware (same file)**

Find:

```ts
function fulfilmentBlock(data: OrderEmailData): string {
  if (data.fulfilmentMethod === 'pickup') {
    const body = data.collection?.address
      ? `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};white-space:pre-line;">${esc(data.collection.address)}</p>`
      : `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">We&rsquo;ll be in touch with the collection details.</p>`;
    const note = data.collection?.note
      ? `<p style="margin:8px 0 0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${MUTED};">${esc(data.collection.note)}</p>`
      : '';
    return `${label('Collection')}${body}${note}`;
  }
  const line = [data.address?.line, data.address?.city, data.address?.postcode]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join('<br>');
  return `${label('Delivery to')}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">${line}</p>`;
}
```

Replace with:

```ts
function fulfilmentBlock(data: OrderEmailData, audience: 'customer' | 'owner'): string {
  if (data.fulfilmentMethod === 'pickup') {
    const body = data.collection?.address
      ? `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};white-space:pre-line;">${esc(data.collection.address)}</p>`
      : `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">We&rsquo;ll be in touch with the collection details.</p>`;
    const note = data.collection?.note
      ? `<p style="margin:8px 0 0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${MUTED};">${esc(data.collection.note)}</p>`
      : '';
    return `${label('Collection')}${body}${note}`;
  }
  const line = [data.address?.line, data.address?.city, data.address?.postcode]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join('<br>');
  if (data.isGift) {
    // Owner sees a clear GIFT marker (so she addresses the parcel to the
    // recipient); the buyer sees a reassuring "Sending to".
    const heading = audience === 'owner' ? 'Deliver to (gift)' : 'Sending to';
    const name = data.recipientName
      ? `<p style="margin:0 0 4px;font-family:${SERIF};font-size:15px;font-weight:bold;line-height:1.6;color:${INK};">${esc(data.recipientName)}</p>`
      : '';
    return `${label(heading)}${name}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">${line}</p>`;
  }
  return `${label('Delivery to')}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">${line}</p>`;
}
```

- [ ] **Step 3: Pass the audience at the buyer call site (same file)**

In `customerHtml`, find:

```ts
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data),
    careBlock(),
```

Replace with:

```ts
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
```

- [ ] **Step 4: Pass the audience at the owner call site (same file)**

In `ownerHtml`, find:

```ts
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data),
    notesBlock,
```

Replace with:

```ts
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'owner'),
    notesBlock,
```

- [ ] **Step 5: Add the columns to `PaidOrderRow` in `app/api/stripe/webhook/route.ts`**

Find:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  order_items: OrderItemRow[];
```

Replace with:

```ts
  address: string | null;
  city: string | null;
  postcode: string | null;
  recipient_name: string | null;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  is_gift: boolean;
  order_items: OrderItemRow[];
```

- [ ] **Step 6: Carry the fields into `buildEmailData` (same file)**

Find:

```ts
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    address: isPickup ? null : { line: order.address, city: order.city, postcode: order.postcode },
```

Replace with:

```ts
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    isGift: order.is_gift,
    recipientName: order.recipient_name,
    address: isPickup ? null : { line: order.address, city: order.city, postcode: order.postcode },
```

- [ ] **Step 7: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (The webhook `select('*, order_items(*)')` already returns the new columns; `PaidOrderRow` now types them.)

- [ ] **Step 8: Commit**

```bash
git add app/lib/email.ts app/api/stripe/webhook/route.ts
git commit -m "Emails: gift-aware destination block for buyer + owner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Admin Orders UI — gift marker + recipient

Show the recipient and a gift marker in the order detail so Bev addresses the parcel correctly.

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Prefix the delivery address with the gift recipient**

Find:

```tsx
                    ) : (
                      <p className="text-ink-light sm:col-span-2">
                        {[o.address, o.city, o.postcode, o.country].filter(Boolean).join(', ')}
                      </p>
                    )}
```

Replace with:

```tsx
                    ) : (
                      <p className="text-ink-light sm:col-span-2">
                        {o.isGift && (
                          <span className="font-medium text-kraft-dark">Gift for {o.recipientName} — </span>
                        )}
                        {[o.address, o.city, o.postcode, o.country].filter(Boolean).join(', ')}
                      </p>
                    )}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/admin/orders` still compiles.

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "Admin orders: show gift recipient + marker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification + owner ops (deploy-time)

No new code. Gates the feature and documents the owner steps. **The migration must be applied before the code is deployed** (see Conventions).

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds.

- [ ] **Step 2: Dev-server check of the toggle**

Start the dev server (`npm run dev`) and open `/checkout` with an item in the basket. Verify:
- With **Deliver** selected, the capsule "This is a gift — send it to someone else" switch renders and matches the FilterBar switch (focus ring, sliding knob, `aria-checked` flips on click/keyboard).
- Toggling it **on** reveals the "Recipient's name" field and relabels the address to "Recipient's address".
- Switching to **Pick up** hides the switch and the address block entirely.
- Submitting a gift order with a blank recipient name shows the `recipient_name` field error.

- [ ] **Step 3: Owner op — apply the migration (BEFORE deploy)**

In **Supabase → SQL Editor**, run the contents of `supabase/migrations/0013_gift_delivery.sql`:

```sql
alter table orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists recipient_name text;

alter table orders drop constraint if exists orders_gift_requires_recipient;
alter table orders add constraint orders_gift_requires_recipient
  check (
    is_gift = false
    or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null)
  );
```

(Run this **before** the branch is deployed — otherwise every checkout INSERT hits missing columns.)

- [ ] **Step 4: End-to-end verify with a TEST-mode order**

Using Stripe **test mode** (test keys) — or the Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) for the webhook — place a **delivery gift** order (recipient name + address) with a test card. Confirm:
- The order row has `is_gift = true` and the `recipient_name` set (Supabase table editor or `/admin/orders`).
- `/admin/orders` shows **"Gift for [recipient] — [address]"** on that order.
- The **buyer** receives a confirmation whose destination block reads **"Sending to [recipient]"**.
- **Bev's** owner alert shows **"Deliver to (gift)"** + the recipient name.
- The recipient address receives **no** email.
- Repeat with the switch **off** (normal delivery) → destination block reads "Delivery to" as before; and with **Pick up** → `is_gift` stays false and the collection block is unchanged.

- [ ] **Step 5: Report status (do NOT push)**

Summarize tsc/build results, the dev-server toggle check, and the test-mode order outcome. The owner applies migration `0013`, then merges `feat/gift-delivery` to `main` (which deploys) after review.

## Out of scope (from the spec)

Gift message from the buyer · price-free gift receipt / packing slip · a separate buyer postal/billing address · multiple recipients per order.
