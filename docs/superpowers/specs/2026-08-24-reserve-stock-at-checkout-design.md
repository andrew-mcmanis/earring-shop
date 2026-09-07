# Reserve stock at checkout (oversell prevention) — design

_Date: 2026-08-24_

## Problem

One-of-a-kind items can be **oversold**. An item only flips to `sold_out` when a
payment *succeeds* — in the Stripe webhook ([route.ts](app/api/stripe/webhook/route.ts),
`flipProductsSoldOut`, an unconditional `set sold_out = true`). Checkout accepts
an item while `product.soldOut === false` ([orders.ts:145](app/lib/orders.ts:145))
and creates the order + PaymentIntent **without touching the product**. So between
buyer A creating their order and finishing payment (card entry + 3-D Secure,
seconds to minutes), buyer B can add the same piece, pass the check, pay, and
both webhooks confirm both orders. Two paid orders, one physical item — and
nothing detects it, so Bev learns only when she goes to make/post it.

## Decisions (confirmed with the owner)

- **Prevent via a short, self-expiring reservation** claimed atomically at
  "Continue to payment".
- **Checkout-only enforcement (v1).** The shop grid, product page and cart
  re-check keep keying off `sold_out`; the atomic claim is the authoritative gate.
  (Rejected for v1: reflecting holds across the storefront — touches every read
  path and makes items flicker during checkouts. Deferred.)
- **15-minute hold.** Comfortably covers card entry + 3-D Secure + a retry.
- **Self-expiring — no cron, no release job.**
- **Per-checkout token** so a buyer can re-claim/extend their own hold across
  "Edit details" / a failed-payment retry / a 3-D Secure redirect.

## Data model — migration `0017_product_reservations.sql`

_(Next free migration; highest existing is `0016`.)_ Two columns on `products`
plus an atomic-claim function (mirrors the existing `check_rate_limit` RPC):

```sql
alter table products
  add column if not exists reserved_until timestamptz,
  add column if not exists reserved_by text;

-- Atomically claim a product for a checkout token: succeeds (returns true) only
-- if it's not sold out and either unheld, its hold has expired, or it's already
-- held by this same token (so a buyer can re-claim / extend across edit + retry).
create or replace function claim_product(p_id uuid, p_token text, p_minutes int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  update products
     set reserved_until = now() + make_interval(mins => p_minutes),
         reserved_by = p_token
   where id = p_id
     and sold_out = false
     and (reserved_until is null or reserved_until < now() or reserved_by = p_token)
   returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;
grant execute on function claim_product(uuid, text, int) to service_role;
```

- An item is "held" while `reserved_until > now()`. Holds **self-expire** — no
  cron.
- The single `UPDATE … WHERE … RETURNING` is **row-atomic** in Postgres, so two
  concurrent claims on the same row serialise: exactly one matches the `WHERE`
  and wins.
- Mirror the columns + function in `supabase/schema.sql`. **Owner runs `0017`** in
  the Supabase SQL editor.
- `products` is public-read (RLS); `reserved_by` is a random token (not
  sensitive). `mapProduct` maps only the fields it needs, so the new columns are
  ignored by every existing read path — storefront reads are unaffected.

## The hold token — `app/components/CheckoutForm.tsx`

Generate `crypto.randomUUID()` once per checkout, persisted in `sessionStorage`
(so it survives "Edit details", a retry, and a 3-D Secure redirect back), and send
it as a hidden field `reservation_token`. If `sessionStorage` throws, fall back to
an in-memory token for the page session (survives edits within the load; a full
reload yields a new token — worst case the buyer's own stale hold could block them
for up to 15 min, which is rare and self-heals).

## The claim — `app/lib/orders.ts` (`createOrderAndIntent`)

A constant `RESERVATION_MINUTES = 15`. After the item list is built and the
existing friendly `product.soldOut` pre-check passes, and **before** inserting the
order or creating the PaymentIntent, claim every cart item via the service role:

- Read `reservation_token`; validate it looks like a UUID (`/^[0-9a-f-]{36}$/i`),
  else mint a fresh server-side token so a garbled/absent value still yields a
  clean hold.
- For each item, `svc.rpc('claim_product', { p_id, p_token, p_minutes: 15 })`.
  Carts are tiny (usually one one-of-a-kind piece), so a per-item loop is fine.
- Any item that returns `false` (sold out, or held by someone else) is collected
  by name. If **any** failed → return an error mirroring the sold-out copy:
  *"Sorry, someone's just buying <names> — please remove <it/them> to continue."*
  **No order and no PaymentIntent are created.**

This supplements the existing `soldOut` read-check (kept as a fast, friendly
pre-filter) with the authoritative atomic guard. On a buyer's own re-submit the
same token re-claims/extends its hold, so they're never blocked by themselves.

## Payment success / abandonment

- **Success:** unchanged — the webhook already sets `sold_out = true` (permanent),
  which overrides the hold everywhere. No webhook change.
- **Abandonment:** nothing to do — the hold self-expires after 15 minutes. A failed
  payment + retry re-claims via the same token.

## Unchanged read paths

`getProducts` / `mapProduct` / the product page / `getUnavailableProductIds` all
keep keying off `sold_out` only. The claim at checkout is the gate.

## Out of scope (deliberately)

- Reflecting live holds in the storefront / product page / cart display (deferred
  — the checkout claim prevents the oversell).
- A cron or background release job (self-expiry covers it).
- Auto-refunding a collided order (prevention makes it unnecessary).
- Different handling for pickup vs delivery (the same claim applies to any order).

## Edge cases

- **Two buyers submit the same instant:** the conditional `UPDATE` is row-atomic →
  exactly one claim wins; the other returns `false` → rejected.
- **Buyer edits details / retries payment / returns from 3-D Secure:** same token →
  re-claims and extends its own hold.
- **Multi-item cart:** each item claimed independently; any item held by someone
  else → reject and name it (like sold-out today). A partially-claimed cart is
  fine — the buyer's held items expire or are re-used on retry.
- **`sessionStorage` blocked:** in-memory token for the page session (details above).
- **Garbled/malicious token:** validated to UUID shape; else a fresh server token.
  (The RPC parameterises the token, so there's no injection surface regardless.)
- **Genuinely sold out:** the RPC's `sold_out = false` guard fails → reported, as
  today.
- **No-Stripe fallback path** (no keys): still claims, then flips `sold_out` inline
  on "success" exactly as today.

## Verification

- `tsc` clean; `npm run build` succeeds (no test runner — project convention).
- **Manual (two browser sessions, same item):** session A reaches the payment step
  (holds it); session B clicking "Continue to payment" is rejected with "someone's
  just buying this." A completes → the piece is permanently sold out. Abandon A
  (don't pay) and set its `reserved_until` to the past (or wait 15 min) → B can buy.
  A single buyer's edit/retry is never blocked. Normal single-buyer and sold-out
  flows are unchanged.
- **Owner:** run migration `0017` in Supabase before deploying.
