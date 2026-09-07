# Delayed Review Email Implementation Plan

> **Reconciled with what shipped.** This plan originally targeted a "5 days after
> paid" trigger with two separate crons. The as-built feature differs in two ways
> and the plan below reflects the shipped code: (1) the automatic trigger is
> **5 days after an order is marked posted** (migration `0016` adds `posted_at`;
> `updateOrderStatus` stamps it) — an interim paid-based version was built then
> reverted per the owner's preference; (2) the Vercel plan allows one cron/day, so
> the review-invite run is **folded into the existing keep-alive cron** (batch
> logic in `app/lib/review-invites.ts`), with `/api/review-invites` kept as a
> manual trigger.
>
> **For agentic workers:** the feature is already implemented and merged. This is
> an as-built record, not an unstarted plan.

**Goal:** Send the "leave a review" invite as a separate email ~5 days after an order is marked posted (via a daily cron, new orders only), give the admin a manual "Send review request" button for any paid order (incl. the backlog), and remove the invite from the order confirmation email.

**Architecture:** Three columns on `orders` — `posted_at` (stamped when an order is first marked posted; the trigger), `review_invite_sent_at` (stamped when an email is actually sent, by cron or button), and `auto_review_invite` (whether the automatic job may email it; backfilled `false` for existing orders). A shared `sendDueReviewInvites()` emails eligible new orders and stamps them; it runs from the daily keep-alive cron and from a `/api/review-invites` manual trigger. An admin button sends on demand.

**Tech Stack:** Next.js 16 (App Router Route Handlers + Server Actions), React 19, TypeScript, Supabase (Postgres + service role), Resend, Vercel Cron. No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus manual checks.

---

## Conventions

- **No unit tests / no test runner** (project rule). Verify with `npx tsc --noEmit` and `npm run build`; runtime behaviour verified manually.
- **Migrations `0015` + `0016` are owner ops** — run in the Supabase SQL editor. `0015` backfills `auto_review_invite=false` on existing orders; `0016` adds `posted_at`.
- Follow existing patterns: the keep-alive route's `CRON_SECRET` guard, `sendOrderEmails`' Resend guard, the `RelistButton` client-action pattern, and `updateOrderStatus`' auth check.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0015_review_invites.sql` | Create | `review_invite_sent_at` + `auto_review_invite`; backfill backlog |
| `supabase/migrations/0016_order_posted_at.sql` | Create | `posted_at` (the trigger) |
| `supabase/schema.sql` | Modify | Mirror the three columns |
| `app/data/types.ts` | Modify | `Order` gains `reviewInviteSentAt` |
| `app/admin/orders/queries.ts` | Modify | Map `review_invite_sent_at` |
| `app/lib/email.ts` | Modify | Review-request email + sender; remove invite from confirmation |
| `app/lib/review-invites.ts` | Create | `sendDueReviewInvites()` — eligible orders → send + stamp |
| `app/api/review-invites/route.ts` | Create | `CRON_SECRET`-guarded manual trigger (calls the shared fn) |
| `app/api/keep-alive/route.ts` | Modify | The daily cron: after the ping, run `sendDueReviewInvites()` |
| `app/admin/orders/actions.ts` | Modify | Stamp `posted_at` on "posted"; `sendReviewInvite` action |
| `app/admin/orders/ReviewRequestButton.tsx` | Create | Client button (send / re-send, shows sent state) |
| `app/admin/orders/page.tsx` | Modify | Render the button on paid, non-cancelled orders |
| `vercel.json` | Modify | Single daily cron `/api/keep-alive` at `0 9 * * *` |

---

## Task 1: Data model — migrations, schema, `Order` type, query mapping

**`supabase/migrations/0015_review_invites.sql`:**

```sql
alter table orders
  add column if not exists review_invite_sent_at timestamptz,
  add column if not exists auto_review_invite boolean not null default true;
update orders set auto_review_invite = false;   -- backlog is manual-only
```

**`supabase/migrations/0016_order_posted_at.sql`:**

```sql
alter table orders
  add column if not exists posted_at timestamptz;
```

Mirror the three columns in `supabase/schema.sql` (near the other timestamps).
`app/data/types.ts` `Order` gains `reviewInviteSentAt: string | null`;
`app/admin/orders/queries.ts` maps `review_invite_sent_at` in `OrderRow` +
`mapOrder`. (`posted_at` / `auto_review_invite` are read as raw columns by the
status action and cron, so they are not on the `Order` type.)

- [ ] `npx tsc --noEmit` clean; commit.

## Task 2: Review-request email + move the invite out of the confirmation

In `app/lib/email.ts`:

```ts
export interface ReviewRequestData {
  reference: string;
  customerName: string;
  customerEmail: string;
}

function reviewRequestHtml(data: ReviewRequestData): string {
  const first = esc(data.customerName.split(' ')[0] || data.customerName);
  const inner = [reviewInviteBlock(data.reference), followBlock()].join(gap());
  return shell(
    'How are you enjoying your BLG Creations order?',
    `Hi ${first}`,
    `We hope your order (${esc(data.reference)}) arrived safely and you&rsquo;re loving it. If you have a moment, we&rsquo;d be so grateful for a quick review.`,
    inner,
  );
}

// Returns true ONLY on a successful send, so callers stamp review_invite_sent_at
// only when the email actually went out. Buyer only. Never throws.
export async function sendReviewRequestEmail(data: ReviewRequestData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM missing — skipping review email for', data.reference);
    return false;
  }
  try {
    await new Resend(apiKey).emails.send({
      from,
      to: data.customerEmail,
      subject: 'How are you enjoying your BLG Creations order?',
      html: reviewRequestHtml(data),
    });
    return true;
  } catch (e) {
    console.error('[email] review request failed for', data.reference, e);
    return false;
  }
}
```

Remove `reviewInviteBlock(data.reference)` from `customerHtml`'s `inner` array
(the confirmation email no longer carries the review button; `reviewInviteBlock`
is still used — now by `reviewRequestHtml`).

- [ ] `tsc` + build clean; commit.

## Task 3: Stamp `posted_at` + the review-invite run (cron)

**Stamp `posted_at`** in `app/admin/orders/actions.ts` `updateOrderStatus`, after the status update:

```ts
if (status === 'posted') {
  await supabase
    .from('orders')
    .update({ posted_at: new Date().toISOString() })
    .eq('id', id)
    .is('posted_at', null);   // only the first time — re-marking doesn't reset the clock
}
```

**Shared batch logic** — `app/lib/review-invites.ts`:

```ts
import { createServiceClient } from './supabase';
import { sendReviewRequestEmail } from './email';

const REVIEW_DELAY_DAYS = 5; // days after an order is marked posted

interface EligibleOrder { id: string; order_number: number; customer_name: string; customer_email: string; }
export interface ReviewInviteRun { ok: boolean; considered: number; sent: number; failed: number; error?: string; }

export async function sendDueReviewInvites(): Promise<ReviewInviteRun> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true, considered: 0, sent: 0, failed: 0 };
  }
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - REVIEW_DELAY_DAYS * 86_400_000).toISOString();

  const { data, error } = await svc
    .from('orders')
    .select('id, order_number, customer_name, customer_email')
    .eq('payment_status', 'paid')        // excludes unpaid + refunded
    .eq('auto_review_invite', true)      // excludes the pre-launch backlog
    .is('review_invite_sent_at', null)
    .neq('status', 'cancelled')
    .lte('posted_at', cutoff)            // 5 days after the order was marked posted
    .limit(50);

  if (error) {
    console.error('[review-invites] query failed:', error.message);
    return { ok: false, considered: 0, sent: 0, failed: 0, error: error.message };
  }
  const orders = (data ?? []) as EligibleOrder[];
  let sent = 0, failed = 0;
  for (const o of orders) {
    const reference = `BLG-${o.order_number}`;
    const okSent = await sendReviewRequestEmail({ reference, customerName: o.customer_name, customerEmail: o.customer_email });
    if (!okSent) { failed++; continue; }
    const { error: stampError } = await svc
      .from('orders')
      .update({ review_invite_sent_at: new Date().toISOString() })
      .eq('id', o.id);
    if (stampError) { console.error('[review-invites] sent but failed to stamp', reference, stampError.message); failed++; }
    else sent++;
  }
  return { ok: true, considered: orders.length, sent, failed };
}
```

**Manual trigger** — `app/api/review-invites/route.ts` (thin wrapper):

```ts
import { sendDueReviewInvites } from '../../lib/review-invites';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await sendDueReviewInvites();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
```

**Daily cron** — `app/api/keep-alive/route.ts`, after the existing Supabase ping:

```ts
// The plan allows a single daily cron, so this same job also sends any due
// review invites. Best-effort: a failure here must not fail the keep-alive.
let reviewInvites;
try {
  reviewInvites = await sendDueReviewInvites();
} catch (e) {
  console.error('[keep-alive] review invites run threw:', e);
}
return Response.json({ ok: true, pinged: true, at: new Date().toISOString(), reviewInvites });
```

- [ ] `tsc` + build clean; commit.

## Task 4: Manual "Send review request" button

**`app/admin/orders/actions.ts`** — `sendReviewInvite(id)`: auth-gated, loads the
order, guards `payment_status='paid'` + `status<>'cancelled'`, calls
`sendReviewRequestEmail`, stamps `review_invite_sent_at` on success,
`revalidatePath('/admin/orders')`, returns `{ error? }`.

**`app/admin/orders/ReviewRequestButton.tsx`** — client component: shows
**"Send review request"** until sent, then **"✓ Review requested {date}"** + a
`confirm()`-guarded **"Send again"**; calls `sendReviewInvite(orderId)`.

**`app/admin/orders/page.tsx`** — render it on paid, non-cancelled orders in the
order card's action row:

```tsx
{o.paymentStatus === 'paid' && o.status !== 'cancelled' && (
  <ReviewRequestButton orderId={o.id} sentAt={o.reviewInviteSentAt} />
)}
```

- [ ] `tsc` + build clean; commit.

## Task 5: `vercel.json` — single daily cron

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/keep-alive", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] commit.

## Task 6: Verification + owner ops

- [ ] `npx tsc --noEmit && npm run build` clean.
- [ ] Owner: apply migrations `0015` and `0016` in Supabase.
- [ ] Manual: mark a test order posted, backdate its `posted_at` to >5 days ago, hit `/api/keep-alive` (or `/api/review-invites` with the `CRON_SECRET` bearer) → email sent + stamped; hit again → no re-send. Confirm an order that isn't posted, and a backlog order (`auto_review_invite=false`), are skipped. In Admin → Orders, the **Send review request** button sends on demand; the confirmation email no longer shows the review button.
- [ ] Confirm the single cron shows at `0 9 * * *` in the Vercel dashboard.

## Out of scope (from the spec)

Real delivery tracking · per-hour precision · reminder emails · de-duping across a customer's orders · an admin delay setting · re-send throttling beyond the confirm dialog.
