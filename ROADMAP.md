# BLG Creations — Roadmap

A handmade-earring storefront for Andrew's sister. This file tracks what's
built and the agreed direction for what's next.

_Last updated: 2026-06-08._

---

## ✅ Done so far

The **frontend storefront** is built and working:

- Shop page with product grid and live filtering by **type / metal / colour**
- Product **detail pages** (`/product/[id]`) with related items and metadata
- Branded **404** page
- **Cart** — add/remove/quantity, persisted in the browser (`localStorage`),
  accessible slide-over drawer (Esc to close, scrim, focus handling)
- **Checkout** (`/checkout`) — customer + delivery form, live order summary,
  server-side validation, and a confirmation page (`/checkout/success`)
- Design pass: artisan look (Kraft/cream/ink, Amatic SC + Cabin), AI-pattern
  cleanup, reduced-motion support
- Pushed to GitHub: `github.com/andrew-mcmanis/earring-shop`

**Phase 1 ✅ complete (connected to Supabase).** The storefront uses the full
**Earrings / Bookmarks / Gifts** taxonomy (subcategories for earrings; Metal
removed; Colour kept) and **reads live from the Supabase database** via the
async data-access layer (`app/data/products.ts`), falling back to the in-repo
sample catalogue if the DB is ever unavailable. Supabase project created
(region London), schema + seed run, public storefront reads confirmed working.
Category / subcategory / colour filters, category-aware placeholders, and
broadened copy are all live.

### Important caveats about the current state
- **Products are still sample data** (`app/data/sample.ts`) until the Supabase
  project is created (see `SETUP.md`) and the data layer is pointed at it.
- **No real images.** Cards use a category-aware SVG placeholder; the `image`
  field exists in the model + schema, ready for Phase 2 upload.
- **Orders go nowhere durable.** Checkout validates server-side then just logs
  the order (the `forwardOrderToClearInvoice()` helper is dormant until
  configured). A placed order is currently not saved or sent anywhere.

---

## 🎯 Agreed direction: a self-service shop

**Requirement (from Andrew):** his sister will control *everything* — upload
images, write descriptions, set prices and labels — herself. Andrew will not
be involved once she starts using it.

**Consequence:** this is no longer a static site. It needs a small but real
**content-management system** plus hosting. Specifically:

1. **Database** for products (replaces the static `earrings.ts` array)
2. **Image upload + storage** for her photos
3. **Authentication** — a private login, just for her, to reach the admin area
4. **Admin dashboard** — screens to add/edit/delete products, upload photos,
   set price/description/labels (orders themselves go to ClearInvoice — see
   below — so the admin focuses on products)
5. **Deployment** — hosted and always-on (not just Andrew's laptop), with the
   database in the cloud, since Andrew won't be maintaining it

**Approach chosen (2026-06-08): Path 1 first.** Build the standalone shop for
the sister now, with **orders flowing into ClearInvoice as draft invoices**
(the shop manages products; ClearInvoice handles orders → invoices → payment).
Build the order→invoice integration cleanly so it's reusable, with the explicit
intention of later generalising the storefront into a ClearInvoice feature
(**Path 2** — see "Strategic direction" at the foot of this file).

### Product taxonomy (confirmed by owner)

The shop is **not earrings-only**. Three top-level categories, with
subcategories only under Earrings (for now):

```
Earrings
  ├─ Dangles
  ├─ Hoops
  └─ Studs
Bookmarks
Gifts
```

**Attributes (confirmed):**
- **Metal — removed.** Not needed. Retire the metal field, filter pills, and
  metal data from the current prototype.
- **Colour — kept.** Applies across **all categories** (earrings, bookmarks,
  gifts), **optional per product** (left blank when it doesn't apply). Keeps the
  colour swatches.
- So the shop filters become **Category / subcategory + Colour**.

Implications:
- Data model needs a **category** (Earrings / Bookmarks / Gifts) + an optional
  **subcategory** (Earrings only: Dangles / Hoops / Studs) + optional **colour**.
  Replaces the current flat `type` + `metal` fields (old "drop"/"huggie" types
  and all metal data are dropped).
- Navigation: top-level category nav, with Earrings expandable to its three
  subcategories.
- Copy/branding: hero says "Handmade earrings" — now too narrow; needs to cover
  bookmarks and gifts too. (`EarringIcon`, earring-specific copy also assume
  earrings-only.)

### Recommended stack
- **Supabase** — already used by Andrew's other app (ClearInvoice). Bundles the
  three backend needs in one service: **Postgres database + Auth + Storage**.
  Free tier covers a small shop. Reuses a known platform instead of new vendors.
- **Vercel** for hosting/deployment (free tier; same ecosystem as the current
  Next.js app).

### Build plan — Path 1 (all decisions settled)

**Phase 0 — Foundations.** Create a Supabase project for the shop (its own,
separate from ClearInvoice); add the Supabase client libs + env vars.

**Phase 1 — Products in the database.** Schema with data-driven labels:
`categories` (Earrings/Bookmarks/Gifts), `subcategories` (parent → category;
Earrings only for now), `colours` (name + swatch hex), `products` (name,
description, price, category, optional subcategory, optional colour, visibility,
sort). Seed with the current 12 as sample data. Point the public shop at the DB;
rework filters to **Category / subcategory + Colour** (remove Metal); generalise
earrings-only copy/components to cover all three categories.

**Phase 2 — Images.** Add image field(s) + Supabase Storage; swap the
placeholder for real `<Image>` (placeholder stays until photos arrive).

**Phase 3 — Admin auth. ✅ done.** Supabase Auth (email + password working;
Google button present, needs the Google provider enabled in Supabase to
function). Protected `/admin` via `middleware.ts`; branded `/admin/login`;
dashboard shell with sign-out and Products/Orders/Labels sections. Verified:
route protection, sign-in, and sign-out all work.

**Phase 4 — Admin product + label management.**
- ✅ **Product CRUD done:** `/admin/products` list (responsive cards, thumbnail,
  meta, price, visibility toggle, edit, two-step delete), `/admin/products/new`
  and `/admin/products/[id]/edit` with a shared form (validation, conditional
  earring-type field, colour, show/hide). Writes use the signed-in user's
  session (RLS `authenticated`); the shop revalidates on save. Verified live
  (create → appears in admin + shop; delete removes it).
- ✅ **Image upload done** (Phase 2 folded in): photo field on the product form
  uploads to the `product-images` Storage bucket server-side (service role) and
  sets `image_url`; real photos render via `next/image` across the shop, product
  pages, admin list, cart and checkout, with the placeholder as fallback.
  Verified: upload → public URL → renders; placeholder still shows when no
  photo.
- ✅ **Labels management done:** `/admin/labels` — add / rename / delete
  categories and earring types, and add / edit / delete colours (name + swatch).
  Slugs auto-generate and stay stable on rename; deleting a category that's in
  use is blocked with a friendly message. Changes revalidate the shop. Verified
  live (add colour → appears in shop filter; in-use category delete blocked).

**Phase 4 is complete.**

**Phase 5 — Orders + Stripe payment.** _(Payment model confirmed 2026-06-08:
pay-at-checkout via Stripe; orders shown in the shop's own admin — "option a".)_
- ✅ **Orders persistence + admin Orders view done.** Checkout saves the order
  to Supabase (`orders` + `order_items`, snapshotting name/price) via the
  service role, resilient if the DB is unavailable. `/admin/orders` lists orders
  (newest first) with items, customer + delivery details, total, and a status
  control (New → Made → Posted / Cancelled). Migration `0003_orders.sql` must be
  run in Supabase to activate persistence.
- **Stripe Checkout** (deferred — "cross when we need to"): the owner's **own
  Stripe account** (single merchant, not Connect); the shop creates a Checkout
  Session server-side → Stripe-hosted payment page → webhook marks the order
  paid. Needs: her Stripe account, **deployment** (live webhooks need a public
  URL), and **GBP/£** prices. Build + test in Stripe **test mode** first.
- ClearInvoice is **not** in the payment path. Pushing paid orders to
  ClearInvoice as records is now optional/Path 2, superseding the earlier
  "order → draft invoice" plan.

**Phase 6 — Deploy + harden. ✅ Live on Vercel** (2026-06-09) at
`earring-shop-coral.vercel.app`, connected to Supabase (verified: serves real
DB products). Auto-deploys on push to `main`. Remaining nice-to-haves: custom
domain, web analytics/speed insights, and rotating the Supabase secret key in
both `.env.local` and Vercel.

---

## ❓ Open decisions (for Andrew's chat with his sister)

These shape the admin design, so worth settling before building:

- _(Resolved)_ **Labels — data-driven / extensible.** Categories,
  subcategories, and colours live in the DB and the owner can add new ones via
  the admin (no code/redesign needed). Chosen to future-proof and avoid later
  redesigns. Implications: a small "manage labels" capability in the admin;
  colours need **name + swatch colour** to keep filter swatches working; light
  guardrails so labels don't sprawl. Bonus: makes future product badges/tags
  ("New", "Bestseller", seasonal) trivial to add.
- _(Resolved)_ **Attributes** — Metal removed; Colour kept across all
  categories, optional per product. Still optional/low-priority: whether
  Bookmarks/Gifts want any bespoke attributes of their own later.
- _(Resolved, superseded 2026-06-08)_ **Orders + payment.** The sister wants
  **Stripe payment at checkout**, and orders are shown in the **shop's own admin
  ("option a")** — not ClearInvoice. So: customer pays on the shop via Stripe
  Checkout (her own Stripe account), the order is saved to Supabase and appears
  in her admin Orders page. Stripe build is **deferred** ("cross when we need
  to"); the earlier "order → ClearInvoice draft invoice" plan is dropped from the
  critical path (optional/Path 2 for records only). _Still to confirm with her:_
  shipping (free / flat rate / calculated).
- _(Resolved)_ **Login — both email + password AND Google.** Owner gets both
  sign-in methods (Supabase Auth supports both natively). Google needs a one-off
  Google OAuth client wired into Supabase; doesn't affect the rest of the build.

---

## 💳 Stripe payment plan (Phase 5b — when ready)

Model: **single merchant** (owner's own Stripe account, not Connect), **pay
on-site** via the **embedded Stripe Payment Element** — Option 2, locked
2026-06-09 (no redirect to Stripe; card entered inline, styled to match the
shop). **GBP.** Card data lives in Stripe's iframe so we never touch it (PCI
SAQ A). Orders already persist; this layers payment on top. Build/test in
**Stripe test mode** first; live payment needs the site **deployed** (webhooks
need a public URL).

**Data model — migration `0004_order_payments.sql`:**
- Add to `orders`: `payment_status` ('unpaid'|'paid'|'refunded', default
  'unpaid'), `stripe_payment_intent`, `paid_at`.
- Keep fulfilment `status` (new/made/posted) separate from payment status.

**Flow:**
1. Checkout page collects details (incl. address — Option A) and renders the
   **Payment Element**. Server creates the order (payment_status 'unpaid') **and**
   a **PaymentIntent** (amount in GBP pence, `metadata.order_id`,
   automatic_payment_methods on); returns the `client_secret`.
2. Customer enters their card in the inline element → client calls
   `stripe.confirmPayment({ clientSecret, confirmParams:{ return_url },
   redirect:'if_required' })`. 3-D Secure shows inline/modal only if the bank
   requires it. On success → show confirmation.
3. Webhook `POST /api/stripe/webhook` (verifies signature) handles
   `payment_intent.succeeded` → marks the order `paid` + `paid_at` (service
   role). The webhook is the source of truth; the client result is just UX.

**Build steps:**
- `npm i stripe @stripe/stripe-js @stripe/react-stripe-js`.
- `app/lib/stripe.ts` (server client, secret key).
- Migration 0004 (payment columns).
- Server action/route to create the order + PaymentIntent and return the
  client_secret; `CheckoutForm` wraps the card field in `<Elements>` +
  `<PaymentElement>` and confirms with `redirect:'if_required'`.
- `app/api/stripe/webhook/route.ts` (raw body + `stripe-signature` verify;
  handle payment_intent.succeeded / payment_failed).
- Success-page + checkout copy updates ("Pay securely below" / "Payment
  received"). Admin Orders: add a **Paid / Unpaid** badge.
- Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (safe to
  expose), `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

**Setup / order of work:**
1. Owner creates a Stripe account → test keys.
2. Local test: Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. Build + verify in test mode (test cards).
4. Deploy (Phase 6) → add a prod webhook endpoint in Stripe → switch to live keys.

**Address handling — Option A (locked 2026-06-09):** our checkout form collects
the delivery address (as now); the Stripe Checkout Session does **not** collect
a shipping address (`shipping_address_collection` off), so it's never entered
twice. Stripe may still ask for the card's billing postcode via
`billing_address_collection: 'auto'` — that's a normal card check, not the
delivery address. The full order (incl. address) is saved before payment.

**Decisions still needed (owner):** shipping (free / flat rate £? / arranged
separately). VAT: none (not registered).

## ✅ Quality bar — apply in EVERY phase

Reviewed 2026-06-08. Keep the shop and admin feeling handmade and professional,
with zero "AI tell-tale" patterns:

- **Brand consistency:** Kraft/cream/ink palette + Amatic SC / Cabin everywhere,
  including the admin (no generic blue SaaS dashboard theme). Semantic tokens,
  not raw hex in components.
- **No AI tells:** no glassmorphism / `backdrop-blur`, no decorative gradients
  (the multicolour swatch's conic-gradient is functional), minimal shadows
  (`shadow-sm` on cards; heavier only on true overlays), squared-off
  `rounded`/`rounded-lg` (never `rounded-full` on controls — swatches excepted,
  they're literally round), SVG icons from one family (no emoji), human copy
  (no filler), and **real photography in place of placeholders as soon as
  possible** (biggest perceived-quality lever).
- **Accessibility:** visible focus rings, `aria-label` on icon-only buttons,
  `aria-live` on dynamic text, `role="alert"` on errors, reduced-motion honoured,
  sequential headings, 4.5:1 contrast.
- **Touch:** 44px minimum tap targets (swatches/steppers fixed to this).
- **Forms:** visible labels, required markers, correct input types, validate on
  blur + summary on submit, disabled+spinner while saving, success confirmation.
- **Destructive actions:** confirm first, danger colour, separated from primary
  actions, offer undo where feasible.
- **Empty + loading states** on every list/async surface.
- **Images (when added):** `next/image` with width/height or aspect-ratio (avoid
  layout shift), lazy-load below the fold, descriptive `alt`, Supabase host in
  `next.config` remotePatterns.
- **Responsive:** mobile-first; tables become cards or scroll on mobile.

## 🔭 Strategic direction (Path 2 — later)

The earring shop is **customer zero** for a potential ClearInvoice feature:
hosted **storefronts / landing pages** for ClearInvoice users that capture the
customer and create a **draft invoice** automatically. It fits unusually well
because ClearInvoice already has the whole engine — clients, invoice_items,
draft-invoice status, PDF, Resend email, Stripe Connect "pay now", Supabase
auth (email + Google) and storage. The marginal build is a public catalogue +
order capture, not a new commerce engine, and the storefront UI built here
becomes the rendering template.

Plan: ship Path 1 for the sister first to prove the order→draft-invoice flow,
then generalise into a multi-tenant ClearInvoice feature (routing/subdomains
per store, public-read product data, per-tenant theming + image storage). Keep
it deliberately **invoice-first / made-to-order** — not a full Shopify clone.

ClearInvoice technical notes (for Phase 5 integration): Andrew's own Next.js 14
+ Supabase app at `C:\Projects\clearinvoice`; invoices are user-scoped
(`invoices` + `invoice_items`, linked to a `clients` record, protected by RLS);
`draft` is a native invoice status.

## ⏸️ Parked

- **Real product photography** — waiting on the sister's photos. The image slot
  and (after Phase 2) the upload flow will be ready to receive them.
