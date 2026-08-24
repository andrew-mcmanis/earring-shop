# Delayed review email — design

_Date: 2026-08-24_

## Problem

The customer-reviews feature put a "Leave a review" button in the **order
confirmation email**, which is sent the moment payment succeeds — before the
customer has received or worn the piece. A review request lands far better a few
days *after* delivery. Bev asked for the invite to be sent automatically as a
separate email a few days later.

The catch: the app has **no delivery signal** — there's no courier/tracking
integration. The closest real signal is when Bev marks an order **Posted**. So
"a few days after delivery" is implemented as "a few days after Posted" for
delivery orders (and, since pickup orders never get a Posted event, "a few days
after payment" for pickups).

## Decisions (confirmed with the owner)

- **Separate, delayed email — not the confirmation.** The review CTA is **removed
  from the confirmation email** entirely and moved into the new delayed email, so
  the ask happens once, well-timed.
- **5-day delay.** Delivery: 5 days after `posted_at`. Pickup: 5 days after
  `paid_at`. It's **"at least 5 days"** — a once-daily cron fires it on the first
  run past the mark (so effectively 5–6 days), which is fine for this purpose.
- **Cron-based, not Resend `scheduledAt`.** A daily job evaluates *current* order
  state at send time, so a refund or cancellation in the interim naturally
  suppresses the email — no scheduled-send cancellation logic. (Rejected: Resend
  `scheduledAt` — would need cancel-on-refund handling and is bound by Resend's
  scheduling window.)
- **Both crons fire together at `0 9 * * *` (09:00 UTC ≈ 9–10am UK).** The
  existing keep-alive cron moves from `0 6 * * *` to `0 9 * * *`; the new cron
  runs at the same time. Vercel crons are UTC-only, so UK local time drifts an
  hour across BST/GMT — harmless here.
- **Both order types invited.** Delivery keyed off Posted, pickup off payment.
- **One invite per order, never repeated** (a `review_invite_sent_at` stamp).

## Data model — migration `0015_review_invites.sql`

_(Next free migration; highest existing is `0014`.)_

```sql
alter table orders
  add column if not exists posted_at timestamptz,
  add column if not exists review_invite_sent_at timestamptz;
```

- `posted_at` — stamped the **first** time an order's status becomes `posted`
  (status changes aren't timestamped today).
- `review_invite_sent_at` — stamped by the cron when the invite is sent; the
  `IS NULL` filter is what stops re-sends.
- Mirror both in `supabase/schema.sql` (repo convention). **Owner runs `0015` by
  hand in the Supabase SQL editor** before the cron relies on the columns.
- No `Order` type / admin-query change needed — the cron reads the raw columns
  via the service client, and `posted_at` is written by the status action (below).

## Stamp `posted_at` — `app/admin/orders/actions.ts`

`updateOrderStatus` currently does `update({ status }).eq('id', id)`. Add: when
the new status is `posted`, also stamp `posted_at = now()` **only if it's still
null**, via a guarded follow-up update:

```ts
if (status === 'posted') {
  await supabase.from('orders')
    .update({ posted_at: new Date().toISOString() })
    .eq('id', id)
    .is('posted_at', null);   // only the first time — re-marking doesn't reset the 5-day clock
}
```

Uses the existing signed-in admin client; the `admin update orders` RLS policy
already permits it.

## Cron route — `app/api/review-invites/route.ts`

Mirrors `app/api/keep-alive/route.ts`: a `GET` handler, `runtime = 'nodejs'`,
`dynamic = 'force-dynamic'`, guarded by the same `CRON_SECRET` bearer check
(Vercel sends it automatically on cron invocations).

- Uses the **service client** (bypasses RLS).
- A single delay constant `REVIEW_DELAY_DAYS = 5`; compute
  `cutoff = new Date(Date.now() - REVIEW_DELAY_DAYS * 86_400_000).toISOString()`.
- **Eligibility** (select `id, order_number, customer_name, customer_email`,
  `.limit(50)` to bound a run — extras roll to the next day):
  - `payment_status = 'paid'` (excludes unpaid + refunded)
  - `review_invite_sent_at IS NULL`
  - AND either:
    - **delivery**: `fulfilment_method='delivery' AND status='posted' AND posted_at ≤ cutoff`, or
    - **pickup**: `fulfilment_method='pickup' AND status<>'cancelled' AND paid_at ≤ cutoff`
  - Implemented with PostgREST `.or('and(...),and(...)')` plus the `.eq`/`.is`
    filters above.
- **Per order:** call `sendReviewRequestEmail(...)`; **only if it returns `true`**
  (a real send), stamp `review_invite_sent_at = now()` for that `id`. Each order
  is independent (per-order try/catch) so one failure doesn't block the rest.
- Returns JSON `{ ok, sent, failed }`.
- **Idempotency:** the `IS NULL` filter + per-order stamp prevents re-sends across
  runs. Send-then-stamp (gated on success) means a crash between a successful send
  and its stamp would at worst resend once next day — acceptable for a review
  nudge; a *missed* send (no stamp) simply retries next day.

## Email — `app/lib/email.ts`

- **New `reviewRequestHtml(data)`** — reuses the existing `shell()`: greeting
  `Hi {first}`, an intro hoping the order (by reference) has arrived and they're
  enjoying it, and `inner = [reviewInviteBlock(reference), followBlock()]`.
  `reviewInviteBlock` already exists (from the reviews feature) — **reused, not
  duplicated**.
- **New `sendReviewRequestEmail({ reference, customerName, customerEmail }):
  Promise<boolean>`** — mirrors `sendOrderEmails`' config guard
  (`RESEND_API_KEY`/`RESEND_FROM`) and try/catch logging, but **returns `true`
  only on a successful send** (so the cron stamps only when the email actually
  went out; missing config or a send error returns `false` → retried next day).
  Sends to the **buyer only**. Never throws into the cron.
- **Remove** `reviewInviteBlock(data.reference)` from `customerHtml`'s `inner`
  array — the confirmation email no longer carries the review button.

## `vercel.json`

Two crons, both at `0 9 * * *`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/keep-alive",     "schedule": "0 9 * * *" },
    { "path": "/api/review-invites", "schedule": "0 9 * * *" }
  ]
}
```

**Owner note:** confirm the Vercel plan allows two daily cron jobs. If it's
capped, the fallback is to call the review-invite logic from inside the existing
keep-alive route instead of adding a second cron. `CRON_SECRET` (already set for
keep-alive) also guards the new endpoint.

## Out of scope (deliberately)

- Real delivery tracking (courier integration).
- Per-hour precision (daily cron; "at least 5 days").
- De-duping across a customer's multiple orders (each order is invited once).
- Reminder / second-nudge emails.
- An admin setting for the delay (it's a code constant).

## Edge cases

- **Refunded/cancelled before day 5:** excluded — `payment_status='paid'` drops
  refunds; `status` conditions drop cancelled.
- **Delivery order never marked Posted:** `posted_at` stays null → never invited
  (correct: we don't know it shipped).
- **Order re-marked Posted:** `posted_at` set only when null → the 5-day clock
  isn't reset.
- **Resend not configured / send fails:** `sendReviewRequestEmail` returns
  `false` → not stamped → retried next day; the cron continues to the next order.
- **Endpoint hit without `CRON_SECRET`:** if the env var is unset the route runs
  (like keep-alive); the query only ever emails legitimately-eligible paid orders,
  and each is stamped once. Setting `CRON_SECRET` locks it to the scheduler.
- **Timezone:** `posted_at`/`paid_at` are `timestamptz`; the cutoff comparison is
  UTC-correct.

## Verification

- `tsc` clean; `npm run build` succeeds (no test runner — project convention).
- **Manual/owner:** backdate a test order's `posted_at` (or `paid_at` for a
  pickup) to >5 days ago in Supabase, then `GET /api/review-invites` with the
  `Authorization: Bearer <CRON_SECRET>` header → confirm the review email arrives
  and `review_invite_sent_at` is stamped; hit it again → **no** re-send. Confirm a
  refunded/cancelled test order is skipped, and that the confirmation email no
  longer shows the review button.
- **Deploy:** run migration `0015`; confirm both crons appear in the Vercel
  dashboard at `0 9 * * *`.
