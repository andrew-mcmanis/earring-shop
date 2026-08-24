# Delayed Review Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the "leave a review" invite as a separate email ~5 days after an order is delivered (posted for delivery orders, paid for pickups) via a daily cron, and remove that invite from the order confirmation email.

**Architecture:** Two new timestamp columns on `orders` (`posted_at`, stamped when Bev marks an order Posted; `review_invite_sent_at`, stamped when the invite is sent). A new daily Vercel cron (`/api/review-invites`, same shape as the existing keep-alive cron) selects eligible orders, sends a dedicated review-request email, and stamps them so it never repeats. Both crons are aligned to `0 9 * * *`.

**Tech Stack:** Next.js 16 (App Router Route Handlers), TypeScript, Supabase (Postgres + service role), Resend (email), Vercel Cron. No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus a manual cron hit in the final task.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify each task with `npx tsc --noEmit` and, where noted, `npm run build`. The cron's runtime behaviour is verified manually in the final task, not with a unit test.
- **Commits are LOCAL only.** Work is on branch `feat/delayed-review-email` (already checked out). **Do not push** — pushing `main` auto-deploys production. The owner pushes/merges after review.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Migration `0015` is an owner op** — run in the Supabase SQL editor before the cron relies on the new columns (Task 6). Because nothing existing references these columns and the cron degrades safely, a code-ahead-of-migration window is harmless (the stamp update and the cron query just no-op / error-and-skip), but apply it before trusting the feature.
- Follow existing patterns exactly: the keep-alive route's `CRON_SECRET` guard, `sendOrderEmails`' Resend config guard, and the `email.ts` `shell()` composition.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0015_review_invites.sql` | Create | Add `posted_at` + `review_invite_sent_at` to `orders` |
| `supabase/schema.sql` | Modify | Mirror the two columns (repo convention) |
| `app/admin/orders/actions.ts` | Modify | Stamp `posted_at` the first time an order is marked Posted |
| `app/lib/email.ts` | Modify | New review-request email + sender; remove invite from the confirmation email |
| `app/api/review-invites/route.ts` | Create | Daily cron: find eligible orders, send + stamp |
| `vercel.json` | Modify | Align both crons to `0 9 * * *`; add the new one |

---

## Task 1: Migration + schema mirror (data model)

SQL isn't type-checked; verify by review.

**Files:**
- Create: `supabase/migrations/0015_review_invites.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/migrations/0015_review_invites.sql`**

```sql
-- 0015_review_invites.sql
-- Support the delayed "leave a review" email:
--   posted_at             — when the order was first marked posted (delivery timing)
--   review_invite_sent_at — when the review email was sent (prevents re-sending)
-- Run this once in the Supabase SQL editor.

alter table orders
  add column if not exists posted_at timestamptz,
  add column if not exists review_invite_sent_at timestamptz;
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
  posted_at      timestamptz,                    -- set when the order is first marked posted
  review_invite_sent_at timestamptz,             -- set when the delayed review email is sent
  created_at     timestamptz not null default now(),
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_review_invites.sql supabase/schema.sql
git commit -m "Add migration 0015: posted_at + review_invite_sent_at

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Stamp `posted_at` when an order is marked Posted

`updateOrderStatus` sets the status but records no timestamp. Add a guarded stamp so `posted_at` is set the first time (and only the first time) status becomes `posted`.

**Files:**
- Modify: `app/admin/orders/actions.ts`

- [ ] **Step 1: Add the `posted_at` stamp after the status update**

In `app/admin/orders/actions.ts`, find:

```ts
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/admin/orders');
  return {};
```

Replace with:

```ts
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };

  // Stamp when the order was first marked posted — the delayed review email keys
  // off this. Only set it while still null, so re-marking posted doesn't reset
  // the 5-day clock.
  if (status === 'posted') {
    await supabase
      .from('orders')
      .update({ posted_at: new Date().toISOString() })
      .eq('id', id)
      .is('posted_at', null);
  }

  revalidatePath('/admin/orders');
  return {};
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/actions.ts
git commit -m "Stamp posted_at when an order is first marked posted

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Review-request email + move the invite out of the confirmation

Adds a dedicated delayed email (reusing the shell + the existing `reviewInviteBlock`) and a sender that returns whether it actually sent, then removes the review button from the confirmation email.

**Files:**
- Modify: `app/lib/email.ts`

- [ ] **Step 1: Add `ReviewRequestData` + `reviewRequestHtml` + `sendReviewRequestEmail`**

In `app/lib/email.ts`, find the end of `sendOrderEmails` and the file's final lines:

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
 * Send the delayed "leave a review" email to the buyer. Returns true ONLY on a
 * successful send, so the cron stamps review_invite_sent_at only when the email
 * actually went out (missing config or a send error → false → retried next run).
 * Never throws into the cron.
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
Expected: both succeed. (`reviewInviteBlock` is still used — now by `reviewRequestHtml` — so no unused-symbol error. `shell`, `gap`, `followBlock`, `esc`, `Resend` are all already in scope.)

- [ ] **Step 4: Commit**

```bash
git add app/lib/email.ts
git commit -m "Emails: delayed review-request email; drop invite from confirmation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: The daily cron route

Mirrors `app/api/keep-alive/route.ts`: a `GET` handler guarded by `CRON_SECRET`, using the service client. Selects eligible orders and sends + stamps each.

**Files:**
- Create: `app/api/review-invites/route.ts`

- [ ] **Step 1: Create `app/api/review-invites/route.ts`**

```ts
import { createServiceClient } from '../../lib/supabase';
import { sendReviewRequestEmail } from '../../lib/email';

// Signature verification / DB writes need Node; never cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Days after posting (delivery) / payment (pickup) before the review email is
// sent. A once-daily cron, so it's "at least this many days".
const REVIEW_DELAY_DAYS = 5;

interface EligibleOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
}

// Sends the delayed review invite to orders that are due. Triggered daily by a
// Vercel Cron (see vercel.json). Idempotent: only orders with a null
// review_invite_sent_at are selected, and each is stamped once sent.
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

  // Paid (excludes unpaid + refunded), never invited, and either a delivery
  // order posted >= N days ago or a pickup order paid >= N days ago.
  const { data, error } = await svc
    .from('orders')
    .select('id, order_number, customer_name, customer_email')
    .eq('payment_status', 'paid')
    .is('review_invite_sent_at', null)
    .or(
      `and(fulfilment_method.eq.delivery,status.eq.posted,posted_at.lte.${cutoff}),` +
        `and(fulfilment_method.eq.pickup,status.neq.cancelled,paid_at.lte.${cutoff})`,
    )
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
      // Not sent (missing config or send error) — leave unstamped, retry next run.
      failed++;
      continue;
    }
    const { error: stampError } = await svc
      .from('orders')
      .update({ review_invite_sent_at: new Date().toISOString() })
      .eq('id', o.id);
    if (stampError) {
      // Sent but not stamped — will resend once next run. Log it.
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
Expected: both succeed; `/api/review-invites` appears in the route list. (`createServiceClient` and `sendReviewRequestEmail` are the exports added/available in earlier tasks.)

- [ ] **Step 3: Commit**

```bash
git add app/api/review-invites/route.ts
git commit -m "Add /api/review-invites daily cron (send + stamp)

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

No new code. Gates the feature and documents the owner steps.

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds; `/api/review-invites` present in the output.

- [ ] **Step 2: Owner op — apply the migration**

In **Supabase → SQL Editor**, run the contents of `supabase/migrations/0015_review_invites.sql`:

```sql
alter table orders
  add column if not exists posted_at timestamptz,
  add column if not exists review_invite_sent_at timestamptz;
```

- [ ] **Step 3: Owner op — confirm the Vercel cron allowance**

Confirm the project's Vercel plan permits **two** daily cron jobs. If it's capped, instead of the second cron, call the review-invite logic from within `/api/keep-alive` (both run daily at the same time) and drop the `/api/review-invites` entry from `vercel.json`.

- [ ] **Step 4: Manual end-to-end check**

With the migration applied and the dev server running (`npm run dev`) — or against a preview deploy:
- In Supabase, take a **paid, delivery** order, set its `status = 'posted'` and backdate `posted_at` to 6+ days ago (and ensure `review_invite_sent_at` is null).
- `GET` the endpoint with the secret:
  `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/review-invites`
  Expected JSON like `{ ok: true, considered: 1, sent: 1, failed: 0 }`; the buyer receives the review email; the order's `review_invite_sent_at` is now set.
- Hit the endpoint **again** → `sent: 0` (no re-send).
- Backdate a **paid pickup** order's `paid_at` similarly → it's picked up too.
- Confirm a **refunded** or **cancelled** backdated order is **not** selected.
- Send yourself a normal order confirmation (or inspect `customerHtml`) → the review button is **gone** from it.

- [ ] **Step 5: Report status (do NOT push)**

Summarize tsc/build results and the manual check. The owner applies migration `0015`, confirms the cron allowance, then merges `feat/delayed-review-email` to `main` (which deploys) — after which both crons show at `0 9 * * *` in the Vercel dashboard.

## Out of scope (from the spec)

Real delivery tracking · per-hour precision · de-duping across a customer's multiple orders · reminder/second-nudge emails · an admin setting for the delay.
