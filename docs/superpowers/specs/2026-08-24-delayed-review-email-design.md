# Delayed review email — design

_Date: 2026-08-24_

## Problem

The customer-reviews feature put a "Leave a review" button in the **order
confirmation email**, sent the moment payment succeeds — before the customer has
received the piece. A review request lands far better a few days after they have
it. Bev asked for two things:

1. Send the invite **automatically** a few days after the order completes, as a
   separate email.
2. A **manual button** in the admin so she can request reviews from orders that
   already completed (to get reviews off the existing backlog).

## Decisions (confirmed with the owner)

- **Separate, delayed email — not the confirmation.** The review CTA is **removed
  from the confirmation email** and moved into the new delayed email.
- **Trigger: 5 days after the order is _paid_** (placed & paid). We drop the
  earlier "posted" idea and its timestamp entirely. The pieces are one-of-a-kind
  and **ready-made** (already made when bought — Bev just packs and posts), so
  they ship within a day or two and "5 days after paid" lands around arrival.
  Delivery and pickup are treated identically. It's **"at least 5 days"** — a
  once-daily cron fires it on the first run past the mark.
- **Cron-based**, not Resend `scheduledAt` — a daily job evaluates *current* state
  at send time, so a refund/cancellation in between naturally suppresses it.
- **Manual "Send review request" button** in Admin → Orders, on **paid,
  non-cancelled** orders — Bev can request a review on demand, and re-send.
- **Existing orders are manual-only.** The automatic job **ignores every order
  that exists at launch** (no surprise blast to past customers); it applies only
  to orders placed from launch onward. Bev uses the button for the backlog.
- **Both crons fire at `0 9 * * *`** (09:00 UTC ≈ 9–10am UK). keep-alive moves
  from `0 6 * * *` to `0 9 * * *`.

## Data model — migration `0015_review_invites.sql`

_(Next free migration; highest existing is `0014`.)_ Two columns on `orders` —
**no `posted_at`**:

```sql
alter table orders
  add column if not exists review_invite_sent_at timestamptz,
  add column if not exists auto_review_invite boolean not null default true;

-- Existing orders are handled manually (the button), never by the automatic job.
update orders set auto_review_invite = false;
```

- **`review_invite_sent_at`** — set only when a review email is **actually sent**
  (cron or button). Null = never sent. Drives the admin button's state, stops the
  cron re-sending, and stops a duplicate manual send.
- **`auto_review_invite`** — whether the automatic job may email this order. New
  orders default `true`; the migration flips **all existing rows to `false`**.

**Why two columns:** `review_invite_sent_at` means "we emailed a review request"
— it must *not* be set on the backlog, or the admin would wrongly show those
orders as already-asked. `auto_review_invite` means "the automatic job may handle
this" — `false` for the backlog. Keeping them separate lets the backlog show as
un-asked in the admin (so the button works on it) while the cron still skips it.

Mirror both columns in `supabase/schema.sql`. **Owner runs `0015` by hand.**
The `Order` type gains `reviewInviteSentAt` (for the button); `auto_review_invite`
is cron-only (read as a raw column), not surfaced on the type.

## Cron — `app/api/review-invites/route.ts` (new, daily)

Mirrors `app/api/keep-alive/route.ts`: a `GET` handler, `runtime='nodejs'`,
`dynamic='force-dynamic'`, guarded by the same `CRON_SECRET` bearer check, using
the **service client**.

- Delay constant `REVIEW_DELAY_DAYS = 5`; `cutoff = now − 5 days`.
- **Eligibility** (select `id, order_number, customer_name, customer_email`,
  `limit 50`): `payment_status='paid'` (excludes unpaid + refunded) AND
  `auto_review_invite=true` (excludes the backlog) AND `review_invite_sent_at IS
  NULL` AND `status<>'cancelled'` AND `paid_at ≤ cutoff`. (A plain filter chain —
  no `.or()` needed now.)
- **Per order:** `sendReviewRequestEmail(...)`; **only if it returns `true`**,
  stamp `review_invite_sent_at = now()`. Each order independent; one failure
  doesn't block the rest.
- Returns JSON `{ ok, considered, sent, failed }`.
- **Idempotency:** the `IS NULL` filter + per-order stamp prevents re-sends.

## Manual send button — Admin → Orders

- New client component **`ReviewRequestButton`** on each **paid, non-cancelled**
  order, in the order card's bottom action row (beside the status control).
  - `review_invite_sent_at` null → a **"Send review request"** button.
  - already sent → **"✓ Review requested {date}"** plus a subtle **"Send again"**
    (with a `confirm()`).
- New server action **`sendReviewInvite(id)`** in `app/admin/orders/actions.ts`:
  auth-gated (same pattern as `updateOrderStatus`), loads the order, guards
  paid + not cancelled, calls `sendReviewRequestEmail`, stamps
  `review_invite_sent_at` on success, `revalidatePath('/admin/orders')`, returns
  `{ error? }`.
- `Order` + `mapOrder` gain `reviewInviteSentAt` so the page can render the state.

## Email — `app/lib/email.ts`

- **New `reviewRequestHtml(data)`** — reuses the existing `shell()`: `Hi {first}`,
  an intro hoping the order (by reference) has arrived, and
  `inner = [reviewInviteBlock(reference), followBlock()]`. `reviewInviteBlock`
  already exists (from the reviews feature) — **reused, not duplicated**.
- **New `sendReviewRequestEmail({ reference, customerName, customerEmail }):
  Promise<boolean>`** — mirrors `sendOrderEmails`' config guard, but returns
  `true` only on a successful send (so both the cron and the button stamp only
  when the email actually went out). Buyer only. Never throws.
- **Remove** `reviewInviteBlock(data.reference)` from `customerHtml`'s `inner`
  array — the confirmation email no longer carries the review button.

## `vercel.json`

Two crons, both `0 9 * * *`: `/api/keep-alive` (moved from `0 6`) and
`/api/review-invites`. **Owner note:** confirm the Vercel plan allows two daily
crons; if capped, call the review-invite logic from inside keep-alive instead.
`CRON_SECRET` (already set) guards the new endpoint.

## Out of scope (deliberately)

- Real delivery tracking.
- Per-hour precision (daily cron; "at least 5 days").
- Reminder / second-nudge emails.
- De-duping across a customer's multiple orders.
- An admin setting for the delay (code constant).
- Throttling the manual "Send again" beyond a confirm dialog.

## Edge cases

- **Refunded/cancelled:** excluded — `payment_status='paid'` drops refunds; the
  `status<>'cancelled'` filter drops cancellations (and the button hides on both).
- **Existing/backlog orders:** `auto_review_invite=false` → never auto-emailed;
  `review_invite_sent_at` stays null so the admin shows them un-asked and the
  button works.
- **Manual send on a new order:** stamps `review_invite_sent_at` → the cron won't
  also send.
- **Re-send via the button:** allowed behind a `confirm()`; re-stamps the date.
- **Resend not configured / send fails:** `sendReviewRequestEmail` returns
  `false` → not stamped → cron retries next run; the button shows an error.
- **Cron auth:** unset `CRON_SECRET` leaves the route open (like keep-alive); it
  only ever emails eligible non-backlog orders.
- **Timezone:** `paid_at` is `timestamptz`; the cutoff comparison is UTC-correct.

## Verification

- `tsc` clean; `npm run build` succeeds (no test runner — project convention).
- **Manual/owner:** with the migration applied, backdate a *new-style* order
  (`auto_review_invite=true`) `paid_at` to >5 days ago, then `GET
  /api/review-invites` with the `CRON_SECRET` bearer → email sent + stamped; hit
  again → no re-send. Confirm a backlog order (`auto_review_invite=false`) is
  **not** auto-emailed. In Admin → Orders, click **Send review request** on an
  order → email sent, shows "Review requested". Confirm refunded/cancelled orders
  show no button and aren't auto-sent, and that the confirmation email no longer
  has the review button.
- **Deploy:** run migration `0015`; confirm both crons show at `0 9 * * *`.
