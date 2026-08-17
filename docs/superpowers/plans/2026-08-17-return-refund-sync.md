# Return / Refund Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Bev refunds an order in Stripe, the app records it (amount + date, order marked Refunded) and lets her relist the returned piece in one click — no auto-restock, no refund email.

**Architecture:** A new `charge.refunded` handler in the existing Stripe webhook finds the order by its stored PaymentIntent id and writes `payment_status='refunded'` + `refunded_amount` + `refunded_at`. The admin Orders page shows a Refunded/Partially-refunded badge (derived from the amount vs the order total) and a per-item Relist button that reuses the existing `toggleSoldOut` product action.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres), Stripe (Node SDK). No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus a Stripe **test-mode / CLI-triggered** refund for the webhook (never a live refund to test).

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify with `npx tsc --noEmit` and `npm run build`. The webhook's runtime behaviour is verified with a **test-mode refund** in the final task, not a unit test.
- **Commits are LOCAL only.** Work is on branch `returns-refund-sync`. **Do not push** — pushing `main` auto-deploys production. The owner pushes after review.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Two owner ops steps** (Task 5) happen at deploy time, not in code: running migration `0011` in Supabase, and adding the `charge.refunded` event to the Stripe webhook endpoint.
- Money: Stripe amounts are in **pence**; the app stores/display pounds. Divide by 100 when writing `refunded_amount`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0011_order_refunds.sql` | Create | Add `refunded_amount` + `refunded_at` to `orders` |
| `supabase/schema.sql` | Modify | Mirror the two columns (repo convention) |
| `app/data/types.ts` | Modify | `Order` gains `refundedAmount` + `refundedAt` |
| `app/admin/orders/queries.ts` | Modify | Map the two new columns in `OrderRow`/`mapOrder` |
| `app/api/stripe/webhook/route.ts` | Modify | `charge.refunded` handler + `recordRefund` helper |
| `app/admin/orders/RelistButton.tsx` | Create | Client button → `toggleSoldOut(productId, false)` |
| `app/admin/orders/page.tsx` | Modify | Refund badge (amount + partial/full) + Relist button per item |

---

## Task 1: Migration + schema mirror (data model)

`payment_status` already allows `'refunded'` (migration `0010`), so this only adds two nullable columns. SQL files aren't type-checked; verify by review.

**Files:**
- Create: `supabase/migrations/0011_order_refunds.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/migrations/0011_order_refunds.sql`**

```sql
-- 0011: record refunds synced from Stripe's charge.refunded webhook.
-- payment_status already allows 'refunded' (migration 0010); we only add the
-- amount refunded and when. Both nullable — set on the first refund.
alter table orders
  add column if not exists refunded_amount numeric(10,2),
  add column if not exists refunded_at timestamptz;
```

- [ ] **Step 2: Mirror the columns in `supabase/schema.sql`**

Find this block in the `orders` table definition:

```sql
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
```

Replace it with:

```sql
  paid_at        timestamptz,
  refunded_amount numeric(10,2),
  refunded_at    timestamptz,
  created_at     timestamptz not null default now(),
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_order_refunds.sql supabase/schema.sql
git commit -m "Add migration 0011: order refund columns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `Order` type + query mapping

Adding required fields to `Order` makes `tsc` fail until `mapOrder` sets them, so both files change together. `mapOrder` is the only place that constructs an `Order`.

**Files:**
- Modify: `app/data/types.ts`
- Modify: `app/admin/orders/queries.ts`

- [ ] **Step 1: Add the two fields to the `Order` interface in `app/data/types.ts`**

Find:

```ts
  stripePaymentIntent: string | null;
  /** ISO timestamp set when the payment webhook marked the order paid. */
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
```

Replace with:

```ts
  stripePaymentIntent: string | null;
  /** ISO timestamp set when the payment webhook marked the order paid. */
  paidAt: string | null;
  /** Cumulative amount refunded (pounds); null until a refund syncs in. */
  refundedAmount: number | null;
  /** ISO timestamp of the first refund; null until then. */
  refundedAt: string | null;
  createdAt: string;
  items: OrderItem[];
```

- [ ] **Step 2: Add the columns to `OrderRow` in `app/admin/orders/queries.ts`**

Find:

```ts
  stripe_payment_intent?: string | null;
  paid_at?: string | null;
  created_at: string;
```

Replace with:

```ts
  stripe_payment_intent?: string | null;
  paid_at?: string | null;
  refunded_amount?: number | string | null;
  refunded_at?: string | null;
  created_at: string;
```

- [ ] **Step 3: Map them in `mapOrder` (same file)**

Find:

```ts
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at,
```

Replace with:

```ts
    paidAt: r.paid_at ?? null,
    refundedAmount: r.refunded_amount == null ? null : Number(r.refunded_amount),
    refundedAt: r.refunded_at ?? null,
    createdAt: r.created_at,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (both the `Order` shape and its only constructor now agree).

- [ ] **Step 5: Commit**

```bash
git add app/data/types.ts app/admin/orders/queries.ts
git commit -m "Map refunded_amount/refunded_at into the Order model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Webhook `charge.refunded` handler

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add the `charge.refunded` case**

In `app/api/stripe/webhook/route.ts`, find the `payment_intent.payment_failed` block and the final fallthrough:

```ts
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.warn('[stripe] payment_failed for order', pi.metadata?.order_id, pi.last_payment_error?.message);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
```

Replace it with (adds the new case before the fallthrough):

```ts
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.warn('[stripe] payment_failed for order', pi.metadata?.order_id, pi.last_payment_error?.message);
    return NextResponse.json({ received: true });
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);
    if (!paymentIntentId) {
      console.error('[stripe] charge.refunded without a payment_intent:', charge.id);
      return NextResponse.json({ received: true });
    }
    try {
      await recordRefund(paymentIntentId, charge.amount_refunded);
    } catch (err) {
      // Failing to RECORD the refund → 500 so Stripe retries the event.
      console.error('[stripe] failed to record refund for PI', paymentIntentId, err);
      return new NextResponse('Processing error', { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Add the `recordRefund` helper**

At the end of `app/api/stripe/webhook/route.ts` (after `buildEmailData`), add:

```ts
// Record a refund synced from Stripe. Idempotent: the two updates are safe to
// re-run (redelivered events) and correctly advance the total for a follow-up
// partial refund. We do NOT restock the piece (owner relists by hand) and send
// no email. Order looked up by the PaymentIntent id stored when it was paid.
async function recordRefund(paymentIntentId: string, amountRefundedPence: number): Promise<void> {
  const svc = createServiceClient();
  const refundedAmount = amountRefundedPence / 100; // Stripe pence → pounds

  // First refund only: stamp the time. `.is('refunded_at', null)` makes a
  // redelivery or a later partial refund leave the original timestamp intact.
  const { error: stampError } = await svc
    .from('orders')
    .update({ refunded_at: new Date().toISOString() })
    .eq('stripe_payment_intent', paymentIntentId)
    .is('refunded_at', null);
  if (stampError) throw stampError;

  // Every refund event: set status + the current cumulative amount. Leaves the
  // fulfilment `status` (New/Made/Posted) untouched.
  const { error: writeError } = await svc
    .from('orders')
    .update({ payment_status: 'refunded', refunded_amount: refundedAmount })
    .eq('stripe_payment_intent', paymentIntentId);
  if (writeError) throw writeError;
}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`Stripe.Charge` comes from the existing `import type Stripe from 'stripe'`; `createServiceClient` is already imported.)

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "Sync Stripe refunds: charge.refunded marks the order refunded

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Admin UI — refund badge + Relist button

**Files:**
- Create: `app/admin/orders/RelistButton.tsx`
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Create `app/admin/orders/RelistButton.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { toggleSoldOut } from '../products/actions';

// On a refunded order, put a returned piece back on sale — an explicit set to
// in-stock (a no-op if it's already listed). Reuses the product stock action,
// which revalidates the storefront. Owner clicks it only if the piece is
// resaleable, so this is never automatic.
export function RelistButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="font-body text-xs text-green-700">&#10003; Relisted</span>;
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await toggleSoldOut(productId, false);
            if (res?.error) setError(res.error);
            else setDone(true);
          })
        }
        className="cursor-pointer font-body text-xs font-medium text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft rounded"
      >
        Relist
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Import `RelistButton` in `app/admin/orders/page.tsx`**

Find:

```tsx
import { OrderStatusControl } from './OrderStatusControl';
import type { OrderStatus, PaymentStatus } from '../../data/types';
```

Replace with:

```tsx
import { OrderStatusControl } from './OrderStatusControl';
import { RelistButton } from './RelistButton';
import type { OrderStatus, PaymentStatus } from '../../data/types';
```

- [ ] **Step 3: Enhance the payment badge to show the refunded amount + partial/full**

In `app/admin/orders/page.tsx`, find the payment-badge IIFE:

```tsx
                      {(() => {
                        const p = PAYMENT_STYLES[o.paymentStatus] ?? PAYMENT_STYLES.unpaid;
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${p.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden="true" />
                            {p.label}
                          </span>
                        );
                      })()}
```

Replace with:

```tsx
                      {(() => {
                        const p = PAYMENT_STYLES[o.paymentStatus] ?? PAYMENT_STYLES.unpaid;
                        let label: string = p.label;
                        if (o.paymentStatus === 'refunded' && o.refundedAmount != null) {
                          const full = o.refundedAmount >= o.subtotal + o.shipping;
                          label = `${full ? 'Refunded' : 'Partially refunded'} £${o.refundedAmount.toFixed(2)}`;
                        }
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${p.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden="true" />
                            {label}
                          </span>
                        );
                      })()}
```

- [ ] **Step 4: Show the refunded date under the order header**

In the same file, find:

```tsx
                  </div>

                  {/* Items */}
                  <ul className="mt-4 flex flex-col gap-1.5 border-t border-cream-dark pt-3">
```

Replace with:

```tsx
                  </div>

                  {o.paymentStatus === 'refunded' && o.refundedAt && (
                    <p className="font-body text-xs text-ink-light mt-2">
                      Refunded {formatDate(o.refundedAt)}
                    </p>
                  )}

                  {/* Items */}
                  <ul className="mt-4 flex flex-col gap-1.5 border-t border-cream-dark pt-3">
```

- [ ] **Step 5: Add the Relist button to each item on refunded orders**

In the same file, find the item row:

```tsx
                    {o.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 font-body text-sm">
                        <span className="text-ink">
                          <span className="text-ink-light tabular-nums">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="text-ink tabular-nums">
                          £{(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
```

Replace with:

```tsx
                    {o.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 font-body text-sm">
                        <span className="text-ink">
                          <span className="text-ink-light tabular-nums">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="inline-flex items-center gap-3">
                          {o.paymentStatus === 'refunded' && item.productId && (
                            <RelistButton productId={item.productId} />
                          )}
                          <span className="text-ink tabular-nums">
                            £{(item.unitPrice * item.quantity).toFixed(2)}
                          </span>
                        </span>
                      </li>
                    ))}
```

- [ ] **Step 6: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/admin/orders` still compiles.

- [ ] **Step 7: Commit**

```bash
git add app/admin/orders/RelistButton.tsx app/admin/orders/page.tsx
git commit -m "Admin: refund badge (amount + partial/full) + per-item Relist

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Full verification + owner ops (deploy-time)

No new code. This gates the feature and documents the two owner steps.

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds; `/admin/orders` and `/api/stripe/webhook` both present in the output.

- [ ] **Step 2: Owner ops — apply the migration (before relying on refunds)**

In **Supabase → SQL Editor**, run the contents of `supabase/migrations/0011_order_refunds.sql`:

```sql
alter table orders
  add column if not exists refunded_amount numeric(10,2),
  add column if not exists refunded_at timestamptz;
```

(Run this **before** the code handles a real refund — otherwise the webhook update hits a missing column and Stripe retries.)

- [ ] **Step 3: Owner ops — subscribe the webhook to refunds**

In the **Stripe dashboard → Developers → Webhooks**, open the LIVE endpoint
(`https://blgcreations.co.uk/api/stripe/webhook`) and **add the event
`charge.refunded`** to it. (Add it to the TEST endpoint / local `stripe listen` too if testing there.)

- [ ] **Step 4: End-to-end verify with a TEST-mode refund (never a live one)**

Using Stripe **test mode** (test keys + test webhook secret) or the Stripe CLI
(`stripe listen --forward-to localhost:3000/api/stripe/webhook` + `stripe trigger charge.refunded`):
- Refund a test order in full → the order shows **"Refunded £X"** in `/admin/orders`, with `refunded_at` set.
- Refund a test order partially → shows **"Partially refunded £X"**.
- Click **Relist** on a refunded order's item → the product returns to **in stock** on the storefront; the button shows **✓ Relisted**.

- [ ] **Step 5: Report status (do NOT push)**

Summarize tsc/build results and the test-mode refund outcome. The owner merges `returns-refund-sync` to `main` (which deploys) after review — having already applied migration `0011` and added the `charge.refunded` event.

## Out of scope (from the spec)

Auto-restock · automated customer refund email · admin-initiated refunds · per-item return tracking · dispute/chargeback (`charge.dispute.*`) handling.
