# Content Pages (Returns / Care / Contact / Privacy / Terms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish five static customer-facing content pages — Returns Policy, Jewellery Care, Contact, Privacy Policy, Terms & Conditions — plus a footer nav linking them, completing go-live checklist item #1.

**Architecture:** A Next.js App Router route group `app/(content)/` supplies one shared layout (Header + centered reading column + Footer) for all five static Server-Component pages. A small `<Prose>` wrapper backed by a bespoke `.prose-blg` CSS block in `globals.css` provides consistent typography from the existing design tokens (no `@tailwindcss/typography` dependency). The home page is outside the group and is unchanged.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19, TypeScript, Tailwind CSS v4. No test runner (project convention) — verification is `npx tsc --noEmit` + `npm run build` + browser preview.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner.** Per `AGENTS.md` + project memory: *"Verify = `npx tsc --noEmit` + `npm run build` (+ browser). NO unit-test runner — never add one."* Every task verifies with `tsc`, and routable pages additionally get a browser check.
- **Commits are LOCAL only.** Commit after each task. **Do not push** — pushing to `main` auto-deploys to production. Andrew pushes manually after the full verification pass and his review.
- Commit-message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Next.js caveat (`AGENTS.md`):** "This is NOT the Next.js you know." Route groups + nested layouts + the `metadata` export are standard App Router, but sanity-check against `node_modules/next/dist/docs/` before writing the layout in Task 2 if anything behaves unexpectedly.
- Design guardrails: kraft `#B5865A` / cream `#FDF8F0` / ink `#1A1A1A`; `font-heading` (Amatic SC) headings, `font-body` (Cabin) body; no glassmorphism/backdrop-blur; minimal shadows; **no `rounded-full` on controls**; plain, accurate copy.

## File Structure

| File | Responsibility |
|---|---|
| `app/globals.css` (modify) | Add the `.prose-blg` typography block used by all content pages |
| `app/components/Prose.tsx` (create) | Thin wrapper `<div class="prose-blg">` for page body copy |
| `app/(content)/layout.tsx` (create) | Shared chrome: Header + centered `<main>` reading column + Footer |
| `app/(content)/returns/page.tsx` (create) | Returns Policy content |
| `app/(content)/jewellery-care/page.tsx` (create) | Jewellery Care: 4 icon cards + sign-off |
| `app/(content)/contact/page.tsx` (create) | Contact: email + Instagram, no form |
| `app/(content)/privacy/page.tsx` (create) | Privacy Policy draft (sole trader) |
| `app/(content)/terms/page.tsx` (create) | Terms & Conditions draft (sole trader) |
| `app/components/Footer.tsx` (modify) | Add footer nav row linking the five pages |

---

## Task 1: Prose typography (`.prose-blg` CSS + `Prose` wrapper)

**Files:**
- Modify: `app/globals.css` (append after the existing rules, at end of file)
- Create: `app/components/Prose.tsx`

- [ ] **Step 1: Append the `.prose-blg` block to `app/globals.css`**

Add at the very end of the file (after the `@media (prefers-reduced-motion…)` block):

```css

/* Reading typography for the static content pages (returns, care, contact,
   privacy, terms). Applied via the <Prose> wrapper so each page writes plain
   semantic markup. Bespoke on purpose — no typography plugin, to keep the
   handmade look and avoid a dependency. Element selectors are used, so DON'T
   fight them with utility classes inside <Prose>; use the .lead helper. */
.prose-blg {
  font-family: var(--font-body);
  color: var(--ink-light);
  line-height: 1.7;
}
.prose-blg > :first-child {
  margin-top: 0;
}
.prose-blg h1 {
  font-family: var(--font-heading);
  font-weight: 700;
  color: var(--ink);
  font-size: clamp(2.75rem, 6vw, 3.75rem);
  line-height: 0.95;
  margin: 0 0 1.5rem;
}
.prose-blg h2 {
  font-family: var(--font-heading);
  font-weight: 700;
  color: var(--ink);
  font-size: clamp(1.9rem, 4vw, 2.35rem);
  line-height: 1;
  margin: 2.5rem 0 0.75rem;
}
.prose-blg p {
  margin: 1rem 0;
}
.prose-blg .lead {
  font-size: 1.125rem;
  color: var(--ink-light);
}
.prose-blg a {
  color: var(--kraft-dark);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}
.prose-blg a:hover {
  color: var(--kraft);
}
.prose-blg ul,
.prose-blg ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}
.prose-blg ul {
  list-style: disc;
}
.prose-blg ol {
  list-style: decimal;
}
.prose-blg li {
  margin: 0.4rem 0;
  padding-left: 0.25rem;
}
.prose-blg li::marker {
  color: var(--kraft);
}
.prose-blg strong {
  color: var(--ink);
  font-weight: 600;
}
```

- [ ] **Step 2: Create `app/components/Prose.tsx`**

```tsx
import type { ReactNode } from 'react';

// Consistent reading typography for the static content pages. Styling lives in
// the `.prose-blg` block in globals.css and is applied to semantic descendants
// (h1/h2/p/ul/ol/a/strong), so pages just write plain markup inside <Prose>.
export function Prose({ children }: { children: ReactNode }) {
  return <div className="prose-blg">{children}</div>;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/components/Prose.tsx
git commit -m "Add Prose wrapper + .prose-blg typography for content pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Shared content layout + Returns page

First routable page — proves the layout, Prose, and footer pinning render correctly.

**Files:**
- Create: `app/(content)/layout.tsx`
- Create: `app/(content)/returns/page.tsx`

- [ ] **Step 1: Create `app/(content)/layout.tsx`**

```tsx
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

// Shared chrome for the static content pages under app/(content). Renders the
// Header, a centered reading column, and the Footer once; each page supplies
// only its own body. The home page is outside this group and unaffected.
// CartProvider (root layout) uses a Context.Provider with no DOM element, so
// Header/main/Footer are direct flex children of <body> (flex flex-col) —
// `flex-1` on <main> keeps the footer pinned to the bottom on short pages.
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 reveal">
        {children}
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Create `app/(content)/returns/page.tsx`**

Bev's returns document, reproduced near-verbatim:

```tsx
import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';

export const metadata: Metadata = {
  title: 'Returns Policy',
};

export default function ReturnsPage() {
  return (
    <Prose>
      <h1>Returns Policy</h1>
      <p className="lead">
        At BLG Creations, every item is handmade with care, including polymer
        clay earrings, bookmarks and gifts. We hope you love your order, but if
        something is not quite right, please read the policy below and get in
        touch so we can help.
      </p>

      <h2>Change-of-Mind Returns</h2>
      <p>
        If you have changed your mind about a non-personalised item, please
        contact us within 14 days of receiving your order. Once you have told us
        you would like to return an eligible item, it should be sent back to us
        within a further 14 days.
      </p>
      <p>
        Returned items must be unused, unworn, in their original condition and,
        where applicable, in their original packaging. We reserve the right to
        reduce or refuse a refund if an item is returned used, damaged,
        incomplete or not in a resaleable condition.
      </p>

      <h2>Items That Cannot Be Returned Unless Faulty</h2>
      <p>
        For hygiene reasons, pierced earrings cannot be returned once they have
        been opened, tried on or worn, unless they are faulty. Personalised,
        customised or made-to-order items also cannot be returned for a change
        of mind unless they arrive faulty, damaged or not as described.
      </p>

      <h2>Faulty, Damaged or Incorrect Items</h2>
      <p>
        If your order arrives faulty, damaged or incorrect, please contact us as
        soon as possible with your order details and clear photographs of the
        issue. We will review the problem and, where appropriate, offer a
        replacement, repair, refund or another suitable solution.
      </p>
      <p>
        Please do not return a faulty or damaged item before contacting us, as
        we may need photographs or further details to resolve the matter
        quickly.
      </p>

      <h2>Return Postage</h2>
      <p>
        For change-of-mind returns, customers are responsible for the cost of
        return postage. We recommend using a tracked or proof-of-postage
        service, as we cannot be responsible for items that are lost or damaged
        on their way back to us.
      </p>
      <p>
        If an item is confirmed to be faulty, damaged or incorrect, we will
        discuss the most appropriate return or replacement arrangement with you.
      </p>

      <h2>Refunds</h2>
      <p>
        Once we receive and inspect an eligible returned item, we will let you
        know whether the refund has been approved. Approved refunds will be
        processed using the original payment method. Please allow time for your
        bank or payment provider to process the refund.
      </p>
      <p>
        Where a refund is due for a change-of-mind return, the original standard
        delivery cost will be refunded where required by law. Any upgraded,
        express or premium delivery charges may not be refunded beyond the
        standard delivery amount.
      </p>

      <h2>How to Request a Return</h2>
      <ol>
        <li>
          Contact BLG Creations via{' '}
          <a href="mailto:orders@blgcreations.co.uk">
            orders@blgcreations.co.uk
          </a>{' '}
          within the relevant timeframe with your order number and reason for
          return.
        </li>
        <li>Wait for confirmation before sending anything back.</li>
        <li>
          Pack the item securely and return it in its original condition and
          packaging where possible.
        </li>
        <li>
          Keep proof of postage until your return has been received and
          resolved.
        </li>
      </ol>

      <h2>Questions</h2>
      <p>
        If you have any questions about your order or this returns policy,
        please contact BLG Creations before making a return. We are always happy
        to help. You can reach us at{' '}
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>
        .
      </p>
    </Prose>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Browser check**

Start the dev server (`npm run dev`) and open `http://localhost:3000/returns`.
Expected:
- The site Header (logo + cart) shows at top; the Footer shows at the bottom of the viewport (pinned even though the page is short-ish).
- The heading "Returns Policy" renders in the Amatic SC display font; section headings (`h2`) are Amatic SC; body is Cabin.
- The numbered "How to Request a Return" list shows 1–4 with kraft markers.
- The two `orders@blgcreations.co.uk` links are kraft and underlined; clicking opens a mail compose.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(content)/layout.tsx" "app/(content)/returns/page.tsx"
git commit -m "Add content route-group layout + Returns Policy page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Jewellery Care page

Four care tips as icon cards + the "thank you / follow us" sign-off. The tips grid sits **outside** `<Prose>` (it's a styled grid, not prose), so it sets its own `list-none pl-0`.

**Files:**
- Create: `app/(content)/jewellery-care/page.tsx`

- [ ] **Step 1: Create `app/(content)/jewellery-care/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';

export const metadata: Metadata = {
  title: 'Jewellery Care',
};

type IconProps = { className?: string };

// Simple hand-drawn line icons (24x24, stroke = currentColor) matching the
// cart icon's line style. They echo the printed care card without any icon
// library.
function SprayIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 8h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
      <path d="M9 8V5h3" />
      <path d="M12 5V3" />
      <path d="M4 4h2M4 6.5h2.5M4 9h2" />
    </svg>
  );
}

function BoxIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5Z" />
      <path d="M3 5h18v3.5H3z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function DropIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5c3.2 3.4 5 6 5 8.6a5 5 0 0 1-10 0c0-2.6 1.8-5.2 5-8.6Z" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z" />
    </svg>
  );
}

const tips: { Icon: (props: IconProps) => React.ReactElement; text: string }[] = [
  {
    Icon: SprayIcon,
    text: 'Avoid sprays or lotions near any jewellery as they can cause tarnishing.',
  },
  {
    Icon: BoxIcon,
    text: 'Keep jewellery stored separately from other pieces, in a cool, dark place using jewellery boxes & pouches.',
  },
  {
    Icon: DropIcon,
    text: 'Keep jewellery from getting wet. Remove before bathing or swimming.',
  },
  {
    Icon: MoonIcon,
    text: 'Remove jewellery before going to bed to prevent accidents in your sleep.',
  },
];

export default function JewelleryCarePage() {
  return (
    <>
      <Prose>
        <h1>Jewellery Care</h1>
        <p className="lead">
          Each BLG Creations piece is handmade to last. A little care keeps your
          earrings, bookmarks and gifts looking their best for years to come.
        </p>
      </Prose>

      <ul className="mt-8 grid list-none grid-cols-1 gap-4 pl-0 sm:grid-cols-2">
        {tips.map(({ Icon, text }) => (
          <li
            key={text}
            className="border border-kraft-light bg-cream-dark p-5 sm:p-6"
          >
            <Icon className="h-8 w-8 text-kraft" />
            <p className="mt-3 font-body text-base leading-relaxed text-ink-light">
              {text}
            </p>
          </li>
        ))}
      </ul>

      <Prose>
        <p className="mt-10">Thank you so much for your purchase!</p>
        <p>
          Follow us on Instagram at{' '}
          <a
            href="https://instagram.com/blg.creations"
            target="_blank"
            rel="noopener noreferrer"
          >
            @BLG.Creations
          </a>{' '}
          for more beautiful designs.
        </p>
      </Prose>
    </>
  );
}
```

Note: `mt-10` on the sign-off `<p>` is a utility on a `<p>` that IS matched by `.prose-blg p` (margin: 1rem 0). `.prose-blg p` has higher specificity, so the visible top gap will be `.prose-blg`'s 1rem, not `2.5rem`. This is acceptable (the tips grid already provides separation). Do **not** rely on the `mt-10` for spacing; if more space is wanted, add it on the wrapping `<Prose>`'s parent or accept the default.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Browser check**

With the dev server running, open `http://localhost:3000/jewellery-care`.
Expected:
- Title + lead paragraph, then a 2-column (1-column on mobile) grid of four cards, each with a kraft line icon above its tip text.
- Cards have a `kraft-light` border on a `cream-dark` fill.
- Below the grid: "Thank you so much for your purchase!" and the Instagram line, with `@BLG.Creations` linking to `instagram.com/blg.creations` (opens in a new tab).
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(content)/jewellery-care/page.tsx"
git commit -m "Add Jewellery Care page (care tips + Instagram)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Contact page

**Files:**
- Create: `app/(content)/contact/page.tsx`

- [ ] **Step 1: Create `app/(content)/contact/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';

export const metadata: Metadata = {
  title: 'Contact',
};

export default function ContactPage() {
  return (
    <Prose>
      <h1>Get in Touch</h1>
      <p className="lead">
        Have a question about an order, a piece, or a custom request? We would
        love to hear from you — the best way to reach us is by email.
      </p>

      <h2>Email</h2>
      <p>
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>
        <br />
        We aim to reply within a couple of days. Please include your order
        number if your message is about an existing order.
      </p>

      <h2>Instagram</h2>
      <p>
        Follow{' '}
        <a
          href="https://instagram.com/blg.creations"
          target="_blank"
          rel="noopener noreferrer"
        >
          @BLG.Creations
        </a>{' '}
        for new designs, works in progress and updates.
      </p>

      <h2>Before You Write</h2>
      <p>
        Looking for our returns process or jewellery care advice? You may find
        the answer on our <a href="/returns">Returns Policy</a> or{' '}
        <a href="/jewellery-care">Jewellery Care</a> pages.
      </p>
    </Prose>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Browser check**

Open `http://localhost:3000/contact`.
Expected:
- "Get in Touch" heading + lead, then Email / Instagram / Before You Write sections.
- `orders@blgcreations.co.uk` is a working `mailto:` link; `@BLG.Creations` links to Instagram (new tab); the "Returns Policy" and "Jewellery Care" links navigate to `/returns` and `/jewellery-care`.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(content)/contact/page.tsx"
git commit -m "Add Contact page (email + Instagram, no form)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Privacy Policy page (draft)

Draft for Andrew + Bev to review. Assumptions are documented in a JSX comment at the top (stripped from the rendered HTML, visible in source).

**Files:**
- Create: `app/(content)/privacy/page.tsx`

- [ ] **Step 1: Create `app/(content)/privacy/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <Prose>
      {/* REVIEW BEFORE GO-LIVE — assumptions in this draft, confirm with Bev:
          1. Trading status: sole trader, "Bev Gallifant trading as BLG
             Creations". Confirm the exact legal/trading name.
          2. ICO registration: a sole trader processing customer data online
             likely must register with the ICO (~£40/yr). Bev to action — not a
             code change.
          3. Set "Last updated" to the actual publish date at go-live.
          Remove this comment once confirmed. */}
      <h1>Privacy Policy</h1>
      <p className="lead">Last updated: 16 August 2026</p>
      <p>
        This policy explains how BLG Creations handles the personal information
        you provide when you visit or buy from blgcreations.co.uk. We only
        collect what we need to process your order, and we never sell your
        information.
      </p>

      <h2>Who We Are</h2>
      <p>
        BLG Creations is a small handmade jewellery and gifts business run by
        Bev Gallifant as a sole trader. We are the &ldquo;data controller&rdquo;
        for the information described here. For any privacy question, or to
        exercise your rights below, contact us at{' '}
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>
        .
      </p>

      <h2>What We Collect</h2>
      <ul>
        <li>
          Your name and email address, and — for deliveries — your postal
          address and, if you provide it, your phone number.
        </li>
        <li>Details of the items you order and your order history with us.</li>
        <li>Any messages you send us by email.</li>
      </ul>
      <p>
        You provide this information yourself when you place an order or contact
        us.
      </p>

      <h2>Payment</h2>
      <p>
        Card payments are handled securely by our payment provider, Stripe. Your
        full card details are entered directly with Stripe — BLG Creations never
        sees or stores your card number.
      </p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>
          To take payment for and fulfil your order, and to send you order
          confirmations and updates.
        </li>
        <li>To respond to your questions and provide customer support.</li>
        <li>To keep the records we must keep for tax and accounting.</li>
      </ul>
      <p>
        Our lawful basis is performing our contract with you when you place an
        order, together with our legitimate interest in running the shop and
        replying to enquiries.
      </p>

      <h2>Who We Share It With</h2>
      <p>
        We share your information only with the service providers that help us
        run the shop, and only so they can perform their service:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — to process card payments.
        </li>
        <li>
          <strong>Resend</strong> — to send your order confirmation emails.
        </li>
        <li>
          <strong>Vercel</strong> — to host the website.
        </li>
        <li>
          <strong>Supabase</strong> — to store order records securely.
        </li>
      </ul>
      <p>
        We do not sell your personal information or use it for third-party
        advertising.
      </p>

      <h2>Cookies</h2>
      <p>
        Our site uses only essential cookies needed to remember your shopping
        basket while you browse. We use privacy-friendly, cookieless analytics
        to understand general site usage, so there is no advertising or tracking
        cookie for you to consent to.
      </p>

      <h2>How Long We Keep It</h2>
      <p>
        We keep order records for as long as we need them to complete your order
        and to meet our legal and accounting obligations, after which they are
        deleted or anonymised.
      </p>

      <h2>Your Rights</h2>
      <p>
        You have the right to ask us for a copy of the information we hold about
        you, to correct it if it is wrong, or to ask us to delete it where we
        are not required to keep it. To make a request, email{' '}
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>
        .
      </p>
      <p>
        If you are unhappy with how we have handled your information, you can
        complain to the UK&rsquo;s data protection regulator, the Information
        Commissioner&rsquo;s Office, at{' '}
        <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">
          ico.org.uk
        </a>
        .
      </p>
    </Prose>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Browser check**

Open `http://localhost:3000/privacy`.
Expected:
- Full policy renders with all sections; the review comment does **not** appear in the page (confirm via View Source that it is absent from the served HTML — JSX comments are compiled away).
- Both `orders@` links work; the `ico.org.uk` link opens in a new tab.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(content)/privacy/page.tsx"
git commit -m "Add Privacy Policy draft (sole trader) for review

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Terms & Conditions page (draft)

**Files:**
- Create: `app/(content)/terms/page.tsx`

- [ ] **Step 1: Create `app/(content)/terms/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
};

export default function TermsPage() {
  return (
    <Prose>
      {/* REVIEW BEFORE GO-LIVE — assumptions in this draft, confirm with Bev:
          1. Trading status: sole trader, "Bev Gallifant trading as BLG
             Creations". Confirm the exact legal/trading name.
          2. VAT: drafted as NOT VAT-registered (no VAT added to prices).
             Confirm — change the "Prices and Payment" wording if registered.
          3. Governing law: drafted as England & Wales. Change if Bev trades
             from Scotland or Northern Ireland.
          4. Set "Last updated" to the actual publish date at go-live.
          Remove this comment once confirmed. */}
      <h1>Terms &amp; Conditions</h1>
      <p className="lead">Last updated: 16 August 2026</p>
      <p>
        These terms apply when you buy from BLG Creations at blgcreations.co.uk.
        BLG Creations is run by Bev Gallifant as a sole trader. Please read them
        alongside our <a href="/privacy">Privacy Policy</a> and{' '}
        <a href="/returns">Returns Policy</a>.
      </p>

      <h2>Our Products</h2>
      <p>
        Every item is handmade, often from polymer clay. Because pieces are made
        by hand, small variations in colour, shape, pattern and size are natural
        and are part of their character, not a fault. Photographs are as
        accurate as we can make them, but colours may appear slightly different
        from one screen to another.
      </p>

      <h2>Ordering</h2>
      <p>
        When you place an order and payment is successful, you are offering to
        buy the items in your basket. A contract is formed once we confirm your
        order by email. Occasionally we may be unable to fulfil an order (for
        example, if an item is no longer available) — if that happens we will
        contact you and arrange a full refund.
      </p>

      <h2>Prices and Payment</h2>
      <p>
        Prices are shown in pounds sterling (GBP) and are the price you pay; no
        VAT is added. Payment is taken securely at checkout by card via Stripe.
        Any delivery charge is shown before you pay.
      </p>

      <h2>Delivery</h2>
      <p>
        We post to addresses within the United Kingdom. Delivery options and any
        charges are shown at checkout. We aim to dispatch promptly, but as
        pieces are handmade, please allow a little time for your order to be
        prepared. Any delivery timescales are estimates.
      </p>

      <h2>Cancellations and Returns</h2>
      <p>
        You have the right to cancel or return eligible items as set out in our{' '}
        <a href="/returns">Returns Policy</a>, which forms part of these terms.
        Some items — such as pierced earrings that have been worn, and
        personalised or made-to-order pieces — cannot be returned for a change
        of mind unless faulty, as explained there.
      </p>

      <h2>Faulty Items</h2>
      <p>
        If something arrives faulty, damaged or not as described, you have
        rights under the Consumer Rights Act 2015, including the right to a
        repair, replacement or refund. Please contact us at{' '}
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>{' '}
        with your order details and photographs so we can put things right.
      </p>

      <h2>Our Responsibility to You</h2>
      <p>
        We take care to describe and make our products accurately. We are
        responsible for foreseeable loss caused by us failing to meet these
        terms, but we are not responsible for loss that is not foreseeable or
        that arises from circumstances beyond our reasonable control. Nothing in
        these terms affects your statutory rights as a consumer.
      </p>

      <h2>Governing Law</h2>
      <p>
        These terms are governed by the law of England and Wales, and any
        disputes will be subject to the courts of England and Wales. This does
        not affect your statutory rights.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email us at{' '}
        <a href="mailto:orders@blgcreations.co.uk">
          orders@blgcreations.co.uk
        </a>
        .
      </p>
    </Prose>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Browser check**

Open `http://localhost:3000/terms`.
Expected:
- Full terms render with all sections; the review comment is absent from the served HTML.
- Internal links (`/privacy`, `/returns`) navigate correctly; the `orders@` links work.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(content)/terms/page.tsx"
git commit -m "Add Terms & Conditions draft (sole trader) for review

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Footer navigation

Add a link row to the footer so all five pages are reachable site-wide. Keep the existing brand block, copyright, and "Sign in".

**Files:**
- Modify: `app/components/Footer.tsx`

- [ ] **Step 1: Replace the contents of `app/components/Footer.tsx`**

Full new file (the nav row is inserted between the tagline and the copyright):

```tsx
import Link from 'next/link';

const footerLinks = [
  { href: '/returns', label: 'Returns' },
  { href: '/jewellery-care', label: 'Jewellery Care' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-cream-dark py-10 px-4 text-center">
      <p className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</p>
      <p className="font-body text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-ink-light mt-1.5">
        Handmade Jewellery &amp; Gifts
      </p>

      <nav
        aria-label="Footer"
        className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-body text-xs"
      >
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="py-1 text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="font-body text-xs text-ink-light mt-5">
        © {new Date().getFullYear()} BLG Creations · All rights reserved
        <span aria-hidden="true"> · </span>
        <Link
          href="/admin/login"
          className="inline-block py-1 -my-1 text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150"
        >
          Sign in
        </Link>
      </p>
    </footer>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Browser check**

With the dev server running, open the home page `http://localhost:3000/` and scroll to the footer.
Expected:
- Below the tagline, a centered, wrapping row of links: **Returns · Jewellery Care · Contact · Privacy · Terms**, kraft on hover with underline.
- The copyright line and "Sign in" link are unchanged, below the nav.
- Click each footer link and confirm it lands on the right page. Confirm the same footer now appears on all five content pages.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/Footer.tsx
git commit -m "Add footer nav linking Returns/Care/Contact/Privacy/Terms

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification pass

No new files — this is the whole-feature gate before handing back to Andrew for review + push.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors. Confirm the five new routes appear in the build output as static (`/returns`, `/jewellery-care`, `/contact`, `/privacy`, `/terms`).

- [ ] **Step 2: Desktop browser pass**

With `npm run dev` running, visit each of `/`, `/returns`, `/jewellery-care`, `/contact`, `/privacy`, `/terms`. Confirm:
- Consistent Header/Footer on every content page; footer nav present site-wide.
- Every footer link and in-page cross-link resolves; `mailto:` links target `orders@blgcreations.co.uk`; both Instagram links point to `instagram.com/blg.creations` and open in a new tab.
- No console errors on any page.

- [ ] **Step 3: Mobile pass**

Resize the viewport to a mobile width (e.g. 375px) and re-check `/jewellery-care` (cards stack to one column), `/returns`, and the footer nav (wraps cleanly, remains centered and tappable). Confirm no horizontal overflow on any page.

- [ ] **Step 4: Regression check on the home page**

Confirm the home page looks exactly as before **except** for the new footer nav row — hero, product grid, and cart all unchanged.

- [ ] **Step 5: Report status to Andrew (do NOT push)**

Summarize: `tsc` clean, `npm run build` green, browser passes done. Then hand off the two review items below. Andrew pushes to `main` (which deploys) after he's satisfied.

---

## Before go-live — confirm with Bev (not code changes)

These are tracked in the design spec's "Open items" and flagged in JSX comments in the Privacy/Terms pages. Resolve before the shop takes **real** payments:

1. **Legal/trading name** — confirm "Bev Gallifant trading as BLG Creations" (or correct it) in `privacy/page.tsx` and `terms/page.tsx`.
2. **VAT status** — Terms currently says "no VAT is added." Confirm Bev is not VAT-registered; if she is, reword.
3. **Governing law** — Terms says England & Wales. Change if Bev trades from Scotland/NI.
4. **ICO registration** — Bev likely needs to register as a data controller with the ICO (~£40/yr). Action for Bev.
5. **"Last updated" dates** — set to the actual publish date on both legal pages at go-live.

Once confirmed, remove the `REVIEW BEFORE GO-LIVE` JSX comments from `privacy/page.tsx` and `terms/page.tsx`.

## Out of scope (unchanged from spec)

About / meet-the-maker page · dedicated delivery-info page · contact form · cookie-consent banner · any change to storefront, checkout, admin, emails, or data model.
