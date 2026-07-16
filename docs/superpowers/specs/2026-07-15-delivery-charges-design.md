# Delivery charges + pickup — design

_Date: 2026-07-15_

## Problem

The shop currently takes orders with **no delivery charge** ("Shipping is
arranged after checkout"). The owner needs to **set and change a delivery
charge per category** (earrings, bookmarks, gifts, and any category she adds
later), and customers need to choose **delivery or collection (pickup)** at
checkout. This also resolves the ROADMAP's open "shipping model" decision that
was blocking Phase 2 checkout totals.

## Decisions (confirmed with the owner)

- **Rate per product category.** Each category carries one delivery rate.
  Rates live with the categories she already manages, so **new categories she
  creates automatically get a delivery-rate slot** — no fixed list of three.
  (Rejected: separate "delivery bands" with a category→band mapping — more
  flexible but a second taxonomy to manage; not worth it.)
- **Mixed basket → highest single rate.** A basket spanning categories is
  charged the **largest** delivery rate among its categories (it posts as one
  parcel). Example: earrings £3 + bookmark £1 → delivery £3.
- **Dedicated Delivery admin page** (`/admin/delivery`, its own dashboard tile
  + nav entry) — not inline in Labels. It holds the per-category rates **and**
  the collection details for pickup.
- **Delivery vs pickup at checkout.** Delivery collects an editable address +
  contact and charges the computed delivery; pickup collects contact only,
  charges £0, and asks for no address.
- **Collection address is private until a confirmed order.** It is **never
  shown on the checkout page** and **never readable by anonymous browsers**. It
  is revealed only *after* the order is placed — on the confirmation screen for
  the customer who just ordered, and (in Phase 2) in the confirmation email.
- **Server is authoritative.** The delivery charge the customer pays is always
  recomputed in `placeOrder`; the browser is never trusted (same as prices).

## Data model — migration `0007_delivery.sql`

- `categories.delivery_charge numeric(10,2) not null default 0` — the owner's
  per-category rate. Existing and new categories default to **£0 (free)** until
  she sets a number.
- **`settings`** — a single-row table for global shop settings:
  ```sql
  create table if not exists settings (
    id            boolean primary key default true check (id),
    pickup_address text,
    pickup_note    text,
    updated_at     timestamptz not null default now()
  );
  insert into settings (id) values (true) on conflict do nothing;
  ```
  RLS/grants: **authenticated** read + update only (admin edits it). It is
  **not** granted to `anon`; the server (`placeOrder`, service role) is the only
  non-admin reader. This keeps the collection address off the public surface.
- `orders` gains `fulfilment_method text not null default 'delivery'`
  (`'delivery' | 'pickup'`) and `shipping numeric(10,2) not null default 0`.
  Existing orders backfill to delivery / £0. Order **total = subtotal +
  shipping** (derived; not stored).
- `orders.address` is made **nullable** (`alter table orders alter column
  address drop not null`) — a pickup order has no delivery address and stores
  `null` there. `city`/`postcode` are already nullable.
- `supabase/schema.sql` mirrors all of the above (repo convention).

Types (`app/data/types.ts`): `Category` gains `deliveryCharge: number`; `Order`
gains `fulfilmentMethod: 'delivery' | 'pickup'` and `shipping: number`, and
`Order.address` becomes `string | null` (with the `OrderRow`/`mapOrder`
row-shape in `app/admin/orders/queries.ts` updated to match).

## Admin — `/admin/delivery`

New route + a `DeliveryManager` client component, styled like the Labels/admin
card language (white cards, cream-dark borders, inline save + `role="alert"`
errors, kraft controls). Server actions in `app/admin/delivery/actions.ts`
(each `requireUser()` first, `{ error?: string }` return, revalidate):

- **Delivery rates** — lists every category (from `getCategories`) with an
  editable **£ rate** input; `setDeliveryCharge(slug, charge)` validates a
  non-negative number and updates `categories.delivery_charge`, then
  `revalidatePath('/admin/delivery')`, `'/'`, `'/checkout'`. New categories
  (created in Labels) appear here automatically.
- **Collection details** — editable **pickup address** (textarea) + optional
  **pickup note**; `updatePickupDetails(address, note)` upserts the `settings`
  row.

Dashboard (`/admin`) gains a **Delivery** tile linking here; `AdminHeader` (if
it has section nav) gains the link.

## Storefront

### Cart drawer (`CartDrawer` + `CartProvider`)
Replace "Shipping is arranged after checkout" with **"Delivery from £X · or
free pickup at checkout"**, where X = the highest category rate among the cart's
items (or "Free delivery · or pickup" when all applicable rates are £0). Rates
reach the client via a new `getDeliveryRates(): Promise<Record<string, number>>`
server action (public read client), fetched by `CartProvider` when the cart
opens — mirroring the existing `refreshAvailability` pattern — and exposed on
the cart context. This is an **estimate/label only**; it is never the source of
truth.

### Checkout (`app/checkout/page.tsx` + `CheckoutForm`)
The checkout page (server) fetches categories (with rates) and passes a
`deliveryRates` map to `CheckoutForm`. `CheckoutForm` adds:
- A **Deliver / Pick up** radio group at the top of the fulfilment section
  (default **Deliver**), submitted as a hidden `fulfilment_method` field.
- **Deliver:** the address fields render (required) and stay editable, contact
  fields as now; the summary shows **Subtotal + Delivery + Total**, where
  Delivery = highest rate among the cart's categories.
- **Pick up:** address fields are **not rendered** (so nothing is required or
  submitted); a line reads *"Collection details will be sent once your order's
  confirmed."*; the summary shows **Delivery £0.00** and Total = subtotal.
- Contact details (name / email / phone) are always collected and editable in
  both modes.

### Confirmation (privacy-preserving)
- `placeOrder` returns, on success, a confirmation payload:
  `{ reference, fulfilmentMethod, delivery?: {address,…}, collection?: {address, note} }`.
  For **pickup** it reads `settings` via the **service** client and includes the
  collection address + note. For **delivery** it echoes the address entered.
- `CheckoutForm` writes this payload to **`sessionStorage`** (key
  `blg-last-order`) before `router.push('/checkout/success')`, so the collection
  address travels only inside the ordering customer's own session — never in the
  URL, never in an anon-readable query.
- The success page renders a small **client** `OrderConfirmation` component that
  reads `sessionStorage` and shows method-specific detail: pickup → **collection
  address + note** + "we'll be in touch to arrange a time"; delivery → their
  address + "we'll confirm dispatch". If `sessionStorage` is empty (e.g. a later
  fresh visit), it falls back to today's generic "order received" message + the
  `?ref` from the URL.
- **Phase 2 email:** the confirmation email (built with Stripe) will include the
  same detail — collection address for pickup, delivery address for delivery,
  read from `settings` at send time. Recorded in ROADMAP so it isn't missed.

## Server authority (`app/lib/orders.ts` `placeOrder`)

- Read `fulfilment_method` from the form (`'pickup'` only when explicitly sent;
  otherwise `'delivery'`).
- Read the category rates from the authoritative catalogue read already in
  `placeOrder` (join/lookup `delivery_charge`), never from the client.
- **Compute shipping:** `delivery` → the max `delivery_charge` among the
  distinct categories of the validated (orderable) line items; `pickup` → `0`.
- **Validate address:** required for `delivery`; ignored for `pickup`.
- Persist `fulfilment_method` and `shipping` on the order (subtotal as now).
  For `pickup`, `address`/`city`/`postcode` are stored `null`.
- Return the confirmation payload described above (pickup reads `settings` via
  the service client).
- All existing guards (rebuild-from-catalogue, sold-out rejection, honest
  DB-error handling, auto-sold-out flip) are unchanged.

## Admin Orders

`adminGetOrders`/`mapOrder` map the two new columns (and the now-nullable
`address`); the orders list shows a **Delivery / Pickup** chip, the **shipping**
amount, and the **total** (subtotal + shipping). Pickup rows show **"Collection
— no delivery address"** in place of the address block.

## Fits Phase 2 (Stripe)

When Stripe lands, the PaymentIntent amount is simply `subtotal + shipping`
(already computed and stored by `placeOrder`), and the confirmation email
(Phase 2) picks up the collection/delivery detail. No rework.

## Edge cases

- Category with no rate set → £0 (free) for that category.
- A deleted category's rate simply disappears; its products fall back to the
  remaining categories' rates (or £0).
- Mixed basket → single highest rate (never summed).
- Pickup never asks for or stores a delivery address.
- Empty cart, sold-out lines, and the demo/no-DB path are unchanged.
- `settings` row missing (shouldn't happen — seeded) → pickup shows the generic
  "we'll be in touch" message with no address; delivery unaffected.

## Verification

- `tsc` clean; `npm run build` succeeds.
- Preview (storefront): set rates via a temporary sample tweak; confirm the cart
  "Delivery from £X" line, the checkout Deliver/Pick-up toggle (address
  shows/hides; Subtotal + Delivery + Total vs £0), and the confirmation screen
  showing the collection detail for a pickup order and the address for a
  delivery order (driven from `sessionStorage`).
- Admin (`/admin/delivery`, Orders) is auth-gated → verified by build + code
  review + owner validation after deploy, as with prior admin features.
- Owner runs migration `0007` in Supabase; push → Vercel deploy; live smoke test.

## Out of scope

- Free-delivery thresholds, postage zones/bands, per-weight postage (future,
  the separate-table path if ever needed).
- The confirmation **email** itself (Phase 2 with Stripe) — this spec only
  ensures the data + collection detail are ready for it.
- Stripe / payment (Phase 2, separately planned).
