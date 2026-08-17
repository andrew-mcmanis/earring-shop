# Return / refund sync — design

_Date: 2026-08-17_

## Problem

The shop is now LIVE and taking real card payments, but there is **no handling
for a return/refund**. When a customer returns an item and Bev refunds them in
the Stripe dashboard:

- the app never hears about it, so the order still shows **Paid** with no record
  of the refund (amount, date);
- the fulfilment status options (New / Made / Posted / Cancelled) have no notion
  of a post-delivery return — "Cancelled" means *never fulfilled*;
- the returned one-of-a-kind piece stays **sold-out** and must be put back on
  sale by hand, with no prompt.

The customer-facing returns process is already published (the Returns Policy
page: email `orders@`, get approval, post it back, get refunded) and stays
manual by design. This spec covers the **admin/system side**: recording the
refund and supporting the relist.

## Decisions (confirmed with the owner)

- **Refund happens in Stripe; the app syncs.** Bev issues the refund (full or
  partial) in the Stripe dashboard as she does today. The app listens for a
  Stripe webhook and reflects it. (Rejected: an admin-initiated "Refund" button
  — puts money-movement + partial-amount handling into the app; more to build.
  Rejected: fully manual with no Stripe link — relies on Bev remembering to mark
  it.)
- **No auto-restock.** A return can be resaleable (change-of-mind) or
  faulty/damaged; auto-relisting a damaged piece would wrongly put it back on
  sale. The app marks the order refunded and **Bev relists the piece herself**
  only if it's resaleable — via a one-click button (below).
- **No automated customer email.** Bev is already corresponding with the
  customer about the return, and Stripe sends its own refund receipt.
- **Order-level refunds, tracked by amount.** No per-item return tracking. The
  refund is recorded against the order with the refunded amount; partial vs full
  is derived by comparing that amount to the order total.
- **Reuse the existing `payment_status = 'refunded'`** for any refund (full or
  partial) — it already exists in the schema and `PaymentStatus` type. No new
  enum value, no CHECK-constraint change.

## Data model — migration `0011_order_refunds.sql`

`payment_status` already allows `'unpaid' | 'paid' | 'refunded'` (migration
`0010`; `PaymentStatus` in `app/data/types.ts` matches). This migration only
**adds two nullable columns** to `orders`:

```sql
alter table orders
  add column if not exists refunded_amount numeric(10,2),
  add column if not exists refunded_at timestamptz;
```

- `refunded_amount` — cumulative amount refunded, in pounds (mirrors Stripe's
  `amount_refunded`). Null until a refund lands.
- `refunded_at` — timestamp of the first refund. Null until then.
- Mirror both in `supabase/schema.sql` (repo convention). **Owner runs `0011`
  by hand in the Supabase SQL editor** (migrations are manual).

Types (`app/data/types.ts`): `Order` gains `refundedAmount: number | null` and
`refundedAt: string | null`. `PaymentStatus` is unchanged. The admin order
row-shape + `mapOrder` (`app/admin/orders/queries.ts`) map the two new columns.

## Webhook — `app/api/stripe/webhook/route.ts`

Add a `charge.refunded` handler alongside the existing `payment_intent.succeeded`
/ `payment_intent.payment_failed` cases. Stripe fires `charge.refunded` on every
refund of a charge (full or partial), carrying the cumulative state:

- `event.data.object` is the **Charge**: use `payment_intent` (the PI id),
  `amount` (total charged, pence) and `amount_refunded` (cumulative refunded,
  pence).
- **Find the order** by `stripe_payment_intent = charge.payment_intent` (that
  column is set when the order is paid, so it's reliably present by refund time).
  Not found → log + return `200` (nothing to do; don't make Stripe retry forever).
- **Update** the order: `payment_status = 'refunded'`, `refunded_amount =
  amount_refunded / 100`; set `refunded_at = now()` **only if it was null**
  (keep the first-refund timestamp). Leave the fulfilment `status` untouched — a
  "Posted" order can be "Refunded".
- **Idempotent by construction:** the handler always writes Stripe's *current
  cumulative* `amount_refunded`, so a redelivered event re-writes the same value
  (no-op) and a second partial refund correctly advances the total. No atomic
  claim is needed (unlike the paid path, this triggers no emails/stock changes).
- **Error handling mirrors the paid path:** a DB write error → `500` so Stripe
  retries; everything else → `200`.
- Unhandled event types keep returning `200` (as now).

**Stripe dashboard (owner action):** add the **`charge.refunded`** event to the
existing LIVE webhook endpoint (`https://blgcreations.co.uk/api/stripe/webhook`).
For testing, add it to the TEST endpoint / local `stripe listen` too.

## Admin Orders UI — `app/admin/orders/`

1. **Refund badge.** Next to the existing Paid/Unpaid badge, when
   `paymentStatus === 'refunded'`, show a badge derived from the amount vs the
   order total (`subtotal + shipping`):
   - `refundedAmount >= total` → **"Refunded £X"**
   - `refundedAmount < total` → **"Partially refunded £X"**
   with the `refunded_at` date. Styled like the existing status badges (no new
   design language).

2. **"Relist this piece" button (per item).** On a refunded order, each order
   item that still has a `product_id` gets a small **Relist** button. It calls a
   server action that **sets that product's `sold_out = false`** (an explicit
   set — *not* a blind toggle, so clicking an already-in-stock item is a safe
   no-op), gated by `requireUser()`, then `revalidatePath('/admin/orders')` and
   `'/'`. This mirrors the `updateOrderStatus` action pattern and reuses the
   existing product stock-write path where one exists.
   - Shown only for refunded orders; items whose product was deleted
     (`product_id` null) show no button.

No customer-facing storefront changes.

## Out of scope (deliberately)

- Auto-restock on refund.
- Automated customer refund email (Stripe's receipt + Bev's manual reply cover
  it).
- Admin-initiated refunds (Bev refunds in Stripe).
- Per-item return tracking (refunds recorded at order level with an amount).
- Dispute/chargeback handling (`charge.dispute.*`) — a separate concern.

## Edge cases

- **Partial then full refund:** two `charge.refunded` events; each writes the new
  cumulative `amount_refunded`; the badge flips from "Partially refunded" to
  "Refunded" once it reaches the total.
- **Refund for an unknown/mismatched PI:** order not found → logged, `200`.
- **Product deleted before relist:** `product_id` null → no Relist button; the
  refund still records fine.
- **Redelivered webhook:** same cumulative value re-written → no-op.
- **Relisting an already-in-stock piece:** explicit `sold_out = false` set → safe
  no-op.

## Verification

- `tsc` clean; `npm run build` succeeds. (No unit-test runner — project
  convention.)
- **Webhook tested without a live refund:** in Stripe **TEST mode** (or Stripe
  CLI `stripe trigger charge.refunded` against a local `stripe listen`), refund a
  test order and confirm the order flips to Refunded with the right amount/date,
  the badge shows full vs partial correctly, and the Relist button puts the piece
  back in stock. **Never issue a real live refund just to test.**
- Owner: run migration `0011`, add `charge.refunded` to the Stripe endpoint(s),
  deploy; then a controlled test-mode refund before relying on it in live.
