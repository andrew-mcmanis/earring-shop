# Phase 2 — Stripe Payments + Automatic Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take card payment on-site (Stripe embedded Payment Element, GBP), mark orders paid from the `payment_intent.succeeded` webhook, and send automatic confirmation emails (customer + owner) via Resend.

**Architecture:** The details form saves the order as `unpaid` in our DB and creates a Stripe PaymentIntent (server-authoritative amount), returning a `client_secret`; the Payment Element then confirms the card inline. The **webhook is the source of truth** — on `payment_intent.succeeded` it marks the order paid (idempotently), flips the one-of-a-kind products to sold-out, and sends both emails. If Stripe keys are absent the code **degrades gracefully to today's "order without payment" behaviour**, so the branch is safe to deploy before the owner adds keys.

**Tech Stack:** Next.js 16 App Router (React 19, Tailwind v4, TS), Supabase (Postgres + service-role server client), Stripe (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`), Resend (`resend`).

---

## ⚠️ Project conventions (read before starting)

- **NO unit-test runner — never add one.** "Verify" steps in this plan mean
  `npx tsc --noEmit` + `npm run build` + browser/Stripe-CLI preview. Do **not**
  introduce Jest/Vitest/etc.
- **This is NOT the Next.js you know** (`AGENTS.md`). Before writing the route
  handler and server action, read:
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  Confirm raw-body access (`await request.text()`) and current server-action
  conventions there before coding.
- **Migrations are run by the owner** in the Supabase SQL editor — the plan
  creates the `.sql` file; a human applies it. Local dev + live share the SAME
  prod DB, so `mapOrder` must tolerate the new columns being absent until the
  migration is applied.
- **`'use server'` files (`app/lib/orders.ts`) expose every export as a public
  RPC.** Never export a privileged helper (e.g. the sold-out flip) from one —
  keep those in a plain module (`app/lib/fulfilment.ts`).
- Work on branch `phase2-stripe-payments` (already created). Commit after each
  task. **Do not push** — pushing deploys; ask the owner first.
- Brand/quality bar: kraft `#B5865A` / cream `#FDF8F0` / ink `#1A1A1A`, Amatic
  SC (`font-heading`) + Cabin (`font-body`), no glassmorphism/blur, no
  `rounded-full` on controls, plain honest copy, 44px tap targets, visible focus
  rings, `role="alert"` on errors.

## File structure (created / modified)

| File | Responsibility |
|------|----------------|
| `app/lib/stripe.ts` **(create)** | Lazy server-side Stripe client + `isStripeConfigured()`. Plain module, server-only. |
| `app/lib/email.ts` **(create)** | Resend client + `sendOrderEmails(data)` + HTML templates. Plain module. |
| `app/lib/fulfilment.ts` **(create)** | `flipProductsSoldOut(ids)` — used by the fallback path AND the webhook. Plain module (NOT `'use server'`). |
| `app/api/stripe/webhook/route.ts` **(create)** | Verify signature, handle `payment_intent.succeeded` / `payment_failed`; the source of truth. |
| `app/components/StripePaymentStep.tsx` **(create)** | Client: `<Elements>` + `<PaymentElement>`, confirms payment, redirects to success. |
| `docs/SETUP-payments.md` **(create)** | Owner-facing setup guide (Stripe + Resend accounts, env vars). |
| `supabase/migrations/0010_order_payments.sql` **(create)** | Adds `payment_status` / `stripe_payment_intent` / `paid_at`. |
| `supabase/schema.sql` **(modify)** | Mirror the new columns on the `orders` create-table. |
| `app/data/types.ts` **(modify)** | `PaymentStatus` type + 3 fields on `Order`. |
| `app/admin/orders/queries.ts` **(modify)** | Map the new columns (tolerant of absence). |
| `app/lib/orders.ts` **(modify)** | `placeOrder` → `createOrderAndIntent`; save unpaid + create PaymentIntent; remove inline flip (Stripe path). |
| `app/components/CheckoutForm.tsx` **(modify)** | Two-step: details → Payment Element. |
| `app/checkout/page.tsx` **(modify)** | Pass `paymentEnabled` to the form. |
| `app/checkout/success/OrderConfirmation.tsx` **(modify)** | Payment-received copy + `redirect_status` handling. |
| `app/admin/orders/page.tsx` **(modify)** | Paid / Unpaid badge. |
| `.env.local.example` **(modify)** | Document the 6 new env vars. |
| `ROADMAP.md` **(modify)** | Resolve decision #3 (owner email on payment success). |

---

## Task 1: Dependencies + Stripe client + env docs

**Files:**
- Create: `app/lib/stripe.ts`
- Modify: `.env.local.example`
- Modify: `package.json` (via `npm i`)

- [ ] **Step 1: Install packages**

Run:
```bash
npm i stripe @stripe/stripe-js @stripe/react-stripe-js resend
```
Expected: added to `dependencies`, no peer errors.

- [ ] **Step 2: Create the lazy Stripe server client**

Create `app/lib/stripe.ts` (plain module — NOT `'use server'`; only ever
imported by server code):

```ts
import Stripe from 'stripe';

// Instantiate lazily so importing this module never throws when keys are
// absent (keeps local/demo builds and the graceful no-payment fallback working).
let cached: Stripe | null = null;

/** True once both Stripe keys are present. Drives the payment-vs-fallback path. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

/** Server-only Stripe client (secret key). Throws only when actually called
 *  without a key. Uses the account's default API version. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured — STRIPE_SECRET_KEY missing.');
  if (!cached) cached = new Stripe(key);
  return cached;
}
```

- [ ] **Step 3: Document the env vars**

Append to `.env.local.example` (after the existing App block):

```bash

# ── Payments & email (Phase 2) ──────────────────────────────────────
# Stripe — test keys to start (Dashboard → Developers → API keys).
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# Local: from `stripe listen` output. Prod: the webhook endpoint's signing secret.
STRIPE_WEBHOOK_SECRET=
# Resend — email delivery (resend.com → API Keys).
RESEND_API_KEY=
# Sender + owner-notify addresses. In test mode use onboarding@resend.dev as the
# sender and the owner's own (Resend-verified) email as OWNER_ORDER_EMAIL.
RESEND_FROM=onboarding@resend.dev
OWNER_ORDER_EMAIL=
```

- [ ] **Step 4: Verify (typecheck + build)**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: both pass. The build must succeed **with no Stripe keys set** (proves
lazy init / safe deploy).

- [ ] **Step 5: Commit**

```bash
git add app/lib/stripe.ts .env.local.example package.json package-lock.json
git commit -m "Add Stripe SDK + lazy server client + payment env docs"
```

---

## Task 2: Data model — migration, schema mirror, types, order mapping

**Files:**
- Create: `supabase/migrations/0010_order_payments.sql`
- Modify: `supabase/schema.sql` (orders create-table)
- Modify: `app/data/types.ts`
- Modify: `app/admin/orders/queries.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0010_order_payments.sql`:

```sql
-- 0010_order_payments.sql
-- Phase 2: card payment. Payment status is tracked SEPARATELY from the
-- fulfilment status (new/made/posted) — an order can be paid but not yet made.
-- The payment_intent.succeeded webhook is the source of truth for these.

alter table orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  add column if not exists stripe_payment_intent text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_payment_intent_idx on orders (stripe_payment_intent);
```

- [ ] **Step 2: Mirror the columns in `schema.sql`**

In `supabase/schema.sql`, in the `create table if not exists orders (...)`
block, insert these three columns immediately after the `status` column line
(`status text not null default 'new', -- new | made | posted | cancelled`) and
before `created_at`:

```sql
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid', 'paid', 'refunded')),
  stripe_payment_intent text,
  paid_at        timestamptz,
```

Then add, next to the other order indexes (after
`create index if not exists orders_created_idx ...`):

```sql
create index if not exists orders_payment_intent_idx on orders (stripe_payment_intent);
```

- [ ] **Step 3: Extend the `Order` type**

In `app/data/types.ts`, after the `OrderStatus` type add:

```ts
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
```

And inside `interface Order`, after `status: OrderStatus;` add:

```ts
  paymentStatus: PaymentStatus;
  stripePaymentIntent: string | null;
  /** ISO timestamp set when the payment webhook marked the order paid. */
  paidAt: string | null;
```

- [ ] **Step 4: Map the new columns (tolerant of absence)**

In `app/admin/orders/queries.ts`:

Update the import:
```ts
import type { Order, OrderStatus, PaymentStatus } from '../../data/types';
```

Add to `interface OrderRow` (after `status: string;`):
```ts
  payment_status?: string | null;
  stripe_payment_intent?: string | null;
  paid_at?: string | null;
```

Add to the object returned by `mapOrder` (after `status: r.status as OrderStatus,`):
```ts
    paymentStatus: (r.payment_status as PaymentStatus | null) ?? 'unpaid',
    stripePaymentIntent: r.stripe_payment_intent ?? null,
    paidAt: r.paid_at ?? null,
```

(The `select('*')` in `adminGetOrders` picks the columns up automatically once
the migration runs; the `?? 'unpaid'` fallback keeps it safe before then.)

- [ ] **Step 5: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass. (No runtime change yet — the migration is applied by the owner.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0010_order_payments.sql supabase/schema.sql app/data/types.ts app/admin/orders/queries.ts
git commit -m "Add order payment columns (migration 0010) + types/mapping"
```

---

## Task 3: Sold-out flip helper + `createOrderAndIntent`

**Files:**
- Create: `app/lib/fulfilment.ts`
- Modify: `app/lib/orders.ts`

- [ ] **Step 1: Extract the sold-out flip into a plain module**

Create `app/lib/fulfilment.ts`:

```ts
import { revalidatePath } from 'next/cache';
import { createServiceClient } from './supabase';

/**
 * Flip one-of-a-kind products to sold-out after a successful sale, and
 * revalidate the surfaces that show availability. Used by the payment webhook
 * (the normal path) and by the no-Stripe fallback in createOrderAndIntent.
 *
 * Deliberately NOT in a 'use server' file: it must never be a client-callable
 * RPC. Best-effort — callers wrap it so a failure never undoes a paid order.
 */
export async function flipProductsSoldOut(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return;
  const svc = createServiceClient();
  const { error } = await svc.from('products').update({ sold_out: true }).in('id', ids);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin/products');
  for (const id of ids) revalidatePath(`/product/${id}`);
}
```

- [ ] **Step 2: Rewrite `app/lib/orders.ts`**

Replace the entire file with the version below. Changes vs today:
`placeOrder` → **`createOrderAndIntent`**; `PlaceOrderState` gains
`clientSecret?`; the inline sold-out flip block is removed; the Stripe path
creates a PaymentIntent and returns its `client_secret`; the no-Stripe path
keeps today's behaviour (save + flip inline + success).

```ts
'use server';

import type { Product } from '../data/types';
import { getProducts, mapProduct, type ProductRow } from '../data/products';
import { sampleDeliveryBase } from '../data/sample';
import { computeShipping } from './shipping';
import { flipProductsSoldOut } from './fulfilment';
import { isStripeConfigured, getStripe } from './stripe';
import { isSupabaseConfigured, createReadClient, createServiceClient } from './supabase';

export interface PlaceOrderState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
  /** Set only for a successful pickup order — the private collection details. */
  collection?: { address: string | null; note: string | null };
  /** The method the server actually processed — authoritative for the confirmation. */
  fulfilmentMethod?: 'delivery' | 'pickup';
  /** Present when payment is required (Stripe configured): the Payment Element secret. */
  clientSecret?: string;
}

interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function createOrderAndIntent(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const name = str(formData, 'name');
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  const address = str(formData, 'address');
  const city = str(formData, 'city');
  const postcode = str(formData, 'postcode');
  const notes = str(formData, 'notes');
  const isPickup = str(formData, 'fulfilment_method') === 'pickup';

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter your name.';
  if (!email) fieldErrors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (!isPickup && !address) fieldErrors.address = 'Please enter a delivery address.';

  // Rebuild the order from the authoritative catalogue — never trust
  // client-supplied names or prices.
  let cart: { id: string; qty: number }[] = [];
  try {
    const parsed = JSON.parse(str(formData, 'items') || '[]');
    if (Array.isArray(parsed)) cart = parsed;
  } catch {
    // ignore malformed payload — handled by the empty check below
  }

  let catalogue: Product[];
  if (isSupabaseConfigured()) {
    const supabase = createReadClient();
    const { data, error } = await supabase.from('products').select('*').eq('visible', true);
    if (error || !data) {
      console.error('[order] catalogue read failed during checkout:', error?.message);
      return {
        status: 'error',
        message: 'Sorry, something went wrong on our side — please try again in a moment.',
      };
    }
    catalogue = (data as ProductRow[]).map(mapProduct);
  } else {
    catalogue = await getProducts();
  }

  const items: OrderLine[] = [];
  const soldOutNames: string[] = [];
  for (const entry of cart) {
    const product = catalogue.find((p) => p.id === entry?.id);
    const quantity = Math.max(0, Math.floor(Number(entry?.qty) || 0));
    if (!product || quantity <= 0) continue;
    if (product.soldOut) {
      soldOutNames.push(product.name);
      continue;
    }
    items.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }
  if (soldOutNames.length > 0) {
    const names = [...new Set(soldOutNames)];
    const pronoun = names.length > 1 ? 'them' : 'it';
    return {
      status: 'error',
      message: `Sorry, ${names.join(', ')} just sold out — please remove ${pronoun} from your cart to continue.`,
    };
  }
  if (items.length === 0) {
    return { status: 'error', message: 'Your cart is empty — add an item before checking out.' };
  }

  const subtotal = items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // Delivery recomputed server-side from the private settings row.
  let shipping = 0;
  if (!isPickup) {
    const count = items.reduce((n, l) => n + l.quantity, 0);
    if (isSupabaseConfigured()) {
      const svc = createServiceClient();
      const { data: s, error: baseError } = await svc
        .from('settings')
        .select('delivery_base')
        .eq('id', true)
        .maybeSingle();
      if (baseError) {
        console.error('[order] delivery base read failed during checkout:', baseError.message);
        return {
          status: 'error',
          message: 'Sorry, something went wrong on our side — please try again in a moment.',
        };
      }
      shipping = computeShipping(count, Number(s?.delivery_base ?? 0));
    } else {
      shipping = computeShipping(count, sampleDeliveryBase);
    }
  }

  const total = subtotal + shipping;

  // Demo mode (no DB): log the order so nothing is lost; confirm to the customer.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[order] DB not configured — order received but not saved:\n', {
      name, email, items, subtotal, shipping,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    });
    return { status: 'success', fulfilmentMethod: isPickup ? 'pickup' : 'delivery' };
  }

  try {
    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        address: isPickup ? null : address,
        city: isPickup ? null : city || null,
        postcode: isPickup ? null : postcode || null,
        country: 'United Kingdom',
        notes: notes || null,
        subtotal,
        shipping,
        fulfilment_method: isPickup ? 'pickup' : 'delivery',
        status: 'new',
        payment_status: 'unpaid',
      })
      .select('id, order_number')
      .single();

    if (error || !order) throw error ?? new Error('No order returned');

    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
      })),
    );
    if (itemsError) throw itemsError;

    const reference = `BLG-${order.order_number}`;

    // Read pickup collection details for the confirmation screen (never client-trusted).
    let collection: { address: string | null; note: string | null } | undefined;
    if (isPickup) {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('pickup_address, pickup_note')
        .eq('id', true)
        .maybeSingle();
      if (settingsError) {
        console.error('[order] pickup settings read failed:', settingsError.message);
      }
      collection = { address: settings?.pickup_address ?? null, note: settings?.pickup_note ?? null };
    }

    // ── Payment path ──────────────────────────────────────────────────
    // With Stripe configured, create a PaymentIntent and hand the client its
    // secret. The order stays 'unpaid'; the webhook flips sold-out + emails on
    // success. Do NOT flip here.
    if (isStripeConfigured()) {
      try {
        const intent = await getStripe().paymentIntents.create({
          amount: Math.round(total * 100), // GBP pence
          currency: 'gbp',
          automatic_payment_methods: { enabled: true },
          metadata: { order_id: order.id, reference },
        });
        await supabase
          .from('orders')
          .update({ stripe_payment_intent: intent.id })
          .eq('id', order.id);
        return {
          status: 'success',
          reference,
          collection,
          fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
          clientSecret: intent.client_secret ?? undefined,
        };
      } catch (payErr) {
        console.error('[order] saved OK but PaymentIntent creation failed:', payErr, { reference });
        return {
          status: 'error',
          message: 'Sorry, we could not start the payment — please try again in a moment.',
        };
      }
    }

    // ── Fallback path (no Stripe keys yet) ────────────────────────────
    // Behaves like today: treat as placed, flip sold-out inline, confirm.
    try {
      await flipProductsSoldOut(items.map((l) => l.productId));
    } catch (flipErr) {
      console.error('[order] saved OK but failed to auto-flip sold-out:', flipErr, { reference });
    }
    return {
      status: 'success',
      reference,
      collection,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    };
  } catch (err) {
    console.error('[order] FAILED to save — order logged for manual entry:', err, {
      name, email, phone, address, city, postcode, notes, items, subtotal, shipping,
      fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    });
    return { status: 'success', fulfilmentMethod: isPickup ? 'pickup' : 'delivery' };
  }
}
```

- [ ] **Step 3: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass. (`CheckoutForm` still imports the old `placeOrder` name and will
break tsc — so do Task 6's import rename in the same working session if you run
tsc before then. If building this task in isolation, temporarily keep a
`export const placeOrder = createOrderAndIntent;` alias, removed in Task 6. The
recommended order is Task 3 → 6 back-to-back.)

> **Note:** To keep each task independently green, add this one alias line at the
> end of `app/lib/orders.ts` now and delete it in Task 6:
> ```ts
> /** @deprecated transitional alias — removed in the checkout rewrite (Task 6). */
> export const placeOrder = createOrderAndIntent;
> ```

- [ ] **Step 4: Commit**

```bash
git add app/lib/fulfilment.ts app/lib/orders.ts
git commit -m "Save order unpaid + create PaymentIntent; move sold-out flip to a shared helper"
```

---

## Task 4: Email templates (`app/lib/email.ts`)

**Files:**
- Create: `app/lib/email.ts`

- [ ] **Step 1: Write the email module**

Create `app/lib/email.ts` (plain module — imported only by the webhook):

```ts
import { Resend } from 'resend';

export interface OrderEmailData {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  shipping: number;
  fulfilmentMethod: 'delivery' | 'pickup';
  /** Delivery orders only. */
  address: { line: string | null; city: string | null; postcode: string | null } | null;
  /** Pickup orders only — read from private settings at send time. */
  collection: { address: string | null; note: string | null } | null;
}

const KRAFT = '#B5865A';
const INK = '#1A1A1A';
const CREAM = '#FDF8F0';

function money(n: number): string {
  return `£${n.toFixed(2)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function itemsTable(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;color:${INK};">${esc(i.name)} <span style="color:#7a6a58;">×${i.quantity}</span></td>
        <td style="padding:6px 0;text-align:right;color:${INK};">${money(i.unitPrice * i.quantity)}</td>
      </tr>`,
    )
    .join('');
  const total = data.subtotal + data.shipping;
  const shipLabel = data.fulfilmentMethod === 'pickup' ? 'Collection' : 'Delivery';
  const shipValue = data.shipping > 0 ? money(data.shipping) : 'Free';
  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;font-family:Georgia,serif;font-size:15px;">
      ${rows}
      <tr><td colspan="2" style="border-top:1px solid #e6dccb;padding-top:8px;"></td></tr>
      <tr><td style="padding:4px 0;color:#7a6a58;">Subtotal</td><td style="padding:4px 0;text-align:right;color:${INK};">${money(data.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#7a6a58;">${shipLabel}</td><td style="padding:4px 0;text-align:right;color:${INK};">${shipValue}</td></tr>
      <tr><td style="padding:8px 0 0;font-weight:bold;color:${INK};">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;color:${INK};">${money(total)}</td></tr>
    </table>`;
}

function fulfilmentBlock(data: OrderEmailData): string {
  if (data.fulfilmentMethod === 'pickup') {
    const addr = data.collection?.address
      ? `<p style="margin:4px 0;white-space:pre-line;color:${INK};">${esc(data.collection.address)}</p>`
      : `<p style="margin:4px 0;color:${INK};">We'll be in touch with the collection details.</p>`;
    const note = data.collection?.note ? `<p style="margin:4px 0;color:#7a6a58;">${esc(data.collection.note)}</p>` : '';
    return `<h3 style="font-family:Georgia,serif;color:${INK};margin:20px 0 4px;">Collection</h3>${addr}${note}`;
  }
  const line = [data.address?.line, data.address?.city, data.address?.postcode]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join(', ');
  return `<h3 style="font-family:Georgia,serif;color:${INK};margin:20px 0 4px;">Delivery to</h3><p style="margin:4px 0;color:${INK};">${line}</p>`;
}

function shell(title: string, inner: string): string {
  return `
  <div style="background:${CREAM};padding:24px;font-family:Georgia,serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6dccb;border-radius:8px;padding:28px;">
      <h1 style="font-family:Georgia,serif;color:${KRAFT};margin:0 0 4px;font-size:26px;">BLG Creations</h1>
      <h2 style="font-family:Georgia,serif;color:${INK};margin:0 0 16px;font-size:18px;font-weight:normal;">${title}</h2>
      ${inner}
    </div>
  </div>`;
}

function customerHtml(data: OrderEmailData): string {
  return shell(
    `Thank you for your order, ${esc(data.customerName.split(' ')[0] || data.customerName)}!`,
    `<p style="color:${INK};">Your payment has been received. Your order reference is
       <strong>${esc(data.reference)}</strong>.</p>
     ${itemsTable(data)}
     ${fulfilmentBlock(data)}
     <p style="color:#7a6a58;margin-top:20px;font-size:13px;">Each piece is handmade and one of a kind — thank you for supporting a small maker.</p>`,
  );
}

function ownerHtml(data: OrderEmailData): string {
  const contact = [
    `<strong>${esc(data.customerName)}</strong>`,
    esc(data.customerEmail),
    data.customerPhone ? esc(data.customerPhone) : '',
  ]
    .filter(Boolean)
    .join('<br>');
  return shell(
    `New order — ${esc(data.reference)}`,
    `<p style="color:${INK};">${contact}</p>
     ${itemsTable(data)}
     ${fulfilmentBlock(data)}`,
  );
}

/**
 * Send the customer confirmation and the owner alert. Resilient: missing config
 * or a send failure logs and returns — it must NEVER throw into the webhook,
 * because the order is already paid.
 */
export async function sendOrderEmails(data: OrderEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const ownerTo = process.env.OWNER_ORDER_EMAIL;

  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM missing — skipping emails for', data.reference);
    return;
  }
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: data.customerEmail,
      subject: `Your BLG Creations order ${data.reference}`,
      html: customerHtml(data),
    });
  } catch (e) {
    console.error('[email] customer confirmation failed for', data.reference, e);
  }

  if (ownerTo) {
    try {
      await resend.emails.send({
        from,
        to: ownerTo,
        subject: `New order ${data.reference} (${money(data.subtotal + data.shipping)})`,
        html: ownerHtml(data),
      });
    } catch (e) {
      console.error('[email] owner alert failed for', data.reference, e);
    }
  } else {
    console.warn('[email] OWNER_ORDER_EMAIL not set — owner alert skipped for', data.reference);
  }
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/lib/email.ts
git commit -m "Add Resend order emails (customer confirmation + owner alert)"
```

---

## Task 5: Payment webhook (`app/api/stripe/webhook/route.ts`)

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

> Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
> first to confirm raw-body access and the `runtime` export in this Next version.

- [ ] **Step 1: Write the route handler**

Create `app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '../../../lib/stripe';
import { createServiceClient } from '../../../lib/supabase';
import { flipProductsSoldOut } from '../../../lib/fulfilment';
import { sendOrderEmails, type OrderEmailData } from '../../../lib/email';

// Stripe signature verification needs the raw body + Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderItemRow {
  product_id: string | null;
  name: string;
  unit_price: number | string;
  quantity: number;
}
interface PaidOrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  order_items: OrderItemRow[];
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET missing');
    return new NextResponse('Not configured', { status: 500 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe] signature verification failed:', err instanceof Error ? err.message : err);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.order_id;
    if (!orderId) {
      console.error('[stripe] succeeded event without order_id metadata:', pi.id);
      return NextResponse.json({ received: true });
    }
    try {
      await fulfilPaidOrder(orderId, pi.id);
    } catch (err) {
      // Failing to RECORD the payment → 500 so Stripe retries the event.
      console.error('[stripe] failed to record payment for order', orderId, err);
      return new NextResponse('Processing error', { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.warn('[stripe] payment_failed for order', pi.metadata?.order_id, pi.last_payment_error?.message);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

async function fulfilPaidOrder(orderId: string, paymentIntentId: string): Promise<void> {
  const svc = createServiceClient();

  // Atomic claim: only the FIRST delivery flips paid_at from null → now(),
  // so redelivered events are exact no-ops (emails/flip run at most once).
  const { data, error } = await svc
    .from('orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntentId,
    })
    .eq('id', orderId)
    .is('paid_at', null)
    .select('*, order_items(*)');
  if (error) throw error;

  const claimed = (data as unknown as PaidOrderRow[]) ?? [];
  if (claimed.length === 0) return; // already processed, or order missing — idempotent

  const order = claimed[0];

  // Best-effort — the payment is already recorded; these must not fail the 200.
  const productIds = (order.order_items ?? []).map((i) => i.product_id).filter((x): x is string => Boolean(x));
  try {
    await flipProductsSoldOut(productIds);
  } catch (e) {
    console.error('[stripe] paid OK but sold-out flip failed for', orderId, e);
  }

  try {
    await sendOrderEmails(await buildEmailData(svc, order));
  } catch (e) {
    console.error('[stripe] paid OK but email send failed for', orderId, e);
  }
}

async function buildEmailData(svc: SupabaseClient, order: PaidOrderRow): Promise<OrderEmailData> {
  const isPickup = order.fulfilment_method === 'pickup';
  let collection: { address: string | null; note: string | null } | null = null;
  if (isPickup) {
    const { data: s } = await svc
      .from('settings')
      .select('pickup_address, pickup_note')
      .eq('id', true)
      .maybeSingle();
    collection = { address: s?.pickup_address ?? null, note: s?.pickup_note ?? null };
  }
  return {
    reference: `BLG-${order.order_number}`,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    items: (order.order_items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    fulfilmentMethod: isPickup ? 'pickup' : 'delivery',
    address: isPickup ? null : { line: order.address, city: order.city, postcode: order.postcode },
    collection,
  };
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass; the build output lists `/api/stripe/webhook` as a route.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "Add Stripe webhook: idempotent paid + sold-out flip + emails"
```

---

## Task 6: Checkout UI — details → Payment Element

**Files:**
- Create: `app/components/StripePaymentStep.tsx`
- Modify: `app/components/CheckoutForm.tsx`
- Modify: `app/checkout/page.tsx`
- Modify: `app/lib/orders.ts` (remove the transitional alias from Task 3)

> Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
> to confirm current server-action-from-client-component conventions.

- [ ] **Step 1: Create the Payment Element step**

Create `app/components/StripePaymentStep.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useCart } from './CartProvider';

// loadStripe once at module scope (idempotent). Empty string if unset — we only
// ever render this component when the server returned a client secret, which
// implies the publishable key is present too.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#B5865A',
    colorText: '#1A1A1A',
    colorBackground: '#ffffff',
    borderRadius: '6px',
    fontFamily: 'Cabin, system-ui, sans-serif',
  },
};

interface Props {
  clientSecret: string;
  reference?: string;
  method: 'delivery' | 'pickup';
  collection?: { address: string | null; note: string | null } | null;
  onEdit: () => void;
}

export function StripePaymentStep(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance }}>
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({ reference, method, collection, onEdit }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // Persist the confirmation payload BEFORE confirming, so it survives a 3-D
    // Secure redirect back to the success page. Marked paid:true — we only reach
    // /checkout/success on a successful (or redirect_status=succeeded) payment.
    const q = reference ? `?ref=${encodeURIComponent(reference)}` : '';
    try {
      sessionStorage.setItem(
        'blg-last-order',
        JSON.stringify({ reference: reference ?? null, method, collection: collection ?? null, paid: true }),
      );
    } catch {
      // sessionStorage unavailable — success page falls back to ref + generic copy.
    }

    const { error: payError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/success${q}` },
      redirect: 'if_required',
    });

    if (payError) {
      setError(payError.message ?? 'Payment could not be completed. Please try again.');
      setSubmitting(false);
      return;
    }
    // No redirect required → success. Clear the cart and go to confirmation.
    clear();
    router.push(`/checkout/success${q}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
        <legend className="font-heading text-2xl font-bold text-ink mb-1">Payment</legend>
        {error && (
          <div role="alert" className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">
            {error}
          </div>
        )}
        <PaymentElement />
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing…' : 'Pay now'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={submitting}
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 disabled:opacity-60"
        >
          ← Edit details
        </button>
      </div>
      <p className="font-body text-xs text-ink-light">
        Payments are processed securely by Stripe. Your card details never touch our servers.
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `CheckoutForm` for the two-step flow**

In `app/components/CheckoutForm.tsx`:

Update imports (replace the `placeOrder` import line and add the new ones):
```tsx
import { createOrderAndIntent, type PlaceOrderState } from '../lib/orders';
import { StripePaymentStep } from './StripePaymentStep';
```

Change the component signature to accept `paymentEnabled`:
```tsx
export function CheckoutForm({ deliveryBase, paymentEnabled }: { deliveryBase: number; paymentEnabled: boolean }) {
```

Replace the `useActionState(placeOrder, initialState)` line with:
```tsx
  const [state, formAction, isPending] = useActionState(createOrderAndIntent, initialState);
  const [editing, setEditing] = useState(false);
  const inPayment = Boolean(state.clientSecret) && !editing;
```

Replace the success `useEffect` (the one that stores sessionStorage + redirects)
with this version — it must now only fire on the **fallback** success (no client
secret); the payment path redirects from `StripePaymentStep`:
```tsx
  // Fallback success (no Stripe): behave like before — store + redirect.
  useEffect(() => {
    if (state.status !== 'success' || state.clientSecret) return;
    try {
      sessionStorage.setItem(
        'blg-last-order',
        JSON.stringify({
          reference: state.reference ?? null,
          method: state.fulfilmentMethod ?? method,
          collection: state.collection ?? null,
          paid: false,
        }),
      );
    } catch {
      // sessionStorage unavailable — success page falls back to ref + generic copy.
    }
    clear();
    const q = state.reference ? `?ref=${encodeURIComponent(state.reference)}` : '';
    router.push(`/checkout/success${q}`);
  }, [state, method, clear, router]);

  // When a fresh client secret arrives after an edit+resubmit, leave edit mode.
  useEffect(() => {
    if (state.clientSecret) setEditing(false);
  }, [state.clientSecret]);
```

Replace the early `if (state.status === 'success') { return <p>Placing your order…</p> }`
block with one that only shows while the fallback redirect is happening:
```tsx
  if (state.status === 'success' && !state.clientSecret) {
    return (
      <p className="font-body text-sm text-ink-light py-20 text-center">Placing your order…</p>
    );
  }
```

In the returned JSX, wrap the `<form>` so it hides (but stays mounted, keeping
typed values) while paying, and render the payment step alongside it. Change the
form's opening tag to add the conditional `hidden` class:
```tsx
      <form action={formAction} className={`flex-1 flex flex-col gap-5 ${inPayment ? 'hidden' : ''}`} noValidate>
```

Change the submit button label so it reads correctly for both modes — replace
the button's children expression:
```tsx
          {isPending
            ? 'Placing order…'
            : hasUnavailable
              ? 'Remove sold-out items to continue'
              : paymentEnabled
                ? 'Continue to payment'
                : 'Place order'}
```

Update the small print under the button (remove the "no payment is taken" note,
since payment now happens here) — replace that `<p>` with:
```tsx
        <p className="font-body text-xs text-ink-light">
          {paymentEnabled
            ? "You'll pay securely by card on the next step."
            : "We'll email you to confirm payment and delivery."}
        </p>
```

Immediately AFTER the closing `</form>` tag (and before the `<aside>` order
summary), add the payment step:
```tsx
        {inPayment && state.clientSecret && (
          <div className="flex-1">
            <StripePaymentStep
              key={state.clientSecret}
              clientSecret={state.clientSecret}
              reference={state.reference}
              method={state.fulfilmentMethod ?? method}
              collection={state.collection}
              onEdit={() => setEditing(true)}
            />
          </div>
        )}
```

- [ ] **Step 3: Pass `paymentEnabled` from the checkout page**

In `app/checkout/page.tsx`:

Add the import:
```tsx
import { isStripeConfigured } from '../lib/stripe';
```

Change the render to compute and pass the flag:
```tsx
  const deliveryBase = await getDeliveryBase();
  const paymentEnabled = isStripeConfigured();
```
```tsx
        <CheckoutForm deliveryBase={deliveryBase} paymentEnabled={paymentEnabled} />
```

- [ ] **Step 4: Remove the transitional alias**

In `app/lib/orders.ts`, delete the `export const placeOrder = createOrderAndIntent;`
alias line added in Task 3 (nothing imports `placeOrder` any more).

- [ ] **Step 5: Verify (typecheck + build + preview)**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass.

Preview: start the dev server (Browser pane `preview_start` with the dev config),
open `/checkout` with an item in the cart.
- **Without** Stripe keys in `.env.local`: button reads "Place order"; submitting
  redirects to the success page (fallback path intact).
- **With** Stripe test keys: button reads "Continue to payment"; submitting
  reveals the Payment Element; "← Edit details" returns to the form with typed
  values intact. (Full card flow is exercised in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add app/components/StripePaymentStep.tsx app/components/CheckoutForm.tsx app/checkout/page.tsx app/lib/orders.ts
git commit -m "Two-step checkout: details then inline Stripe Payment Element"
```

---

## Task 7: Success page — payment-received copy + redirect handling

**Files:**
- Modify: `app/checkout/success/OrderConfirmation.tsx`

- [ ] **Step 1: Update `OrderConfirmation`**

Replace the file contents with this version — it reads the new `paid` flag,
handles a 3-D Secure `redirect_status` query param, and shows payment-received
copy for paid orders:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface LastOrder {
  reference: string | null;
  method: 'delivery' | 'pickup';
  collection: { address: string | null; note: string | null } | null;
  paid?: boolean;
}

export function OrderConfirmation({ fallbackRef }: { fallbackRef?: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [checked, setChecked] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setRedirectStatus(params.get('redirect_status'));
    } catch {
      // ignore
    }
    try {
      const raw = sessionStorage.getItem('blg-last-order');
      if (raw) {
        setOrder(JSON.parse(raw) as LastOrder);
        // One-shot: don't leave the private collection address in storage.
        sessionStorage.removeItem('blg-last-order');
      }
    } catch {
      // ignore — fall back to the generic message below
    }
    setChecked(true);
  }, []);

  const matchedOrder =
    order && (order.reference ?? null) === (fallbackRef ?? null) ? order : null;
  const reference = matchedOrder?.reference ?? fallbackRef;
  // Paid when either the stored flag says so, or Stripe redirected with success.
  const paid = Boolean(matchedOrder?.paid) || redirectStatus === 'succeeded';

  // A returned-but-not-succeeded 3-D Secure redirect: payment didn't complete.
  if (checked && redirectStatus && redirectStatus !== 'succeeded') {
    return (
      <p className="font-body text-base text-ink-light max-w-md leading-relaxed" role="alert">
        Your payment wasn&apos;t completed. Please return to the checkout and try again — you
        haven&apos;t been charged.
      </p>
    );
  }

  return (
    <>
      {reference && (
        <p className="font-body text-sm text-ink-light">
          Your reference is{' '}
          <span className="font-semibold text-ink tabular-nums">{reference}</span>.
        </p>
      )}

      {!checked ? null : matchedOrder?.method === 'pickup' && matchedOrder.collection?.address ? (
        <div className="font-body text-base text-ink-light max-w-md leading-relaxed flex flex-col gap-2">
          <p>Your order is for collection. You can pick it up from:</p>
          <p className="whitespace-pre-line font-medium text-ink bg-cream-dark rounded-lg px-4 py-3">
            {matchedOrder.collection.address}
          </p>
          {matchedOrder.collection.note && <p>{matchedOrder.collection.note}</p>}
          <p>We&apos;ll be in touch to arrange a time.</p>
        </div>
      ) : matchedOrder?.method === 'pickup' ? (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          Your order is for collection — we&apos;ll be in touch with the details shortly.
        </p>
      ) : paid ? (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          Payment received — we&apos;ve emailed your confirmation. We&apos;ll be in touch about
          delivery. Thank you!
        </p>
      ) : (
        <p className="font-body text-base text-ink-light max-w-md leading-relaxed">
          We&apos;ll be in touch by email shortly to confirm payment and delivery. Keep an eye on
          your inbox.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/checkout/success/OrderConfirmation.tsx
git commit -m "Success page: payment-received copy + 3-D Secure redirect handling"
```

---

## Task 8: Admin — Paid / Unpaid badge

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add the payment badge**

In `app/admin/orders/page.tsx`:

Update the type import:
```tsx
import type { OrderStatus, PaymentStatus } from '../../data/types';
```

Add a payment-style map after the existing `STATUS_STYLES` map:
```tsx
const PAYMENT_STYLES: Record<PaymentStatus, { label: string; dot: string; chip: string }> = {
  unpaid: { label: 'Unpaid', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Paid', dot: 'bg-green-600', chip: 'bg-green-50 text-green-700 border-green-200' },
  refunded: { label: 'Refunded', dot: 'bg-ink-light', chip: 'bg-cream-dark text-ink-light border-kraft-light' },
};
```

In the order-card header, the status chip currently sits in a `<span>` inside the
`flex items-start justify-between` row. Wrap both chips so the payment badge
appears beside the fulfilment status. Replace the single status `<span>` (the one
rendering `s.dot` + `s.label`) with:
```tsx
                    <div className="flex items-center gap-2 flex-wrap justify-end">
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
                      <span
                        className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${s.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                        {s.label}
                      </span>
                    </div>
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: pass. (Admin is auth-gated; verify visually after deploy, per prior
admin features.)

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "Admin Orders: Paid/Unpaid payment badge"
```

---

## Task 9: Owner setup guide + ROADMAP decision

**Files:**
- Create: `docs/SETUP-payments.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Write the owner setup guide**

Create `docs/SETUP-payments.md`:

```markdown
# Taking payments — setup (for the shop owner)

This gets card payments and automatic emails working. You'll create two free
accounts and paste six keys into the project. **Start in test mode** — no real
money moves until we deliberately switch to live at launch.

## 1. Stripe (card payments)

1. Go to https://stripe.com and sign up (business name: BLG Creations).
2. You can skip/park the full business verification while in **test mode**.
3. In the dashboard, make sure the toggle top-right says **Test mode**.
4. Go to **Developers → API keys**. Copy:
   - **Publishable key** (starts `pk_test_…`)
   - **Secret key** (starts `sk_test_…`) — click "Reveal".

## 2. Resend (order emails)

1. Go to https://resend.com and sign up.
2. Go to **API Keys → Create API Key**. Copy it (starts `re_…`).
3. For test mode you can send from `onboarding@resend.dev`, but it can only
   deliver to **your own** Resend account email. So use your own email as the
   "owner" address and, when we test, place a test order with your own email as
   the customer. (Your branded sender address comes later, at launch.)

## 3. Give the keys to your developer

Paste these into `.env.local` (never commit this file):

    STRIPE_SECRET_KEY=sk_test_...
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...        # from the Stripe CLI during local testing
    RESEND_API_KEY=re_...
    RESEND_FROM=onboarding@resend.dev
    OWNER_ORDER_EMAIL=you@youremail.com    # where "new order" alerts go

## 4. Database

Your developer will send you one SQL file (`0010_order_payments.sql`) to paste
into the Supabase **SQL editor** and run — same as previous updates.

## What happens at launch (later)

- Verify your own domain in Resend so emails come from your brand.
- Add the live webhook endpoint in Stripe and switch to live keys.
- Do one real test purchase, then refund it.
```

- [ ] **Step 2: Resolve ROADMAP decision #3**

In `ROADMAP.md`, under "Decisions the owner needs to make", replace decision 3:
```markdown
3. **Owner email timing** — RESOLVED (2026-08-09): fire on **payment success**,
   from the same webhook as the customer email (one code path; no alerts for
   abandoned/unpaid orders).
```

- [ ] **Step 3: Verify + commit**

Run:
```bash
npx tsc --noEmit
```
Expected: pass (docs-only; no build needed).

```bash
git add docs/SETUP-payments.md ROADMAP.md
git commit -m "Add owner payments setup guide; resolve owner-email-timing decision"
```

---

## Task 10: End-to-end verification (Stripe test mode)

**No code — this is the acceptance gate.** Requires Stripe test keys + Resend key
in `.env.local` and the Stripe CLI installed.

- [ ] **Step 1: Apply the migration**

Owner runs `supabase/migrations/0010_order_payments.sql` in the Supabase SQL
editor. Confirm the `orders` table now has `payment_status`,
`stripe_payment_intent`, `paid_at`.

- [ ] **Step 2: Start the webhook forwarder**

Run:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then
start the dev server fresh.

- [ ] **Step 3: Successful payment**

Checkout with an item; card `4242 4242 4242 4242`, any future expiry/CVC/postcode.
Confirm:
- Redirects to `/checkout/success` showing "Payment received…".
- `stripe listen` logged `payment_intent.succeeded` and the endpoint returned 200.
- In Supabase, the order row is `payment_status = 'paid'` with `paid_at` set.
- The purchased product is now `sold_out = true` (and shows sold-out on the shop).
- Two emails arrived (customer = your test email; owner = `OWNER_ORDER_EMAIL`).
- Admin Orders shows the green **Paid** badge.

- [ ] **Step 4: Declined payment**

Checkout again; card `4000 0000 0000 0002`. Confirm:
- Inline error in the Payment Element; no redirect.
- Order row stays `payment_status = 'unpaid'`; product NOT flipped; no email.

- [ ] **Step 5: 3-D Secure**

Card `4000 0027 6000 3184` → complete the inline authentication → success as Step 3.

- [ ] **Step 6: Idempotency**

Run:
```bash
stripe events resend <the payment_intent.succeeded event id from Step 3>
```
Confirm: endpoint returns 200, **no duplicate emails**, no error, order unchanged.

- [ ] **Step 7: Final typecheck/build**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: clean. Phase 2 code-complete — ready for the owner to review before we
merge to `main` (deploy) and later do the Phase 3 live switch.

---

## Self-review notes (author)

- **Spec coverage:** migration 0010 (Task 2) ✓; embedded Payment Element + order
  saved unpaid + PaymentIntent (Tasks 3, 6) ✓; webhook source-of-truth with
  idempotency (Task 5) ✓; sold-out flip moved to webhook + shared helper (Tasks
  3, 5) ✓; both emails on success, resilient (Tasks 4, 5) ✓; delivery/collection
  detail in email read from settings at send time (Task 5) ✓; admin Paid/Unpaid
  badge (Task 8) ✓; success/checkout copy (Tasks 6, 7) ✓; graceful no-Stripe
  fallback for safe deploy (Task 3) ✓; owner setup guide (Task 9) ✓;
  test-mode E2E incl. test cards + idempotency (Task 10) ✓.
- **Naming consistency:** server action `createOrderAndIntent` (Tasks 3, 6);
  helper `flipProductsSoldOut` (Tasks 3, 5); `sendOrderEmails` + `OrderEmailData`
  (Tasks 4, 5); `isStripeConfigured` / `getStripe` (Tasks 1, 3, 6);
  `PaymentStatus` + `paymentStatus`/`stripePaymentIntent`/`paidAt` (Tasks 2, 8);
  sessionStorage key `blg-last-order` with `paid` flag (Tasks 6, 7).
- **Out of scope (unchanged):** refunds UI, saved cards, discount codes, custom
  domain + verified sender + live keys + prod webhook (Phase 3).
```
