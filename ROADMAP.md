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

**Phase 1 (in progress):** the storefront now uses the full
**Earrings / Bookmarks / Gifts** taxonomy (subcategories for earrings; Metal
removed; Colour kept) behind an **async data-access layer**
(`app/data/products.ts`) whose signatures already match the database. Category /
subcategory / colour filters, category-aware placeholder shapes, and broadened
copy are all live. The **Supabase schema + seed + setup guide** are written
(`supabase/`, `SETUP.md`) — the shop reads sample data until Supabase keys are
added, then flips to the DB with no component changes.

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

**Phase 3 — Admin auth.** Supabase Auth (email + password **and** Google);
protected `/admin` area with middleware.

**Phase 4 — Admin product + label management.** CRUD for products (create /
edit / delete, photo upload, price, description, category/subcategory/colour,
show-hide) and a "manage labels" area (add/edit categories, subcategories,
colours with swatches).

**Phase 5 — Orders → ClearInvoice draft invoices.** Add a secure intake
endpoint to the `clearinvoice` repo (`POST /api/external/orders`, shared-secret
auth) that creates a `client` + **draft `invoice`** + `invoice_items` via the
service-role key; wire the shop's existing `forwardOrderToClearInvoice()` to it
and set `CLEARINVOICE_INTAKE_URL` + `CLEARINVOICE_INTAKE_SECRET`.
_Confirm at this point:_ which ClearInvoice account owns the invoices, and VAT
treatment (default: no VAT).

**Phase 6 — Deploy + harden.** Deploy to Vercel, wire env vars, optional custom
domain; final validation, empty states, SEO.

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
- _(Resolved)_ **Orders → ClearInvoice as draft invoices.** Path 1 chosen: the
  shop's admin manages products; orders flow into ClearInvoice (draft invoices)
  which already handles customers, line items, PDF, email, and payment. No
  separate order system is built in the shop. (Remaining detail confirmed at
  Phase 5: which ClearInvoice account, VAT.)
- _(Resolved)_ **Login — both email + password AND Google.** Owner gets both
  sign-in methods (Supabase Auth supports both natively). Google needs a one-off
  Google OAuth client wired into Supabase; doesn't affect the rest of the build.

---

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
