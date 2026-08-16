# Content pages: Returns, Jewellery Care, Contact + Privacy & Terms — design

_Date: 2026-08-16_

## Problem

The live shop has **no content pages at all** — the footer holds only the brand
block and a "Sign in" link. Before it can take **real** card payments (currently
Stripe TEST mode), it needs the customer-facing policy and contact content that
go-live checklist item #1 has been waiting on. Bev has now supplied three
documents:

1. **Returns Policy** (`returns procedure.docx`) — complete, well-written.
2. **Jewellery Care card** (`jewellery care card.docx` / `.pdf`) — a physical
   two-sided print card; the web-relevant content is 4 care tips plus two
   friendly lines ("Thank you…", "Follow @BLG.Creations…").
3. **Contact details** — email `orders@blgcreations.co.uk` + Instagram
   `@BLG.Creations`.

This spec covers publishing those three, **plus** drafting a **Privacy Policy**
and **Terms & Conditions** (which Bev has not supplied) so the shop is legally
presentable for real payments. It does **not** cover about/meet-the-maker,
delivery-info, or a contact form.

## Decisions (confirmed with Andrew)

- **Separate pages + footer nav** — dedicated routes, not a combined hub and not
  care-on-product-pages. (Rejected: one "Help & Info" page — longer scroll, less
  shareable per topic; care-on-every-product — repeated content.)
- **Draft Privacy + Terms now** — standard UK sole-trader drafts, written for
  Andrew + Bev to review, so go-live isn't blocked waiting on them.
- **Contact = simple page, no form** — email (`mailto:`) + Instagram link + a
  friendly note. No form handler / spam surface; order email already routes to
  Bev's `orders@` inbox.
- **Sole trader** — legal pages name **"Bev Gallifant trading as BLG Creations"**
  (Andrew to correct if the trading name differs); no company number.
- **Instagram is live** — link `https://instagram.com/blg.creations` from the
  Contact page and footer.

## Architecture — a shared "content" route group

A **Next.js App Router route group** gives all five pages one shared layout
instead of five copies of `<Header/>…<Footer/>`:

```
app/(content)/layout.tsx            ← Header + centered prose <main> + Footer
app/(content)/returns/page.tsx
app/(content)/jewellery-care/page.tsx
app/(content)/contact/page.tsx
app/(content)/privacy/page.tsx
app/(content)/terms/page.tsx
```

- The `(content)` group's `layout.tsx` renders `<Header/>`, a centered
  `<main>` reading column, and `<Footer/>` **once**; each `page.tsx` supplies
  only its content.
- All five are **static Server Components** — no `'use client'`, no client JS
  beyond the Header/cart that every page already loads. Fast, cacheable.
- The **home page is untouched** — `app/page.tsx` is outside the group and keeps
  composing its own Header/Footer, so nothing about the storefront changes.
- Per `AGENTS.md` ("this is NOT the Next.js you know"), route-group + nested
  layout specifics get checked against `node_modules/next/dist/docs/` before
  writing the layout.

_Alternative considered:_ repeat Header/Footer per page (the home-page pattern).
Rejected — five copies to keep in sync for pages that are otherwise identical
chrome.

## Shared presentation — a `Prose` wrapper

One small presentational component (e.g. `app/(content)/Prose.tsx` or
`app/components/Prose.tsx`) provides consistent typography for all five pages,
built from the **existing design tokens** — **not** the Tailwind typography
plugin (avoids a new dependency and keeps the deliberate "no AI tells" look):

- Amatic SC (`font-heading`) page titles + section headings; Cabin (`font-body`)
  body.
- Comfortable measure (~65ch / `max-w-prose`), generous `leading-relaxed`,
  kraft/cream/ink palette, section spacing, styled `<ul>`/`<ol>` and `mailto`/
  external links (kraft, underline-offset, hover) matching the current site.
- No glassmorphism, minimal shadows, no `rounded-full` on anything.

The `(content)/layout.tsx` wraps `{children}` in the reading column; each page
uses `Prose` for its body. Footer's existing `mt-auto` keeps it pinned to the
bottom on short pages (root `<body>` is already `min-h-full flex flex-col`).

## The pages

### `/returns` — Returns Policy
Bev's document reproduced **near-verbatim** (it reads well and is legally
careful), reflowed to the design system:
- Intro; **Change-of-Mind Returns**; **Items That Cannot Be Returned Unless
  Faulty** (pierced earrings — hygiene; personalised/made-to-order); **Faulty,
  Damaged or Incorrect Items**; **Return Postage**; **Refunds**; **How to
  Request a Return** (numbered `<ol>`); **Questions**.
- `orders@blgcreations.co.uk` rendered as a `mailto:` link throughout.

### `/jewellery-care` — Jewellery Care
- Title + short lead.
- The **4 care tips** as small **icon cards** (responsive grid): each tip paired
  with a **hand-drawn inline SVG** in kraft — spray/lotion, storage box, water
  drop, moon — recreating the print card's spirit with **no icon library**.
  Tips (verbatim):
  1. Avoid sprays or lotions near any jewellery as they can cause tarnishing.
  2. Keep jewellery stored separately from other pieces, in a cool, dark place
     using jewellery boxes & pouches.
  3. Keep jewellery from getting wet. Remove before bathing or swimming.
  4. Remove jewellery before going to bed to prevent accidents in your sleep.
- Closing: **"Thank you so much for your purchase!"** + **"Follow us on
  Instagram for more beautiful designs"** linking `instagram.com/blg.creations`.
- Reuse of the existing `Sparkle` motif for a light accent is optional/allowed.

### `/contact` — Contact
- Friendly one-paragraph intro (best way to reach Bev; happy to help with
  orders/questions).
- **Email:** `orders@blgcreations.co.uk` as a prominent `mailto:` link.
- **Instagram:** `@BLG.Creations` → `instagram.com/blg.creations`
  (`target="_blank"`, `rel="noopener noreferrer"`).
- Short pointers to `/returns` and `/jewellery-care` for common questions.
- **No form.**

### `/privacy` — Privacy Policy (draft)
Plain-English, sole-trader framing:
- **Who we are** — Bev Gallifant t/a BLG Creations; contact `orders@`.
- **What we collect** — name, email, delivery address, phone (if given), order
  details — provided by the customer at checkout.
- **Payment** — card details go **straight to Stripe**; the shop never sees or
  stores card numbers.
- **Processors we use** — Stripe (payments), Resend (order emails), Vercel
  (hosting + **cookieless** analytics/speed insights), Supabase (order data).
- **Cookies** — **essential only** (cart/session). Analytics are cookieless →
  **no cookie-consent banner required**.
- **Lawful basis** — performing the sales contract; limited legitimate interest.
- **Retention** — order records kept as needed for the order + legal/accounting.
- **Your rights** — access, correction, erasure, and complaint to the **ICO**
  (link), plus how to exercise them (email `orders@`).

### `/terms` — Terms & Conditions (draft)
- **About our items** — handmade; slight colour/size/pattern variation is normal
  and not a fault.
- **Ordering & prices** — GBP, price as shown at checkout; **assumes not
  VAT-registered** (see open items).
- **Payment** — card via Stripe at checkout; order confirmed once payment
  succeeds.
- **Delivery** — as shown at checkout (links behaviour to the existing delivery
  settings; no new delivery page).
- **Cancellation & returns** — statutory rights; **links to `/returns`**.
- **Faulty goods** — Consumer Rights Act 2015 summary.
- **Liability** — reasonable limitation for a small maker.
- **Governing law** — **England & Wales** (see open items).
- **Contact** — `orders@`.

## Footer navigation (`app/components/Footer.tsx`)

Add a small link row to the existing footer (keeps the brand block, copyright,
and "Sign in"):

> **Returns · Jewellery Care · Contact · Privacy · Terms**

- `next/link` items, `font-body text-xs`, kraft hover + underline-offset,
  matching the existing "Sign in" link treatment.
- Wraps gracefully on mobile; dot/pipe separators are decorative
  (`aria-hidden`).
- "Sign in" stays where it is (its own line with the copyright).

## Metadata / SEO

Each page exports `metadata` (title only needed — the root layout template adds
"· BLG Creations" and supplies the description default):
`Returns Policy` · `Jewellery Care` · `Contact` · `Privacy Policy` ·
`Terms & Conditions`.

## Open items to confirm before the legal pages go live

Flagged **visibly in the drafts** (not silently guessed); none block starting:

- **Legal / trading name** — drafted as "Bev Gallifant trading as BLG
  Creations"; confirm exact name.
- **VAT** — drafted as **not VAT-registered** (under £90k threshold); flag if
  registered so pricing wording changes.
- **Governing law** — drafted **England & Wales**; change if Bev trades from
  Scotland / NI.
- **ICO registration** — a sole trader processing customer data online likely
  must register with the ICO (~£40/yr). **Bev action, not a code change** —
  noted so it's on the radar.

## Out of scope

- About / meet-the-maker page.
- Dedicated delivery/shipping-info page (Terms references delivery as shown at
  checkout; no new page).
- Contact form / any form handler.
- Cookie-consent banner (essential cookies only — not required).
- Any change to the storefront, checkout, admin, emails, or data model.

## Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds. (No unit-test runner —
  project convention.)
- Browser preview: all five routes render, match the design system, and read
  well on **desktop + mobile**; every **footer link** navigates correctly; the
  `mailto:` opens a compose to `orders@`; the Instagram link points to
  `instagram.com/blg.creations`.
- Confirm the home page and existing pages are visually unchanged (footer now
  carries the nav row).
- No push without Andrew's say-so; confirm Vercel READY after deploy, per the
  usual workflow.
