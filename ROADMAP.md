# BLG Creations — Roadmap

A handmade-earring storefront for Andrew's sister. This file tracks what's
built and the agreed direction for what's next.

_Last updated: 2026-06-07._

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

### Important caveats about the current state
- **Products are hardcoded.** The 12 earrings live in a static file
  (`app/data/earrings.ts`) and can only be changed by editing code.
- **No real images.** Cards use an SVG earring-silhouette placeholder; there
  is a ready image slot but no photos and no `image` field yet.
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
   set price/description/labels, and **view incoming orders**
5. **Deployment** — hosted and always-on (not just Andrew's laptop), with the
   database in the cloud, since Andrew won't be maintaining it

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

### Suggested build order (incremental)
1. Move products into a Supabase table; shop reads from the DB
2. Add `image` field + Supabase Storage; swap placeholder for real `<Image>`
3. Admin auth (her login) + protected `/admin` area
4. Admin product CRUD (create/edit/delete, photo upload, labels, price)
5. Orders persisted to the DB + an admin orders view
6. Deploy to Vercel; final hardening (validation, friendly errors)

---

## ❓ Open decisions (for Andrew's chat with his sister)

These shape the admin design, so worth settling before building:

- **Labels** — should she be able to *invent new* types/metals/colours herself,
  or pick from a fixed set agreed up front? (Fixed = simpler & safer; custom =
  more flexible but fiddlier, esp. colour swatches.)
- _(Resolved)_ **Attributes** — Metal removed; Colour kept across all
  categories, optional per product. Still optional/low-priority: whether
  Bookmarks/Gifts want any bespoke attributes of their own later.
- **Orders** — should orders appear in *her* admin dashboard (likely yes, since
  Andrew is hands-off)? If so, the **ClearInvoice integration may not be needed
  at all** — or kept so completed orders also become invoices.
- **Login method** — email + password, or "sign in with Google" (one less
  password for her to manage)?

---

## ⏸️ Deferred / parked

- **ClearInvoice integration** — scoped but on hold pending the sister
  conversation. ClearInvoice is Andrew's own Next.js 14 + Supabase app at
  `C:\Projects\clearinvoice` (invoices = user-scoped `invoices` +
  `invoice_items` rows, linked to a `clients` record, protected by RLS).
  Recommended approach: add a secure intake endpoint to the ClearInvoice repo
  (`POST /api/external/orders`, shared-secret auth) that inserts the invoice
  via the service-role key. The shop already POSTs the right shape; wiring is
  just setting `CLEARINVOICE_INTAKE_URL` + `CLEARINVOICE_INTAKE_SECRET`.
  **May be made redundant** by orders living in the new admin dashboard.
- **Real product photography** — waiting on the sister's photos.
