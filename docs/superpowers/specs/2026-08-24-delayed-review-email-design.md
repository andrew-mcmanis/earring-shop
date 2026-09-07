# Delayed review email — design

_Date: 2026-08-24_

> **Reconciled with what shipped.** This spec has been updated to match the
> as-built feature. Two things changed during implementation and are reflected
> below: (1) the automatic trigger is **5 days after an order is marked posted**
> (an interim "5 days after paid" version was built then reverted to posted per
> the owner's preference — migration `0016`); (2) the Vercel plan allows a single
> daily cron, so the review-invite run is **folded into the existing keep-alive
> cron** rather than a second cron entry.

## Problem

The customer-reviews feature put a "Leave a review" button in the **order
confirmation email**, sent the moment payment succeeds — before the customer has
received the piece. A review request lands far better a few days after they have
it. Bev asked for two things:

1. Send the invite **automatically** a few days after the order goes out, as a
   separate email.
2. A **manual button** in the admin so she can request reviews from orders that
   already completed (to get reviews off the existing backlog).

## Decisions (confirmed with the owner)

- **Separate, delayed email — not the confirmation.** The review CTA is **removed
  from the confirmation email** and moved into the new delayed email.
- **Trigger: 5 days after the order is marked _posted_** (Bev's "sent" flag). The
  order status change to `posted` stamps `posted_at`, and the cron fires 5 days
  later. It's **"at least 5 days"** — a once-daily cron fires it on the first run
  past the mark.
- **Cron-based**, not Resend `scheduledAt` — a daily job evaluates *current* state
  at send time, so a refund/cancellation in between naturally suppresses it.
- **Manual "Send review request" button** in Admin → Orders, on **paid,
  non-cancelled** orders — Bev can request a review on demand, and re-send.
- **Existing orders are manual-only.** The automatic job **ignores every order
  that existed at launch** (no surprise blast to past customers); it applies only
  to orders posted from launch onward. Bev uses the button for the backlog.
- **Pickups are uniform with delivery — shown as "Collected".** For pickup
  orders the terminal `posted` status is **displayed as "Collected"** in the admin
  (the status dropdown, the order-card badge and the dashboard list); delivery
  orders still show "Posted". It's a display-only relabel keyed off fulfilment
  method — the stored status stays `posted`, so marking a pickup **Collected**
  stamps `posted_at` and fires the review email 5 days later, exactly like a
  posted delivery. No new status value, no migration. If Bev never marks a pickup
  Collected, it simply doesn't get the automatic email (the button still covers it).
- **Single daily cron at `0 9 * * *`** (09:00 UTC ≈ 9–10am UK). The plan allows
  one cron/day, so the review-invite run is folded into the existing keep-alive
  cron (moved from `0 6` to `0 9`).

## Data model — migrations `0015` + `0016`

`0015_review_invites.sql` — two columns:

```sql
alter table orders
  add column if not exists review_invite_sent_at timestamptz,
  add column if not exists auto_review_invite boolean not null default true;
update orders set auto_review_invite = false;   -- backlog is manual-only
```

`0016_order_posted_at.sql` — the timestamp the trigger keys off:

```sql
alter table orders
  add column if not exists posted_at timestamptz;
```

- **`posted_at`** — set the first time an order's status becomes `posted` (only if
  still null, so re-marking doesn't reset the clock). The automatic trigger.
- **`review_invite_sent_at`** — set only when a review email is **actually sent**
  (cron or button). Drives the admin button's state, stops the cron re-sending,
  and stops a duplicate manual send.
- **`auto_review_invite`** — whether the automatic job may email this order. New
  orders default `true`; `0015` flips **all existing rows to `false`**.

**Why `review_invite_sent_at` and `auto_review_invite` are separate:** the first
means "we emailed a review request" — it must *not* be set on the backlog, or the
admin would wrongly show those orders as already-asked. The second means "the
automatic job may handle this" — `false` for the backlog. Keeping them separate
lets the backlog show as un-asked in the admin (so the button works on it) while
the cron still skips it.

Both migrations are mirrored in `supabase/schema.sql` and run by hand in the
Supabase SQL editor. The `Order` type gains `reviewInviteSentAt` (for the button);
`posted_at` and `auto_review_invite` are read as raw columns (cron / status
action), not surfaced on the type.

## Stamp `posted_at` — `app/admin/orders/actions.ts`

`updateOrderStatus` stamps `posted_at = now()` when the new status is `posted`,
via a guarded follow-up update (`.is('posted_at', null)`) so re-marking posted
doesn't reset the 5-day clock.

## Cron — folded into `app/api/keep-alive/route.ts`

The daily keep-alive cron (already pinging Supabase to stop the free tier
pausing) also calls `sendDueReviewInvites()` after its ping — best-effort, so a
review-invite failure never fails the keep-alive. The batch logic lives in
`app/lib/review-invites.ts` and is also exposed at `app/api/review-invites/route.ts`
as a `CRON_SECRET`-guarded manual trigger.

`sendDueReviewInvites()` (service client, `limit 50`/run):
- **Eligibility:** `payment_status='paid'` (excludes unpaid + refunded) AND
  `auto_review_invite=true` (excludes the backlog) AND `review_invite_sent_at IS
  NULL` AND `status<>'cancelled'` AND `posted_at ≤ now − 5 days`.
- **Per order:** `sendReviewRequestEmail(...)`; only if it returns `true`, stamp
  `review_invite_sent_at = now()`. Each order independent.
- Returns `{ ok, considered, sent, failed }`. Idempotent (the `IS NULL` filter +
  per-order stamp prevent re-sends).

## Manual send button — Admin → Orders

- Client component **`ReviewRequestButton`** on each **paid, non-cancelled**
  order: `review_invite_sent_at` null → a **"Send review request"** button; sent →
  **"✓ Review requested {date}"** plus a guarded **"Send again"**.
- Server action **`sendReviewInvite(id)`**: auth-gated, loads the order, guards
  paid + not cancelled, calls `sendReviewRequestEmail`, stamps
  `review_invite_sent_at` on success, `revalidatePath('/admin/orders')`.

## Email — `app/lib/email.ts`

- **`reviewRequestHtml`** reuses the existing `shell()` + the shared
  `reviewInviteBlock` review CTA + `followBlock`.
- **`sendReviewRequestEmail(...): Promise<boolean>`** — mirrors `sendOrderEmails`'
  config guard, returns `true` only on a successful send. Buyer only. Never throws.
- `reviewInviteBlock` is **removed from `customerHtml`** (the confirmation email no
  longer carries the review button).

## `vercel.json`

A **single** daily cron, `/api/keep-alive` at `0 9 * * *`, which now does both the
Supabase ping and the review-invite run.

## Out of scope (deliberately)

- Real delivery tracking (posted is Bev's manual "sent" flag).
- Per-hour precision (daily cron; "at least 5 days").
- Reminder / second-nudge emails.
- De-duping across a customer's multiple orders.
- An admin setting for the delay (code constant).
- Throttling the manual "Send again" beyond a confirm dialog.

## Edge cases

- **Refunded/cancelled:** excluded — `payment_status='paid'` drops refunds; the
  `status<>'cancelled'` filter drops cancellations (and the button hides on both).
- **Never marked posted:** `posted_at` stays null → never auto-emailed (correct —
  we only ask once it's gone out). The button is still available.
- **Existing/backlog orders:** `auto_review_invite=false` → never auto-emailed;
  `review_invite_sent_at` stays null so the admin shows them un-asked and the
  button works.
- **Re-marking posted:** `posted_at` set only when null → the clock isn't reset.
- **Manual send on an eligible order:** stamps `review_invite_sent_at` → the cron
  won't also send.
- **Resend not configured / send fails:** `sendReviewRequestEmail` returns
  `false` → not stamped → retried next run; the button shows an error.
- **Timezone:** `posted_at` is `timestamptz`; the cutoff comparison is UTC-correct.

## Verification

- `tsc` clean; `npm run build` succeeds (no test runner — project convention).
- **Manual/owner:** with `0015` + `0016` applied, mark a test order posted and
  backdate its `posted_at` to >5 days ago, then hit `/api/keep-alive` (or
  `/api/review-invites` with the `CRON_SECRET` bearer) → email sent + stamped; hit
  again → no re-send. Confirm an order that isn't posted, and a backlog order
  (`auto_review_invite=false`), are skipped. In Admin → Orders, the **Send review
  request** button sends on demand. The confirmation email no longer shows the
  review button.
- Confirm the single cron shows at `0 9 * * *` in the Vercel dashboard.
