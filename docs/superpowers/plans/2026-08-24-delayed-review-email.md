# Delayed Review Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the "leave a review" invite as a separate email ~5 days after an order is paid (via a daily cron, new orders only), give the admin a manual "Send review request" button for any paid order (incl. the backlog), and remove the invite from the order confirmation email.

**Architecture:** Two columns on `orders` — `review_invite_sent_at` (stamped when an email is actually sent, by cron or button) and `auto_review_invite` (whether the automatic job may email it; backfilled `false` for existing orders). A daily Vercel cron (`/api/review-invites`, like keep-alive) emails eligible new orders and stamps them; an admin button sends on demand. Both crons align to `0 9 * * *`.

**Tech Stack:** Next.js 16 (App Router Route Handlers + Server Actions), React 19, TypeScript, Supabase (Postgres + service role), Resend, Vercel Cron. No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus manual checks in the final task.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify each task with `npx tsc --noEmit` and, where noted, `npm run build`. Runtime behaviour is verified manually in the final task.
- **Commits are LOCAL only.** Work is on branch `feat/delayed-review-email` (already checked out). **Do not push** — pushing `main` auto-deploys production. The owner pushes/merges after review.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Migration `0015` is an owner op** (Task 6). It backfills `auto_review_invite=false` on existing orders, so the automatic job never touches the backlog.
- Follow existing patterns: the keep-alive route's `CRON_SECRET` guard, `sendOrderEmails`' Resend guard, the `RelistButton` client-action pattern, and `updateOrderStatus`' auth check.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0015_review_invites.sql` | Create | Add `review_invite_sent_at` + `auto_review_invite`; backfill backlog |
| `supabase/schema.sql` | Modify | Mirror the two columns |
| `app/data/types.ts` | Modify | `Order` gains `reviewInviteSentAt` |
| `app/admin/orders/queries.ts` | Modify | Map `review_invite_sent_at` |
| `app/lib/email.ts` | Modify | Review-request email + sender; remove invite from confirmation |
| `app/api/review-invites/route.ts` | Create | Daily cron: eligible new orders → send + stamp |
| `app/admin/orders/actions.ts` | Modify | `sendReviewInvite` server action |
| `app/admin/orders/ReviewRequestButton.tsx` | Create | Client button (send / re-send, shows sent state) |
| `app/admin/orders/page.tsx` | Modify | Render the button on paid, non-cancelled orders |
| `vercel.json` | Modify | Align both crons to `0 9 * * *`; add the new one |

---

## Task 1: Migration + schema + `Order` type + query mapping

Adding a required field to `Order` makes `tsc` fail until `mapOrder` sets it, so the type and its mapper change together. SQL isn't type-checked.

**Files:**
- Create: `supabase/migrations/0015_review_invites.sql`
- Modify: `supabase/schema.sql`, `app/data/types.ts`, `app/admin/orders/queries.ts`

- [ ] **Step 1: Create `supabase/migrations/0015_review_invites.sql`**

```sql
-- 0015_review_invites.sql
-- Support the delayed + manual "leave a review" email:
--   review_invite_sent_at — when a review email was actually sent (cron or button)
--   auto_review_invite     — whether the automatic job may email this order
-- Existing orders are handled manually (the button), so the automatic job skips
-- them: backfill auto_review_invite=false. New orders default true.
-- Run this once in the Supabase SQL editor.

alter table orders
  add column if not exists review_invite_sent_at timestamptz,
  add column if not exists auto_review_invite boolean not null default true;

update orders set auto_review_invite = false;
```

- [ ] **Step 2: Mirror the columns in `supabase/schema.sql`**

Find:

```sql
  refunded_amount numeric(10,2),
  refunded_at    timestamptz,
  created_at     timestamptz not null default now(),
```

Replace with:

```sql
  refunded_amount numeric(10,2),
  refunded_at    timestamptz,
  review_invite_sent_at timestamptz,             -- set when a review email is sent
  auto_review_invite boolean not null default true, -- automatic job may email this order
  created_at     timestamptz not null default now(),
```

- [ ] **Step 3: Add `reviewInviteSentAt` to the `Order` interface in `app/data/types.ts`**

Find:

```ts
  /** ISO timestamp of the first refund; null until then. */
  refundedAt: string | null;
  createdAt: string;
```

Replace with:

```ts
  /** ISO timestamp of the first refund; null until then. */
  refundedAt: string | null;
  /** When a review-request email was sent for this order; null if never. */
  reviewInviteSentAt: string | null;
  createdAt: string;
```

- [ ] **Step 4: Add the column to `OrderRow` in `app/admin/orders/queries.ts`**

Find:

```ts
  refunded_amount?: number | string | null;
  refunded_at?: string | null;
  created_at: string;
```

Replace with:

```ts
  refunded_amount?: number | string | null;
  refunded_at?: string | null;
  review_invite_sent_at?: string | null;
  created_at: string;
```

- [ ] **Step 5: Map it in `mapOrder` (same file)**

Find:

```ts
    refundedAt: r.refunded_at ?? null,
    createdAt: r.created_at,
```

Replace with:

```ts
    refundedAt: r.refunded_at ?? null,
    reviewInviteSentAt: r.review_invite_sent_at ?? null,
    createdAt: r.created_at,
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0015_review_invites.sql supabase/schema.sql app/data/types.ts app/admin/orders/queries.ts
git commit -m "Add migration 0015: review invite columns + Order.reviewInviteSentAt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Review-request email + move the invite out of the confirmation

**Files:**
- Modify: `app/lib/email.ts`

- [ ] **Step 1: Add `ReviewRequestData` + `reviewRequestHtml` + `sendReviewRequestEmail`**

In `app/lib/email.ts`, find the end of `sendOrderEmails`:

```ts
  } else {
    console.warn('[email] OWNER_ORDER_EMAIL not set — owner alert skipped for', data.reference);
  }
}
```

Immediately after that closing brace, append:

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

/**
 * Send the "leave a review" email to the buyer. Returns true ONLY on a
 * successful send, so callers (cron + admin button) stamp review_invite_sent_at
 * only when the email actually went out. Never throws.
 */
export async function sendReviewRequestEmail(data: ReviewRequestData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM missing — skipping review email for', data.reference);
    return false;
  }
  try {
    // No explicit Reply-To (as with the order emails): a reply goes to the From
    // address (orders@blgcreations.co.uk), the mailbox the owner reads.
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

- [ ] **Step 2: Remove the review button from the confirmation email**

In `customerHtml`, find:

```ts
  const inner = [
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
    reviewInviteBlock(data.reference),
    followBlock(),
  ].join(gap());
```

Replace with:

```ts
  const inner = [
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
    followBlock(),
  ].join(gap());
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`reviewInviteBlock` is still used — now by `reviewRequestHtml` — so no unused-symbol error.)

- [ ] **Step 4: Commit**

```bash
git add app/lib/email.ts
git commit -m "Emails: review-request email; drop invite from confirmation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: The daily cron route

**Files:**
- Create: `app/api/review-invites/route.ts`

- [ ] **Step 1: Create `app/api/review-invites/route.ts`**

```ts
import { createServiceClient } from '../../lib/supabase';
import { sendReviewRequestEmail } from '../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Days after payment before the review email is sent. A once-daily cron, so it's
// "at least this many days".
const REVIEW_DELAY_DAYS = 5;

interface EligibleOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
}

// Sends the delayed review invite to orders that are due. Triggered daily by a
// Vercel Cron (see vercel.json). New orders only (auto_review_invite), paid >= N
// days ago, not cancelled/refunded, not already sent. Idempotent.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: true, sent: 0, reason: 'supabase not configured' });
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
    .lte('paid_at', cutoff)
    .limit(50);

  if (error) {
    console.error('[review-invites] query failed:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const orders = (data ?? []) as EligibleOrder[];
  let sent = 0;
  let failed = 0;
  for (const o of orders) {
    const reference = `BLG-${o.order_number}`;
    const ok = await sendReviewRequestEmail({
      reference,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
    });
    if (!ok) {
      failed++;
      continue; // leave unstamped — retry next run
    }
    const { error: stampError } = await svc
      .from('orders')
      .update({ review_invite_sent_at: new Date().toISOString() })
      .eq('id', o.id);
    if (stampError) {
      console.error('[review-invites] sent but failed to stamp', reference, stampError.message);
      failed++;
    } else {
      sent++;
    }
  }

  return Response.json({ ok: true, considered: orders.length, sent, failed });
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/api/review-invites` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/review-invites/route.ts
git commit -m "Add /api/review-invites daily cron (new orders, send + stamp)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Manual "Send review request" button

**Files:**
- Modify: `app/admin/orders/actions.ts`
- Create: `app/admin/orders/ReviewRequestButton.tsx`
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Import the email sender in `app/admin/orders/actions.ts`**

Find:

```ts
import { createServerSupabase } from '../../lib/supabase-server';
import type { OrderStatus } from '../../data/types';
```

Replace with:

```ts
import { createServerSupabase } from '../../lib/supabase-server';
import { sendReviewRequestEmail } from '../../lib/email';
import type { OrderStatus } from '../../data/types';
```

- [ ] **Step 2: Add the `sendReviewInvite` action at the end of `app/admin/orders/actions.ts`**

Append to the file:

```ts

// Send a review-request email for one order on demand (admin button). Works on
// any paid, non-cancelled order — including the pre-launch backlog. Stamps
// review_invite_sent_at on success so the automatic job won't also send it.
export async function sendReviewInvite(id: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: order, error } = await supabase
    .from('orders')
    .select('order_number, customer_name, customer_email, payment_status, status')
    .eq('id', id)
    .maybeSingle();
  if (error || !order) return { error: 'Could not load the order.' };
  if (order.payment_status !== 'paid' || order.status === 'cancelled') {
    return { error: 'Review requests are only for paid, active orders.' };
  }

  const ok = await sendReviewRequestEmail({
    reference: `BLG-${order.order_number}`,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
  });
  if (!ok) return { error: 'The email could not be sent — check the email settings and try again.' };

  const { error: stampError } = await supabase
    .from('orders')
    .update({ review_invite_sent_at: new Date().toISOString() })
    .eq('id', id);
  if (stampError) return { error: `Sent, but failed to record it: ${stampError.message}` };

  revalidatePath('/admin/orders');
  return {};
}
```

- [ ] **Step 3: Create `app/admin/orders/ReviewRequestButton.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { sendReviewInvite } from './actions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Request a review for one order on demand. Shows a send button until an invite
// has gone out, then the sent date + a guarded "Send again".
export function ReviewRequestButton({ orderId, sentAt }: { orderId: string; sentAt: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(sentAt);

  function send(confirmFirst: boolean) {
    if (confirmFirst && !confirm('A review request was already sent for this order. Send it again?')) return;
    startTransition(async () => {
      setError(null);
      const res = await sendReviewInvite(orderId);
      if (res?.error) setError(res.error);
      else setSent(new Date().toISOString());
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      {sent ? (
        <span className="inline-flex items-center gap-2 font-body text-xs text-ink-light">
          <span className="text-green-700">&#10003; Review requested {formatDate(sent)}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => send(true)}
            className="cursor-pointer text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send again'}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => send(false)}
          className="cursor-pointer inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border border-kraft-light text-ink-light hover:border-kraft transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
        >
          {isPending ? 'Sending…' : 'Send review request'}
        </button>
      )}
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Import the button in `app/admin/orders/page.tsx`**

Find:

```tsx
import { OrderStatusControl } from './OrderStatusControl';
import { RelistButton } from './RelistButton';
import type { OrderStatus, PaymentStatus } from '../../data/types';
```

Replace with:

```tsx
import { OrderStatusControl } from './OrderStatusControl';
import { RelistButton } from './RelistButton';
import { ReviewRequestButton } from './ReviewRequestButton';
import type { OrderStatus, PaymentStatus } from '../../data/types';
```

- [ ] **Step 5: Render the button in the order card's action row**

In `app/admin/orders/page.tsx`, find:

```tsx
                  <div className="mt-4 border-t border-cream-dark pt-3 flex justify-end">
                    <OrderStatusControl id={o.id} status={o.status} />
                  </div>
```

Replace with:

```tsx
                  <div className="mt-4 border-t border-cream-dark pt-3 flex flex-wrap items-center gap-3">
                    {o.paymentStatus === 'paid' && o.status !== 'cancelled' && (
                      <ReviewRequestButton orderId={o.id} sentAt={o.reviewInviteSentAt} />
                    )}
                    <div className="ml-auto">
                      <OrderStatusControl id={o.id} status={o.status} />
                    </div>
                  </div>
```

- [ ] **Step 6: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/admin/orders` still compiles.

- [ ] **Step 7: Commit**

```bash
git add app/admin/orders/actions.ts app/admin/orders/ReviewRequestButton.tsx app/admin/orders/page.tsx
git commit -m "Admin orders: manual Send review request button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Align the crons in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Set both crons to `0 9 * * *`**

Find:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Replace with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/review-invites",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "Crons: align keep-alive + review-invites to 09:00 UTC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Full verification + owner ops (deploy-time)

No new code.

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds; `/api/review-invites` present.

- [ ] **Step 2: Owner op — apply the migration**

In **Supabase → SQL Editor**, run the contents of `supabase/migrations/0015_review_invites.sql` (adds the two columns and backfills `auto_review_invite=false` on existing orders).

- [ ] **Step 3: Owner op — confirm the Vercel cron allowance**

Confirm the plan permits **two** daily cron jobs. If capped, call the review-invite logic from inside `/api/keep-alive` and drop the `/api/review-invites` entry.

- [ ] **Step 4: Manual end-to-end check**

With the migration applied and the dev server running (`npm run dev`) — or a preview deploy:
- **Admin button:** open `/admin/orders`, click **Send review request** on a paid order → the buyer gets the email, the button becomes **"✓ Review requested {date}"**. Confirm a cancelled/unpaid order shows **no** button.
- **Cron (new order):** in Supabase, take a paid order, set `auto_review_invite = true`, `review_invite_sent_at = null`, and backdate `paid_at` to 6+ days ago. `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/review-invites` → `{ ok:true, sent:1, ... }`, email arrives, `review_invite_sent_at` set. Hit again → `sent:0`.
- **Backlog skipped:** confirm an order with `auto_review_invite = false` and a >5-day-old `paid_at` is **not** picked up by the cron.
- **Confirmation email:** inspect `customerHtml` / a fresh order email → the review button is **gone**.

- [ ] **Step 5: Report status (do NOT push)**

Summarize tsc/build + the manual checks. The owner applies migration `0015`, confirms the cron allowance, then merges `feat/delayed-review-email` to `main` (which deploys); both crons then show at `0 9 * * *` in the Vercel dashboard.

## Out of scope (from the spec)

Real delivery tracking · per-hour precision · reminder emails · de-duping across a customer's orders · an admin delay setting · re-send throttling beyond the confirm dialog.
