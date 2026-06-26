# BLG Creations — Roadmap

A handmade **jewellery & gifts** storefront for Andrew's sister (BLG Creations).
This file tracks what's built and the agreed plan for what's next, organised into
phases.

_Last updated: 2026-06-26. Live at `earring-shop-coral.vercel.app`._
_Launch strategy (confirmed): **Stripe first, then launch.**_

---

## Phases at a glance

| Phase | What | Status |
|-------|------|--------|
| **1** | The store itself | ✅ complete |
| **2** | Take payment online (Stripe + automatic emails) | **next** |
| **3** | Launch readiness → go live | after Phase 2 |
| **4** | Growth & future | post-launch / optional |
| — | Parallel: content (photos, copy, policies) | owner, ongoing |

---

## Phase 1 — The store itself ✅ COMPLETE

A complete self-service storefront + admin, live on Vercel and connected to
Supabase.

**Storefront**
- Catalogue (Earrings / Bookmarks / Gifts) with category tabs and refine filters
  (earring type, colour, **in-stock-only** toggle).
- Product detail pages with a **multi-photo gallery** (thumbnails, click/keyboard/
  touch-swipe), related items, metadata.
- Cart (localStorage, accessible drawer) and checkout that **captures orders**
  (validates server-side, rebuilds prices from the catalogue, saves to Supabase).
- Branded 404, reduced-motion support.

**Admin (`/admin`, private login)**
- Auth (email + password); product CRUD; **multi-photo manager** (drag-to-reorder,
  up to 6, first = main); labels management (categories / earring types / colours);
  orders list with a status control (New → Made → Posted / Cancelled).

**Data & infra**
- Supabase Postgres (products / labels / orders) + Storage (product photos);
  RLS public-read / authenticated-write; service-role for server tasks.
- Deployed on Vercel (auto-deploy on push to `main`); daily **keep-alive cron**
  so the free-tier project doesn't auto-pause during testing.

**Features & polish**
- **Sold-out flag** (badge + un-buyable, server-enforced) with **auto-flip on
  sale** — each piece is one-of-a-kind; the owner toggles it back in stock when
  she remakes one.
- Design pass: artisan brand (Kraft/cream/ink, Amatic SC + Cabin), **paper
  texture**, **reworked hero** with logo-echoing sparkles, **staggered load
  motion**, **LCP image priority**, accessibility, no "AI-tell" patterns.

---

## Phase 2 — Take payment online (Stripe + automatic emails) — NEXT

**Goal:** customers pay by card on the site; the order is marked paid and both the
customer and the owner get an email. All major decisions are locked (build detail
in "Reference: Stripe payment plan" below).

- **Stripe** — single merchant (owner's own account, not Connect), **embedded
  Payment Element**, **GBP**, built/tested in **test mode** first. Migration
  `0004` adds `payment_status` / `stripe_payment_intent` / `paid_at`; checkout
  creates a PaymentIntent; the webhook on `payment_intent.succeeded` is the source
  of truth (marks the order paid). Admin Orders gains a **Paid / Unpaid** badge.
  Card data stays in Stripe's iframe (PCI SAQ A).
- **Move the auto-sold-out flip** from `placeOrder` (`app/lib/orders.ts`) into the
  `payment_intent.succeeded` webhook, so unpaid/abandoned orders never flip items.
- **Automatic emails (Resend)** — customer confirmation **on payment success**;
  owner "new order" notification. Resilient / non-blocking (an email failure must
  never break payment). Plain, on-brand templates.
- **Shipping** — implement the model the owner chooses (see Decisions).

**Owner needs:** a Stripe account (test keys to start). Email can use Resend's
test sender until the custom domain is verified in Phase 3.

---

## Phase 3 — Launch readiness → go live

Make it production-ready, then flip the switch.

- **Custom domain** — buy + connect to Vercel; set `NEXT_PUBLIC_APP_URL` for stable
  canonical / OG URLs.
- **Verified email sender** — verify the custom domain in Resend so emails come
  from her brand, not a test address.
- **Legal / policy pages** — returns & refunds, privacy, terms. Needed before
  taking real money and reassures buyers.
- **Supabase Pro** — upgrade so the project never auto-pauses; then **remove the
  keep-alive cron** (`app/api/keep-alive/route.ts` + the `vercel.json` cron).
- **Analytics** — Vercel Web Analytics + Speed Insights.
- **Social share image** — an OG image once real product photos exist.
- **Final QA** — a real end-to-end test purchase in Stripe **live** mode (then
  refunded), full mobile pass across shop → cart → checkout → email.
- **Go live** — switch Stripe to live keys + add the production webhook endpoint,
  then share the link / start promoting.

---

## Phase 4 — Growth & future (post-launch, optional)

- **Google sign-in** — re-add (the button was removed; needs the Google OAuth
  provider enabled in Supabase).
- **Product badges / tags** — "New", "Bestseller", seasonal (the data-driven
  labels make this easy).
- **Discount / voucher codes.**
- **Stock quantities** — only if she ever needs counts beyond the sold-out flag.
- **SEO + marketing** — sitemap, richer metadata, social presence.
- **ClearInvoice Path 2** — the strategic play: generalise the storefront into a
  multi-tenant ClearInvoice feature (see "Reference: Strategic direction").

---

## Parallel track — content (owner, ongoing; doesn't block dev)

- **Real product photography** — the single biggest perceived-quality lever.
- Final product descriptions + prices.
- Shipping + returns policy wording (feeds the Phase 3 policy pages).

---

## Decisions the owner needs to make

1. **Shipping model** — free / flat-rate £? / arranged separately. _Blocks Phase 2
   order totals + checkout copy._
2. **Custom domain** — which domain. _Blocks Phase 3 + branded email sender._
3. **Owner email timing** — fire on **payment success** (recommended, consistent)
   or at order placement (earlier visibility).
4. **VAT** — confirmed **none** (not registered).

---

# Reference detail

The locked decisions and build notes for the phases above.

## Stripe payment plan (Phase 2)

Model: **single merchant** (owner's own Stripe account, not Connect), **pay
on-site** via the **embedded Stripe Payment Element** — locked 2026-06-09 (no
redirect to Stripe; card entered inline, styled to match the shop). **GBP.** Card
data lives in Stripe's iframe so we never touch it (PCI SAQ A). Orders already
persist; this layers payment on top. Build/test in **Stripe test mode** first;
live payment needs the site **deployed** (webhooks need a public URL).

**Data model — migration `0004_order_payments.sql`:**
- Add to `orders`: `payment_status` ('unpaid' | 'paid' | 'refunded', default
  'unpaid'), `stripe_payment_intent`, `paid_at`.
- Keep fulfilment `status` (new/made/posted) separate from payment status.

**Flow:**
1. Checkout collects details (incl. address — Option A) and renders the **Payment
   Element**. The server creates the order (`payment_status` 'unpaid') **and** a
   **PaymentIntent** (amount in GBP pence, `metadata.order_id`,
   `automatic_payment_methods` on); returns the `client_secret`.
2. Customer enters their card inline → client calls `stripe.confirmPayment({
   clientSecret, confirmParams:{ return_url }, redirect:'if_required' })`. 3-D
   Secure shows inline/modal only if the bank requires it. On success → show
   confirmation.
3. Webhook `POST /api/stripe/webhook` (verifies signature) handles
   `payment_intent.succeeded` → marks the order `paid` + `paid_at` (service role),
   **sends the customer confirmation email**, and **flips the ordered products to
   sold out** (relocated from `placeOrder`). The webhook is the source of truth;
   the client result is just UX.

**Build steps:**
- `npm i stripe @stripe/stripe-js @stripe/react-stripe-js`.
- `app/lib/stripe.ts` (server client, secret key).
- `app/lib/email.ts` (Resend client + templates), called from the webhook.
- Migration `0004` (payment columns).
- Server action/route to create the order + PaymentIntent and return the
  `client_secret`; `CheckoutForm` wraps the card field in `<Elements>` +
  `<PaymentElement>` and confirms with `redirect:'if_required'`.
- `app/api/stripe/webhook/route.ts` (raw body + `stripe-signature` verify; handle
  `payment_intent.succeeded` / `payment_failed`).
- Success-page + checkout copy updates ("Pay securely below" / "Payment
  received"). Admin Orders: **Paid / Unpaid** badge.
- Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`.

**Setup / order of work:**
1. Owner creates a Stripe account → test keys.
2. Local test: Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. Build + verify in test mode (test cards).
4. After Phase 3 deploy → add a prod webhook endpoint in Stripe → switch to live keys.

## Order confirmation emails (Phase 2)

Decided 2026-06-13 — built **with** Stripe, not before.
- **Customer email fires only on payment success** — sent from the webhook
  (`payment_intent.succeeded`), never at order placement, so we never confirm an
  unpaid order. Contains the reference (`BLG-n`), items, total, delivery address.
- **Owner notification** ("new order" alert) — default to payment success for
  consistency (see Decisions: she may prefer placement for earlier visibility).
- **Resend** for delivery (Vercel-native; already used in ClearInvoice). Needs
  `RESEND_API_KEY` + a **verified sender domain** (ties into the custom-domain
  decision — until verified, use Resend's onboarding/test sender).
- **Resilient + non-blocking** — wrap in try/catch and log; the order is already
  saved + paid. Plain, on-brand HTML (no flowery copy).

## Address handling — Option A (locked 2026-06-09)

Our checkout form collects the delivery address (as now); Stripe does **not**
collect a shipping address, so it's never entered twice. Stripe may still ask for
the card's billing postcode (`billing_address_collection: 'auto'`) — a normal card
check, not the delivery address. The full order (incl. address) is saved before
payment. VAT: none (not registered).

## Quality bar — apply in EVERY phase

Keep the shop and admin feeling handmade and professional, with zero "AI tell-tale"
patterns:
- **Brand consistency:** Kraft/cream/ink + Amatic SC / Cabin everywhere, including
  the admin (no generic blue SaaS theme). Semantic tokens, not raw hex.
- **No AI tells:** no glassmorphism / `backdrop-blur`, no decorative gradients
  (the multicolour swatch's conic-gradient is functional), minimal shadows,
  squared `rounded`/`rounded-lg` (never `rounded-full` on controls — swatches and
  the in-stock toggle excepted), one SVG icon family (no emoji), human copy, and
  **real photography in place of placeholders as soon as possible**.
- **Accessibility:** visible focus rings, `aria-label` on icon-only buttons,
  `role="alert"` on errors, reduced-motion honoured, sequential headings, 4.5:1
  contrast.
- **Touch:** 44px minimum tap targets.
- **Forms:** visible labels, required markers, correct input types, validate +
  summary on submit, disabled+spinner while saving, success confirmation.
- **Destructive actions:** confirm first, danger colour, separated from primary.
- **Empty + loading states** on every list/async surface.
- **Images:** `next/image` with sizes/aspect-ratio (avoid layout shift), lazy below
  the fold (priority for the LCP), descriptive `alt`, Supabase host in
  `next.config` remotePatterns.
- **Responsive:** mobile-first; tables become cards or scroll on mobile.

## Strategic direction (Path 2 — Phase 4 / later)

The earring shop is **customer zero** for a potential ClearInvoice feature: hosted
**storefronts / landing pages** for ClearInvoice users that capture the customer
and create a **draft invoice** automatically. ClearInvoice already has the engine —
clients, invoice_items, draft-invoice status, PDF, Resend email, Stripe Connect,
Supabase auth + storage — so the marginal build is a public catalogue + order
capture, with the storefront UI built here as the rendering template. Keep it
deliberately **invoice-first / made-to-order**, not a full Shopify clone.

ClearInvoice technical notes: Andrew's own Next.js 14 + Supabase app at
`C:\Projects\clearinvoice`; invoices are user-scoped (`invoices` + `invoice_items`,
linked to a `clients` record, protected by RLS); `draft` is a native invoice
status.
