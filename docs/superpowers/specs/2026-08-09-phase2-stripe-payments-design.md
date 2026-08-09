# Phase 2 — take payment online (Stripe + automatic emails) — design

_Date: 2026-08-09_

## Problem

The shop captures orders but takes **no money** — checkout ends with "we'll be
in touch by email shortly to confirm payment and delivery" (placeholder copy in
`OrderConfirmation.tsx`). Phase 2 makes that real: customers **pay by card on
the site**, the order is marked **paid** from a trustworthy signal, and both the
customer and the owner get an **automatic email**. This is the last build phase
before launch (Phase 3).

## Decisions (locked — ROADMAP + confirmed this session)

- **Single merchant, embedded Payment Element.** The owner's own Stripe account
  (not Connect). Card is entered **inline** via the Stripe Payment Element — no
  redirect to a Stripe-hosted page. Card data lives in Stripe's iframe, so we
  never touch it (**PCI SAQ A**). **GBP.** Built and tested in **Stripe test
  mode** first.
  - _Rejected: Stripe-hosted Checkout (redirect)_ — it collects its own shipping
    address, which fights our delivery/pickup model and our server-computed
    shipping; and it takes the customer off-brand. The ROADMAP locked embedded.
- **Order is saved before payment.** The full order (incl. address) persists in
  **our** database as `unpaid` at the moment the customer moves to payment;
  Stripe only carries `order_id` in PaymentIntent metadata.
  - _Rejected: create the order in the webhook after success_ — it would force
    the full order (items, address) into Stripe metadata (size-limited, wrong
    home for it) and lose the record if webhook processing ever failed. Harmless
    `unpaid` rows from abandoned checkouts are an acceptable cost.
- **The webhook is the source of truth.** `payment_intent.succeeded` — not the
  browser — marks the order paid, sends the emails, and flips the item to
  sold-out. The client-side confirmation result is UX only.
- **Both emails fire on payment success** (customer confirmation + owner "new
  order" alert), from the webhook, once. Never at placement — so we never
  confirm or alert on an unpaid/abandoned order. One code path.
- **Move the auto-sold-out flip** out of `placeOrder` and into the webhook, so an
  abandoned/unpaid order never flips a one-of-a-kind piece to sold-out.
- **Resend** for email delivery. Plain, on-brand HTML. Resilient/non-blocking:
  an email failure logs but never breaks a paid order.
- **VAT: none** (owner not registered) — no tax lines.

## Data model — migration `0010_order_payments.sql`

Add to `orders`:

```sql
alter table orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  add column if not exists stripe_payment_intent text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_stripe_payment_intent_idx
  on orders (stripe_payment_intent);
```

- Fulfilment `status` (new/made/posted/cancelled) stays **separate** from
  `payment_status` — an order can be paid but not yet made.
- `refunded` is defined now but **not wired** in Phase 2 (refunds are done in the
  Stripe dashboard; the status is here for later use).
- The `stripe_payment_intent` index lets the webhook look up the order by intent
  id quickly (belt-and-braces alongside the `order_id` metadata).
- `supabase/schema.sql` mirrors all of the above (repo convention).
- Migration numbering follows the **actual applied sequence** — the last file is
  `0009_flat_delivery.sql`, so this is **`0010`** (the ROADMAP referred to it as
  "0004" before four other migrations landed; same change, correct next number).
  The file is idempotent (`if not exists`) regardless.

Types (`app/data/types.ts`): `Order` gains
`paymentStatus: 'unpaid' | 'paid' | 'refunded'`, `stripePaymentIntent: string
| null`, and `paidAt: string | null`; `OrderRow`/`mapOrder` in
`app/admin/orders/queries.ts` updated to match.

## Architecture & new files

- `app/lib/stripe.ts` — server-side Stripe client (secret key, pinned API
  version). Server-only.
- `app/lib/email.ts` — Resend client + the two email templates (customer
  confirmation, owner alert) and a small `sendOrderEmails(order)` helper. Called
  **only** from the webhook.
- `app/lib/orders.ts` — split the current one-shot `placeOrder` into an order
  creation that returns a **PaymentIntent client secret** (see Flow); remove the
  sold-out flip from here.
- `app/api/stripe/webhook/route.ts` — the webhook handler (raw body + signature
  verify).
- `app/components/CheckoutForm.tsx` — the two-step details → Payment Element UI.
- Env vars (concrete set):
  - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
    `STRIPE_WEBHOOK_SECRET` — Stripe.
  - `RESEND_API_KEY` — Resend.
  - `RESEND_FROM` — sender address (test mode: `onboarding@resend.dev`).
  - `OWNER_ORDER_EMAIL` — where the owner "new order" alert is sent (the
    sister's inbox).
  - `NEXT_PUBLIC_APP_URL` — optional; the `return_url` base, already backed by
    the `SITE_URL` fallback logic in `app/lib/site.ts`.
- Packages: `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, `resend`.

> **Framework note (per `AGENTS.md`):** this is "not the Next.js you know."
> Before writing the route handler and server actions, read the relevant guides
> in `node_modules/next/dist/docs/` — in particular raw-body access in App
> Router route handlers (the webhook needs the unparsed body for signature
> verification) and current server-action conventions.

## Flow

1. **Details step.** `CheckoutForm` collects contact + delivery/pickup details
   (exactly as today). The **Continue to payment** button submits to a server
   action `createOrderAndIntent`:
   - Runs the **same server-authority validation** as today's `placeOrder`
     (rebuild items from the catalogue, reject sold-out lines, recompute
     `subtotal`, recompute `shipping` from private `settings`, null the address
     for pickup — all unchanged, lifted from the current `placeOrder`).
   - Inserts the order + `order_items` with `payment_status = 'unpaid'`.
   - Creates a **PaymentIntent**: `amount` = `(subtotal + shipping)` in **pence**,
     `currency: 'gbp'`, `automatic_payment_methods: { enabled: true }`,
     `metadata: { order_id }`. Stores `stripe_payment_intent` on the order.
   - Returns `{ clientSecret, reference, fulfilmentMethod, collection? }` (the
     pickup collection payload is still produced here for the confirmation
     screen, exactly as today).
   - **Does NOT flip sold-out** and **does NOT email** — those move to the
     webhook.
2. **Payment step.** On success the form reveals the **Payment Element**
   (`<Elements stripe={...} options={{ clientSecret }}>` + `<PaymentElement>`),
   styled to the shop (kraft/cream tokens via Stripe `appearance`). The customer
   enters their card and the form calls
   `stripe.confirmPayment({ elements, confirmParams: { return_url }, redirect:
   'if_required' })`. 3-D Secure appears inline/modal only if the bank requires
   it.
   - On confirmed success (no redirect needed) → write the confirmation payload
     to `sessionStorage` (as today) and `router.push('/checkout/success?ref=…')`.
   - If Stripe **does** redirect (some 3DS flows), the `return_url` is the
     success page with the `payment_intent`/`redirect_status` query params Stripe
     appends; the success page treats `redirect_status=succeeded` as success.
3. **Webhook** (`POST /api/stripe/webhook`) — verifies the `stripe-signature`
   against the **raw** body with `STRIPE_WEBHOOK_SECRET`, then:
   - `payment_intent.succeeded` → load the order by `metadata.order_id` (service
     role). **Idempotency guard:** proceed only if `paid_at IS NULL`. Set
     `payment_status = 'paid'`, `paid_at = now()`. Then, best-effort and
     independently wrapped:
     - **Flip the ordered products to sold-out** (moved from `placeOrder`),
       `revalidatePath('/')`, `/admin/products`, each `/product/[id]`.
     - **Send both emails** via `app/lib/email.ts`.
   - `payment_intent.payment_failed` → log only (order stays `unpaid`; the
     customer retries in the browser).
   - Always return **200** to Stripe once the signature verifies, even if a
     downstream best-effort step (email/flip) failed — those are logged for
     manual recovery and must not cause Stripe to retry the whole event
     endlessly. (A failure to *record payment* — the DB update — may return 500
     so Stripe retries.)

## Emails (`app/lib/email.ts`, Resend)

- **Customer confirmation** — subject e.g. "Your BLG Creations order BLG-n".
  Body: greeting, reference, itemised lines + quantities, subtotal, delivery,
  **total**, and:
  - **Delivery order** → the delivery address they entered.
  - **Pickup order** → the **collection address + note**, read from the private
    `settings` table **at send time** via the service role (never trusted from
    the client) — the same pattern `placeOrder` uses today.
- **Owner alert** — subject e.g. "New order BLG-n (£total)". Short: customer
  name/email/phone, items, total, fulfilment method + address/collection.
- Both are **plain, on-brand HTML** (kraft/cream/ink, no flowery copy, no AI
  tells). Sender + owner-notify address come from env (`RESEND_FROM`, owner
  address) — until the custom domain is verified in Phase 3, use Resend's
  onboarding/test sender.
- **Resilience:** the whole send is wrapped in try/catch; a failure is logged
  with the order reference and does not affect the paid order or the 200 to
  Stripe.
- **Known Phase-3 dependency:** Resend's test/onboarding sender can only deliver
  to the account owner's own verified address. In Phase 2 test mode we verify
  emails by placing a test order with the **owner's** email as the customer.
  Real customer delivery goes live with the verified domain in Phase 3 (already
  in the ROADMAP).

## Storefront changes

- **`CheckoutForm`** — becomes the two-step details → Payment Element flow above.
  The order summary (subtotal / delivery / total) is unchanged. The button label
  changes to **Continue to payment**; the "no payment is taken on this page"
  note is removed. While the Payment Element is shown, the details are locked
  with an **Edit** affordance that returns to step 1 (which, if used, creates a
  fresh order + intent on the next Continue — the abandoned `unpaid` row is
  harmless).
- **Success page / `OrderConfirmation`** — copy updates from "we'll be in touch
  to confirm payment" → **"Payment received — we've emailed your receipt."** The
  pickup collection-details block and the `sessionStorage` handoff are unchanged.
  Handle the Stripe redirect-return case (`redirect_status` query param) for 3DS
  flows.

## Admin changes

- **Orders list** gains a **Paid / Unpaid** badge driven by `payment_status`,
  visually distinct from the existing New/Made/Posted fulfilment control. Paid
  rows may also show `paid_at`. (`refunded` renders if ever set manually, but
  isn't actioned in-app.)
- `adminGetOrders`/`mapOrder` map the three new columns.

## Error handling & edge cases

- **Card declined / payment fails** → inline Payment Element error; order stays
  `unpaid`; customer can retry without re-entering details.
- **Webhook redelivery** → idempotent via the `paid_at IS NULL` guard; emails and
  the sold-out flip run at most once.
- **Abandoned checkout** → a harmless `unpaid` order row; no email, no flip. Admin
  can ignore/filter these.
- **Signature verification failure** → 400, no processing (guards against forged
  webhook calls).
- **Cart changes after intent creation** → using **Edit** creates a new order +
  intent; the stale intent/order is never paid and is left `unpaid`.
- **DB not configured (demo mode)** → the current `placeOrder` demo path returns
  success without saving; Phase 2 keeps a no-Stripe fallback so local demo
  without keys still renders (skips the Payment Element / shows a clear "payment
  not configured" state rather than crashing).
- **Two products, one intent** → the sold-out flip covers all distinct product
  ids on the order (as today).

## Verification (no unit-test runner — per project conventions)

- `npx tsc --noEmit` clean; `npm run build` succeeds.
- **Stripe CLI** local loop:
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` → set
  `STRIPE_WEBHOOK_SECRET` from its output.
- Browser preview, full path with **Stripe test cards**:
  - `4242 4242 4242 4242` → success → confirm order flips to **paid**, item goes
    **sold-out**, both emails arrive (to the owner's address in test mode).
  - `4000 0000 0000 0002` (declined) → inline error, order stays **unpaid**, item
    **not** flipped, no email.
  - `4000 0027 6000 3184` (3DS required) → inline authentication, then success.
  - Redeliver the `payment_intent.succeeded` event via the CLI → confirm **no
    duplicate** email and no error (idempotency).
- Owner runs migration `0010` in the Supabase SQL editor; push → Vercel deploy;
  in Phase 3, add the **production webhook endpoint** in Stripe and switch to
  live keys.

## Deliverables requiring the owner

A short **setup guide** (written as part of this work) for the owner to:

1. Create a **Stripe** account → copy the **test** publishable + secret keys.
2. Create a **Resend** account → copy the API key (verify her own email for
   test-mode delivery).
3. Paste the env vars listed above into `.env.local` (and later, Vercel project
   env). `RESEND_FROM` starts as the Resend test sender; `OWNER_ORDER_EMAIL` is
   her own inbox.

The webhook secret for local dev comes from the Stripe CLI; the production
webhook endpoint + live keys are a **Phase 3 launch** step.

## Out of scope (YAGNI / later phases)

- **Refunds in-app** — done in the Stripe dashboard; `refunded` status is
  reserved only.
- **Saved cards / customers, wallets tuning** — `automatic_payment_methods`
  surfaces Apple/Google Pay for free where eligible; no extra work.
- **Discount / voucher codes** — Phase 4.
- **Custom domain + verified email sender + production webhook + live keys** —
  Phase 3 launch.
