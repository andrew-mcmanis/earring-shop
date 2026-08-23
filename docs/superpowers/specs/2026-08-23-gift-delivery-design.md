# Gift delivery ("ship to someone else") — design

_Date: 2026-08-23_

## Problem

Every order today is delivered to the person buying it: checkout collects one
ship-to address (`orders.address` / `city` / `postcode`) and the buyer's contact
details (`customer_name` / `email` / `phone`). There is no way to buy a piece as
a gift and have it posted to someone else. Bev asked for a gift option on the
delivery step.

Good news: the model already separates *where it ships* from *who's buying*, and
confirmation emails already go only to the **buyer** and to **Bev** — never to
the delivery address — so a recipient can never accidentally receive an email
showing the price. This makes the feature a small, low-risk extension.

## Decisions (confirmed with the owner)

- **Ship-to-someone-else only for v1.** A "This is a gift — send it to someone
  else" switch on the delivery step reveals the recipient's name + address. The
  buyer still gets the confirmation and receipt. (Rejected for v1: gift message,
  price-free gift receipt/packing slip — deferred, easy to add later.)
- **Reuse the existing address columns as the ship-to.** They already are the
  delivery destination. We add `is_gift` and `recipient_name`; when it's a gift
  the address columns hold the recipient's address. No separate buyer postal
  address is collected (Stripe handles the card; we never stored a billing
  address).
- **A gift is always a delivery.** Pickup can't be a gift, so the switch only
  appears when "Deliver" is selected and is ignored server-side for pickup.
- **The recipient is never emailed.** Confirmations continue to go to the buyer
  and Bev only. The buyer's confirmation shows who it's being sent to; Bev's
  owner email flags it as a GIFT with the recipient's name so she addresses the
  parcel correctly.

## Data model — migration `0013_gift_delivery.sql`

_(Next free migration number; highest existing is `0012`. If the reviews feature
lands first, this becomes the following number.)_

```sql
-- 0013_gift_delivery.sql
-- Gift orders: posted to someone other than the buyer. The address columns hold
-- the RECIPIENT's address; recipient_name is who it's addressed to. A gift is
-- always a delivery (never pickup). The app enforces this too; this is the DB
-- backstop for any other write path.

alter table orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists recipient_name text;

-- (drop + add keeps re-runs safe — ADD CONSTRAINT has no IF NOT EXISTS.)
alter table orders drop constraint if exists orders_gift_requires_recipient;
alter table orders add constraint orders_gift_requires_recipient
  check (
    is_gift = false
    or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null)
  );
```

- Existing rows get `is_gift = false`, so the new CHECK passes for all of them.
- Mirror both columns + the constraint in `supabase/schema.sql` (repo
  convention). **Owner runs `0013` by hand in the Supabase SQL editor, before
  deploying the code** — the checkout INSERT will reference the new columns, so
  the migration must land first (same ordering discipline as `0011`).

Types (`app/data/types.ts`): `Order` gains `isGift: boolean` and
`recipientName: string | null`. `app/admin/orders/queries.ts` maps the two new
columns in its row-shape + `mapOrder`.

## Checkout UI — `app/components/CheckoutForm.tsx`

The gift switch lives **inside the delivery address block** (the `div` shown only
when `method === 'delivery'`), so it's hidden for pickup automatically.

- **State + hidden input.** Add `const [isGift, setIsGift] = useState(false)`,
  mirroring the existing `method` pattern. Add a hidden input that is only
  "true" for a delivery gift:
  ```tsx
  <input type="hidden" name="is_gift" value={method === 'delivery' && isGift ? 'true' : 'false'} />
  ```
- **Capsule toggle (consistency requirement).** Use the exact `role="switch"`
  capsule pattern already in the codebase — the "In stock only" switch in
  [FilterBar.tsx:82](app/components/FilterBar.tsx:82) — **not** a checkbox:
  a `<button type="button" role="switch" aria-checked={isGift}>` with the
  `h-5 w-9 rounded-full` track (`bg-kraft` on / `bg-cream` off) and the
  `h-4 w-4 rounded-full bg-white` knob (`translate-x-[18px]` on /
  `translate-x-0.5` off), followed by the label "This is a gift — send it to
  someone else." Disable while `isPending`.
- **Recipient fields.** When `isGift` is on, show a required **Recipient's name**
  field (`id="recipient_name"`) directly above the address fields, and reword the
  address block so it reads as *their* address (e.g. legend/help text
  "Where should we send it?"). When off, the block is unchanged — the address is
  the buyer's own, exactly as today. The buyer's name/email/phone in the "Your
  details" fieldset are untouched (that's the receipt + contact).
- **Autofill.** Set `autoComplete="off"` on the recipient name + recipient
  address inputs so the browser doesn't autofill the *buyer's* saved address into
  a gift recipient's fields.
- **Order summary / totals unchanged.** Delivery is charged the same; nothing in
  the pricing path changes.

## Server — `app/lib/orders.ts` (`createOrderAndIntent`)

- Read the new fields: `const recipientName = str(formData, 'recipient_name')`
  and `const isGift = formData.get('is_gift') === 'true' && !isPickup` (a gift is
  never a pickup — force false for pickup).
- **Validation:** when `isGift`, add `fieldErrors.recipient_name` if the name is
  blank. The existing address-required rule already covers the address (a gift is
  a delivery, so `!isPickup && !address` fires). 
- **Insert:** add `is_gift: isGift` and `recipient_name: isGift ? recipientName : null`
  to the `orders` insert. For pickup / non-gift these are `false` / `null`, so
  behaviour is identical to today.

## Emails — `app/lib/email.ts` + webhook

- `OrderEmailData` gains `isGift: boolean` and `recipientName: string | null`.
- `buildEmailData` (`app/api/stripe/webhook/route.ts`) reads `is_gift` /
  `recipient_name` from the order row (add both to the `PaidOrderRow` interface
  and the `select` already uses `*`, so no query change) and passes them through.
- **Buyer confirmation (`customerHtml` → `fulfilmentBlock`):** for a gift, the
  delivery block is labelled **"Sending to"** and shows the recipient name above
  the address, so the buyer is reassured it's going to the right person. (Prices
  stay — this is the buyer's own receipt.)
- **Owner alert (`ownerHtml` → `fulfilmentBlock`):** for a gift, show a clear
  **"GIFT"** marker plus the recipient name above the address, so Bev addresses
  the parcel to the recipient, not the buyer.
- The recipient is still never a `to:` on any email — unchanged.

## Admin Orders UI — `app/admin/orders/`

- `mapOrder` exposes `isGift` / `recipientName`.
- The order row/detail shows a small **"Gift"** marker and the recipient name in
  the delivery block, styled like the existing badges (no new design language).

## Out of scope (deliberately)

- Gift message from the buyer included in the parcel.
- Price-free gift receipt / packing slip.
- A separate buyer postal/billing address (not collected today).
- Multiple recipients / split shipments per order.

## Edge cases

- **Gift toggled on, then switched to Pickup:** the switch is inside the
  delivery-only block so it disappears; the hidden `is_gift` evaluates to "false"
  because `method !== 'delivery'`, and the server also forces `isGift = false`
  for pickup. No stray recipient data is stored.
- **Gift on but recipient name blank:** server validation returns a field error
  (`recipient_name`), and the DB CHECK is the backstop.
- **Existing orders:** default `is_gift = false`, unaffected everywhere.
- **Tampered payload (is_gift=true on a pickup):** server forces false; DB CHECK
  rejects a gift that isn't a delivery with a named recipient.

## Verification

- `tsc` clean; `npm run build` succeeds. (No unit-test runner — project
  convention.)
- **In Stripe TEST mode:** place a delivery order with the gift switch on
  (recipient name + address). Confirm: the order stores `is_gift = true` +
  `recipient_name`; the **buyer** gets a confirmation whose delivery block reads
  "Sending to [recipient]"; **Bev's** owner email shows the GIFT marker +
  recipient; the recipient receives **no** email. Repeat with the switch off to
  confirm the normal flow is unchanged, and with Pickup to confirm the switch is
  absent and `is_gift` stays false.
- Confirm the switch renders and behaves identically to the FilterBar capsule
  (keyboard focus ring, `aria-checked`).
- Owner: run migration `0013` in Supabase, then deploy.
