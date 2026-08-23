# Customer Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers submit star-rated reviews (via a link in their order confirmation email), hold them unapproved until the owner approves them in the admin, and show approved ones as a shop-wide testimonials strip on the homepage.

**Architecture:** A new `reviews` table whose RLS exposes only `approved = true` rows to the public (anon key), while the owner (authenticated) sees all. Submissions are written server-side via the service role as `approved = false` (no raw public insert), rate-limited by the existing `check_rate_limit` RPC. The homepage reads approved reviews (empty list on any failure — never fabricated), and a new admin page approves/edits/deletes them.

**Tech Stack:** Next.js 16 (App Router, `searchParams` as a Promise), React 19 (`useActionState`), TypeScript, Supabase (Postgres + RLS), Resend (email). No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus a dev-server walkthrough.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify each task with `npx tsc --noEmit` and, where noted, `npm run build`. End-to-end behaviour is verified on the dev server in the final task.
- **Commits are LOCAL only.** Work is on branch `feat/customer-reviews` (already checked out, rebased on current `main`). **Do not push** — the owner pushes/merges after review.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **This feature degrades safely if migration `0014` hasn't run yet.** Nothing existing references the `reviews` table, and every read path returns `[]` on error, so a code-ahead-of-migration window only means "submissions fail / no reviews shown" — it never breaks checkout or the storefront. Still, the owner runs `0014` around deploy time (Task 8) so submissions work.
- **Never render fabricated reviews.** Unlike the products data layer, the reviews reader does **not** fall back to sample data — on missing config or any error it returns an empty list so the live site never shows fake testimonials (UK fake-review law + trust). This is a deliberate deviation from the spec's "sample fallback" line.
- Reuse existing patterns: the `str()` form helper + `check_rate_limit` throttle (from `app/lib/orders.ts`), the `requireUser()` admin gate (`app/lib/admin-auth.ts`), the `revalidatePath('/')` publish pattern, and the brand tokens/`Field` styling.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0014_reviews.sql` | Create | `reviews` table + indexes + RLS + grants |
| `supabase/schema.sql` | Modify | Mirror the `reviews` block (repo convention) |
| `app/data/types.ts` | Modify | `Review` interface |
| `app/data/reviews.ts` | Create | `ReviewRow`, `mapReview`, `getApprovedReviews` (empty on failure) |
| `app/lib/reviews.ts` | Create | `submitReview` server action (validate, rate-limit, service-role insert unapproved) |
| `app/reviews/new/ReviewForm.tsx` | Create | Client form: star picker + name + body, success state |
| `app/reviews/new/page.tsx` | Create | Server page: reads `?ref`, renders chrome + form |
| `app/lib/email.ts` | Modify | "Leave a review" invite block in the buyer confirmation |
| `app/components/Testimonials.tsx` | Create | Homepage strip: aggregate + cards (null when empty) |
| `app/page.tsx` | Modify | Fetch approved reviews + render `<Testimonials>` |
| `app/admin/reviews/queries.ts` | Create | `adminGetReviews` (all rows, pending first) |
| `app/admin/reviews/actions.ts` | Create | `setReviewApproved`, `updateReview`, `deleteReview` |
| `app/admin/reviews/ReviewModerationItem.tsx` | Create | Client row: approve/hide, edit, delete |
| `app/admin/reviews/page.tsx` | Create | Moderation list (pending + approved sections) |
| `app/admin/page.tsx` | Modify | "Reviews" dashboard card (the admin nav pattern; spec's "AdminHeader" line predates reading the actual nav) |

---

## Task 1: Migration + schema mirror + `Review` type

SQL isn't type-checked; verify by review. The `Review` type change is checked by `tsc`.

**Files:**
- Create: `supabase/migrations/0014_reviews.sql`
- Modify: `supabase/schema.sql`
- Modify: `app/data/types.ts`

- [ ] **Step 1: Create `supabase/migrations/0014_reviews.sql`**

```sql
-- 0014_reviews.sql
-- Shop-level customer reviews. Submitted via the storefront (service-role write,
-- unapproved by default) and shown publicly only once the owner approves.
-- Run this once in the Supabase SQL editor.

create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  rating          int  not null check (rating between 1 and 5),
  body            text not null,
  reviewer_name   text not null,
  order_reference text,                 -- from the email link (e.g. BLG-123); loose authenticity signal
  product_name    text,                 -- optional snapshot; unused in v1 submission
  approved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists reviews_approved_idx on reviews(approved);
create index if not exists reviews_created_idx  on reviews(created_at desc);

-- ============================================================
-- Row Level Security
--   • Public may read ONLY approved reviews.
--   • The signed-in owner (admin) reads all + moderates.
--   • Submissions are inserted via the service role (bypasses RLS).
-- ============================================================
alter table reviews enable row level security;

create policy "public read approved reviews" on reviews for select using (approved = true);
create policy "admin read reviews"           on reviews for select using (auth.role() = 'authenticated');
create policy "admin update reviews"         on reviews for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete reviews"         on reviews for delete using (auth.role() = 'authenticated');

-- Grants ("automatically expose new tables" is off, so grant explicitly).
-- No insert grant to anon/authenticated — submissions go through the service role.
grant select on reviews to anon, authenticated;   -- RLS restricts anon to approved rows
grant update, delete on reviews to authenticated;  -- moderation
grant all on reviews to service_role;              -- storefront submission writes here
```

- [ ] **Step 2: Mirror the `reviews` block at the end of `supabase/schema.sql`**

Find (the last two lines of the file):

```sql
grant all on rate_limits to service_role;
grant execute on function check_rate_limit(text, int, int) to service_role;
```

Replace with:

```sql
grant all on rate_limits to service_role;
grant execute on function check_rate_limit(text, int, int) to service_role;

-- ============================================================
-- Customer reviews. Public reads only approved rows (RLS); the owner moderates;
-- submissions are inserted via the service role as approved=false.
-- ============================================================
create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  rating          int  not null check (rating between 1 and 5),
  body            text not null,
  reviewer_name   text not null,
  order_reference text,
  product_name    text,
  approved        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists reviews_approved_idx on reviews(approved);
create index if not exists reviews_created_idx  on reviews(created_at desc);

alter table reviews enable row level security;
create policy "public read approved reviews" on reviews for select using (approved = true);
create policy "admin read reviews"           on reviews for select using (auth.role() = 'authenticated');
create policy "admin update reviews"         on reviews for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete reviews"         on reviews for delete using (auth.role() = 'authenticated');
grant select on reviews to anon, authenticated;
grant update, delete on reviews to authenticated;
grant all on reviews to service_role;
```

- [ ] **Step 3: Add the `Review` interface to `app/data/types.ts`**

Find:

```ts
  items: OrderItem[];
}

export interface Product {
```

Replace with:

```ts
  items: OrderItem[];
}

export interface Review {
  id: string;
  /** 1–5. */
  rating: number;
  body: string;
  reviewerName: string;
  /** Order reference the review came from (e.g. "BLG-123"); null if none. */
  orderReference: string | null;
  /** Optional snapshot of the item bought; unused in v1 submission. */
  productName: string | null;
  approved: boolean;
  createdAt: string;
}

export interface Product {
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_reviews.sql supabase/schema.sql app/data/types.ts
git commit -m "Add migration 0014: reviews table + Review type

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Reviews data layer (public read)

Reads approved reviews with the anon client (RLS also enforces approved-only). Returns an empty list on missing config or any error — never fabricated reviews.

**Files:**
- Create: `app/data/reviews.ts`

- [ ] **Step 1: Create `app/data/reviews.ts`**

```ts
// Data-access for customer reviews. Public reads return only APPROVED reviews
// (Row Level Security enforces this for the anon key too). On any failure — or
// when Supabase isn't configured — this returns an EMPTY list, never fabricated
// reviews, so the storefront degrades to "no reviews" rather than showing fakes.

import type { Review } from './types';
import { isSupabaseConfigured, createReadClient } from '../lib/supabase';

export interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  reviewer_name: string;
  order_reference: string | null;
  product_name: string | null;
  approved: boolean;
  created_at: string;
}

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    reviewerName: row.reviewer_name,
    orderReference: row.order_reference ?? null,
    productName: row.product_name ?? null,
    approved: row.approved,
    createdAt: row.created_at,
  };
}

export async function getApprovedReviews(limit = 12): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createReadClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) {
      console.warn('[data] reviews query failed, hiding reviews:', error?.message);
      return [];
    }
    return (data as ReviewRow[]).map(mapReview);
  } catch (e) {
    console.warn('[data] reviews query threw, hiding reviews:', e);
    return [];
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (exports are unused until later tasks — that's fine).

- [ ] **Step 3: Commit**

```bash
git add app/data/reviews.ts
git commit -m "Add reviews data layer (approved-only, empty on failure)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Submission server action

Validates, throttles by IP (reusing `check_rate_limit`), and inserts an unapproved review via the service role. Self-contained (its own `getClientIp`/throttle) so the live checkout path in `orders.ts` is not touched.

**Files:**
- Create: `app/lib/reviews.ts`

- [ ] **Step 1: Create `app/lib/reviews.ts`**

```ts
'use server';

import { headers } from 'next/headers';
import { createServiceClient } from './supabase';

export interface ReviewFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

const NAME_MAX = 80;
const BODY_MAX = 1000;

// Public-submission throttle: at most this many submissions per IP per window.
const REVIEW_RATE_LIMIT = 5;
const REVIEW_RATE_WINDOW_S = 600; // 10 minutes

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return h.get('x-real-ip');
}

// Durable per-IP throttle via the shared check_rate_limit RPC. Fail-open: any
// missing config / limiter error returns false so a real customer is never
// blocked over infrastructure.
async function isRateLimited(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const ip = await getClientIp();
  if (!ip) return false;
  try {
    const { data: allowed, error } = await createServiceClient().rpc('check_rate_limit', {
      p_key: `review:${ip}`,
      p_limit: REVIEW_RATE_LIMIT,
      p_window_seconds: REVIEW_RATE_WINDOW_S,
    });
    if (error) {
      console.error('[review] rate-limit check failed (allowing):', error.message);
      return false;
    }
    return allowed === false;
  } catch (e) {
    console.error('[review] rate-limit check threw (allowing):', e);
    return false;
  }
}

export async function submitReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  if (await isRateLimited()) {
    return {
      status: 'error',
      message: 'Too many submissions in a short time — please wait a little and try again.',
    };
  }

  const reviewerName = str(formData, 'reviewer_name');
  const body = str(formData, 'body');
  const ratingRaw = str(formData, 'rating');
  const rating = Math.floor(Number(ratingRaw));
  const orderReference = str(formData, 'ref') || null;

  const fieldErrors: Record<string, string> = {};
  if (!reviewerName) fieldErrors.reviewer_name = 'Please enter your name.';
  else if (reviewerName.length > NAME_MAX) fieldErrors.reviewer_name = `Please keep your name under ${NAME_MAX} characters.`;
  if (!ratingRaw || !Number.isInteger(rating) || rating < 1 || rating > 5) fieldErrors.rating = 'Please choose a star rating.';
  if (!body) fieldErrors.body = 'Please write a few words.';
  else if (body.length > BODY_MAX) fieldErrors.body = `Please keep your review under ${BODY_MAX} characters.`;

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors };
  }

  // No DB configured (dev/demo) — accept without persisting so the form still works.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[review] DB not configured — review received but not saved:', { reviewerName, rating });
    return { status: 'success' };
  }

  try {
    const { error } = await createServiceClient().from('reviews').insert({
      rating,
      body,
      reviewer_name: reviewerName,
      order_reference: orderReference,
      approved: false,
    });
    if (error) throw error;
    return { status: 'success' };
  } catch (err) {
    console.error('[review] failed to save submission:', err);
    return {
      status: 'error',
      message: 'Sorry, something went wrong saving your review — please try again in a moment.',
    };
  }
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add app/lib/reviews.ts
git commit -m "Add review submission action (rate-limited, unapproved insert)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Review submission page + form

A client form with an accessible star picker, driven by `useActionState(submitReview)`, wrapped in a server page that reads `?ref`.

**Files:**
- Create: `app/reviews/new/ReviewForm.tsx`
- Create: `app/reviews/new/page.tsx`

- [ ] **Step 1: Create `app/reviews/new/ReviewForm.tsx`**

```tsx
'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { submitReview, type ReviewFormState } from '../../lib/reviews';

const initialState: ReviewFormState = { status: 'idle' };

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-7 w-7 ${filled ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
    </svg>
  );
}

function StarPicker({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-body text-sm font-medium text-ink">
        Your rating<span className="text-kraft-dark"> *</span>
      </span>
      <input type="hidden" name="rating" value={value || ''} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <Star filled={n <= active} />
          </button>
        ))}
      </div>
      {error && <p className="font-body text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function ReviewForm({ orderReference }: { orderReference: string | null }) {
  const [state, formAction, isPending] = useActionState(submitReview, initialState);
  const [rating, setRating] = useState(0);

  if (state.status === 'success') {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <h2 className="font-heading text-3xl font-bold text-ink">Thank you!</h2>
        <p className="font-body text-sm text-ink-light max-w-sm">
          Your review has been received. We read every one — it&apos;ll appear on the site once approved.
        </p>
        <Link
          href="/"
          className="mt-2 bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {orderReference && <input type="hidden" name="ref" value={orderReference} />}

      {state.status === 'error' && state.message && (
        <div role="alert" className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">
          {state.message}
        </div>
      )}

      <StarPicker value={rating} onChange={setRating} error={state.fieldErrors?.rating} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reviewer_name" className="font-body text-sm font-medium text-ink">
          Your name<span className="text-kraft-dark"> *</span>
        </label>
        <input
          id="reviewer_name"
          name="reviewer_name"
          type="text"
          maxLength={80}
          autoComplete="name"
          aria-invalid={state.fieldErrors?.reviewer_name ? true : undefined}
          className={`font-body text-sm text-ink bg-white border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft ${
            state.fieldErrors?.reviewer_name ? 'border-red-500' : 'border-kraft-light focus:border-kraft'
          }`}
        />
        {state.fieldErrors?.reviewer_name && (
          <p className="font-body text-xs text-red-600" role="alert">{state.fieldErrors.reviewer_name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="font-body text-sm font-medium text-ink">
          Your review<span className="text-kraft-dark"> *</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={1000}
          placeholder="What did you love? How was it packaged? Would you buy again?"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className={`font-body text-sm text-ink bg-white border rounded px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-kraft ${
            state.fieldErrors?.body ? 'border-red-500' : 'border-kraft-light focus:border-kraft'
          }`}
        />
        {state.fieldErrors?.body && (
          <p className="font-body text-xs text-red-600" role="alert">{state.fieldErrors.body}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Submit review'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/reviews/new/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ReviewForm } from './ReviewForm';

export const metadata: Metadata = {
  title: 'Leave a review',
  robots: { index: false }, // submission page — keep out of search
};

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <>
      <Header />
      <div className="max-w-xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink mb-2">Leave a review</h1>
        <p className="font-body text-base text-ink-light mb-8">
          {ref ? `Thanks for order ${ref}. ` : ''}We&apos;d love to hear what you thought.
        </p>
        <ReviewForm orderReference={ref ?? null} />
      </div>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/reviews/new` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add app/reviews/new/ReviewForm.tsx app/reviews/new/page.tsx
git commit -m "Add /reviews/new submission page + star-rating form

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Confirmation-email review invite

Adds a "Leave a review" block to the **buyer** confirmation only (never the owner alert), linking to `/reviews/new?ref=<reference>`.

**Files:**
- Modify: `app/lib/email.ts`

- [ ] **Step 1: Add the `reviewInviteBlock` helper**

In `app/lib/email.ts`, find the `followBlock` function:

```ts
function followBlock(): string {
```

Insert this function immediately **before** it:

```ts
function reviewInviteBlock(reference: string): string {
  const url = `${SITE_URL}/reviews/new?ref=${encodeURIComponent(reference)}`;
  return `
    ${label('Enjoyed your order?')}
    <p style="margin:0 0 14px;font-family:${SERIF};font-size:15px;line-height:1.6;color:${BODY};">A few words from you help other customers find us &mdash; and they always make our day. It only takes a minute.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${KRAFT}" style="border-radius:6px;">
      <a href="${url}" style="display:inline-block;padding:11px 22px;font-family:${SERIF};font-size:14px;font-weight:bold;color:${CREAM};text-decoration:none;">Leave a review</a>
    </td></tr></table>`;
}

```

- [ ] **Step 2: Add the block to the buyer email**

In `customerHtml`, find:

```ts
  const inner = [
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
    followBlock(),
  ].join(gap());
```

Replace with:

```ts
  const inner = [
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
    reviewInviteBlock(data.reference),
    followBlock(),
  ].join(gap());
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`SITE_URL`, `SERIF`, `BODY`, `KRAFT`, `CREAM`, `label`, `gap` are all already in scope in this file.)

- [ ] **Step 4: Commit**

```bash
git add app/lib/email.ts
git commit -m "Emails: invite the buyer to leave a review

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Homepage testimonials strip

A server component that renders approved reviews (aggregate + cards), or nothing when the list is empty. Reviewer shown as first name + last initial for privacy.

**Files:**
- Create: `app/components/Testimonials.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/components/Testimonials.tsx`**

```tsx
import type { Review } from '../data/types';

// Display a reviewer as first name + last initial for privacy ("Jane D.").
function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`h-4 w-4 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

export function Testimonials({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section aria-label="Customer reviews" className="bg-cream-dark border-t border-kraft-light/50">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col items-center text-center gap-2 mb-8">
          <h2 className="font-heading text-4xl font-bold text-ink">Loved by customers</h2>
          <p className="font-body text-sm text-ink-light inline-flex items-center gap-2">
            <Stars rating={Math.round(avg)} />
            <span className="tabular-nums">
              {avg.toFixed(1)} from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </span>
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-3">
              <Stars rating={r.rating} />
              <p className="font-body text-sm text-ink leading-relaxed flex-1 whitespace-pre-line">{r.body}</p>
              <p className="font-body text-xs font-medium text-ink-light">
                {displayName(r.reviewerName)}
                {r.productName ? <span className="text-ink-light"> · {r.productName}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Import the reviews reader + component in `app/page.tsx`**

Find:

```tsx
import { getProducts, getCategories, getSubcategories, getColours } from './data/products';
```

Replace with:

```tsx
import { getProducts, getCategories, getSubcategories, getColours } from './data/products';
import { getApprovedReviews } from './data/reviews';
import { Testimonials } from './components/Testimonials';
```

- [ ] **Step 3: Fetch approved reviews in `app/page.tsx`**

Find:

```tsx
  const [products, categories, subcategories, colours] = await Promise.all([
    getProducts(),
    getCategories(),
    getSubcategories(),
    getColours(),
  ]);
```

Replace with:

```tsx
  const [products, categories, subcategories, colours, reviews] = await Promise.all([
    getProducts(),
    getCategories(),
    getSubcategories(),
    getColours(),
    getApprovedReviews(),
  ]);
```

- [ ] **Step 4: Render the strip before the footer in `app/page.tsx`**

Find:

```tsx
      <ShopContent
        products={products}
        categories={categories}
        subcategories={subcategories}
        colours={colours}
      />

      <Footer />
```

Replace with:

```tsx
      <ShopContent
        products={products}
        categories={categories}
        subcategories={subcategories}
        colours={colours}
      />

      <Testimonials reviews={reviews} />

      <Footer />
```

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; the homepage still prerenders.

- [ ] **Step 6: Commit**

```bash
git add app/components/Testimonials.tsx app/page.tsx
git commit -m "Homepage: shop-wide testimonials strip (approved reviews)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Admin moderation

A moderation page (pending first, then approved) with approve/hide, inline edit, and delete — plus a dashboard card to reach it.

**Files:**
- Create: `app/admin/reviews/queries.ts`
- Create: `app/admin/reviews/actions.ts`
- Create: `app/admin/reviews/ReviewModerationItem.tsx`
- Create: `app/admin/reviews/page.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create `app/admin/reviews/queries.ts`**

```ts
import { createServerSupabase } from '../../lib/supabase-server';
import { mapReview, type ReviewRow } from '../../data/reviews';
import type { Review } from '../../data/types';

// All reviews for moderation (pending first, then newest). Uses the signed-in
// admin client, whose RLS policy ("admin read reviews") returns every row.
export async function adminGetReviews(): Promise<Review[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('approved', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as ReviewRow[]).map(mapReview);
}
```

- [ ] **Step 2: Create `app/admin/reviews/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '../../lib/admin-auth';

export async function setReviewApproved(id: string, approved: boolean): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('reviews').update({ approved }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}

export async function updateReview(
  id: string,
  fields: { rating: number; reviewerName: string; body: string },
): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const rating = Math.floor(Number(fields.rating));
  const reviewerName = fields.reviewerName.trim();
  const body = fields.body.trim();
  if (!reviewerName || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Name, a 1–5 rating and review text are all required.' };
  }
  const { error } = await supabase
    .from('reviews')
    .update({ reviewer_name: reviewerName, body, rating })
    .eq('id', id);
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}

export async function deleteReview(id: string): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return { error: `Could not delete: ${error.message}` };
  revalidatePath('/');
  revalidatePath('/admin/reviews');
  return {};
}
```

- [ ] **Step 3: Create `app/admin/reviews/ReviewModerationItem.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { Review } from '../../data/types';
import { setReviewApproved, updateReview, deleteReview } from './actions';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`h-4 w-4 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

export function ReviewModerationItem({ review }: { review: Review }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(review.reviewerName);
  const [body, setBody] = useState(review.body);
  const [rating, setRating] = useState(review.rating);

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  }

  return (
    <li className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <Stars rating={review.rating} />
          <p className="font-body text-sm font-medium text-ink">
            {review.reviewerName}
            {review.orderReference ? (
              <span className="text-ink-light font-normal"> · {review.orderReference}</span>
            ) : (
              <span className="text-amber-600 font-normal"> · no order ref</span>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${
            review.approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${review.approved ? 'bg-green-600' : 'bg-amber-500'}`} aria-hidden="true" />
          {review.approved ? 'Approved' : 'Pending'}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className="cursor-pointer p-0.5">
                <svg viewBox="0 0 24 24" className={`h-6 w-6 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
                  <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
                </svg>
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="Reviewer name"
            className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kraft"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-label="Review text"
            className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-kraft"
          />
        </div>
      ) : (
        <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-line">{review.body}</p>
      )}

      {error && <p role="alert" className="font-body text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-cream-dark pt-3">
        {editing ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => updateReview(review.id, { rating, reviewerName: name, body }))}
              className="cursor-pointer font-body text-xs font-semibold text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setEditing(false);
                setName(review.reviewerName);
                setBody(review.body);
                setRating(review.rating);
              }}
              className="cursor-pointer font-body text-xs text-ink-light hover:text-kraft"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => setReviewApproved(review.id, !review.approved))}
              className="cursor-pointer font-body text-xs font-medium text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60"
            >
              {review.approved ? 'Hide' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setEditing(true)}
              className="cursor-pointer font-body text-xs text-ink-light hover:text-kraft disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (confirm('Delete this review permanently?')) run(() => deleteReview(review.id));
              }}
              className="cursor-pointer font-body text-xs text-red-600 hover:text-red-700 disabled:opacity-60 ml-auto"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Create `app/admin/reviews/page.tsx`**

```tsx
import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { adminGetReviews } from './queries';
import { ReviewModerationItem } from './ReviewModerationItem';

export const metadata = { title: 'Reviews · Admin' };

export default async function AdminReviewsPage() {
  const reviews = await adminGetReviews();
  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  return (
    <div className="min-h-dvh bg-cream">
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/admin"
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5 mb-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>
        <h1 className="font-heading text-4xl font-bold text-ink mb-6">Reviews</h1>

        {reviews.length === 0 ? (
          <div className="bg-white border border-cream-dark rounded-lg flex flex-col items-center text-center gap-3 py-16 px-6">
            <h2 className="font-heading text-2xl font-bold text-kraft-light">No reviews yet</h2>
            <p className="font-body text-sm text-ink-light max-w-xs">
              When a customer leaves a review, it&apos;ll appear here for you to approve.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-2xl font-bold text-ink">
                Pending{pending.length > 0 ? ` (${pending.length})` : ''}
              </h2>
              {pending.length === 0 ? (
                <p className="font-body text-sm text-ink-light">Nothing waiting — you&apos;re all caught up.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {pending.map((r) => (
                    <ReviewModerationItem key={r.id} review={r} />
                  ))}
                </ul>
              )}
            </section>

            {approved.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-heading text-2xl font-bold text-ink">Approved ({approved.length})</h2>
                <ul className="flex flex-col gap-4">
                  {approved.map((r) => (
                    <ReviewModerationItem key={r.id} review={r} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add a "Reviews" card to the admin dashboard `app/admin/page.tsx`**

Find:

```tsx
          <Link
            href="/admin/delivery"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Delivery</h3>
            <p className="font-body text-sm text-ink-light mt-1">Set delivery price & collection.</p>
          </Link>
        </div>
```

Replace with:

```tsx
          <Link
            href="/admin/delivery"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Delivery</h3>
            <p className="font-body text-sm text-ink-light mt-1">Set delivery price & collection.</p>
          </Link>

          <Link
            href="/admin/reviews"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Reviews</h3>
            <p className="font-body text-sm text-ink-light mt-1">Approve customer reviews.</p>
          </Link>
        </div>
```

- [ ] **Step 6: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/admin/reviews` appears in the route list.

- [ ] **Step 7: Commit**

```bash
git add app/admin/reviews/queries.ts app/admin/reviews/actions.ts app/admin/reviews/ReviewModerationItem.tsx app/admin/reviews/page.tsx app/admin/page.tsx
git commit -m "Admin: reviews moderation (approve/hide, edit, delete) + dashboard card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification + owner ops

No new code. Gates the feature and documents the owner steps. Because the storefront degrades safely without the table, the migration can be applied just before deploy — but it **must** be applied for submissions/moderation to work against the DB.

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds; `/reviews/new` and `/admin/reviews` both in the route list.

- [ ] **Step 2: Owner op — apply the migration**

In **Supabase → SQL Editor**, run the contents of `supabase/migrations/0014_reviews.sql` (creates the `reviews` table + RLS + grants). Safe to run before deploy; needed before submissions persist.

- [ ] **Step 3: Dev-server end-to-end (after the migration is applied)**

Start the dev server (`npm run dev`). Then:
- Visit `/reviews/new?ref=BLG-test`, pick a rating, fill name + review, submit → the "Thank you!" state shows.
- Sign in to `/admin` → open **Reviews** → the submission is in **Pending** with "· BLG-test"; the homepage does **not** show it yet.
- Click **Approve** → reload the homepage (`/`) → the review now appears in the "Loved by customers" strip with the correct star count and "First L." name, and the aggregate reflects it.
- Click **Edit** on a review, change the text, **Save** → the change shows; **Delete** a test review (confirm) → it disappears from admin and homepage.
- Submit with a blank rating/name/body → inline field errors show and nothing is saved.

- [ ] **Step 4: RLS spot-check (optional but recommended)**

Confirm an anonymous read only returns approved rows — e.g. from the Supabase SQL editor run `set role anon; select count(*) from reviews;` and verify it counts only approved rows (reset with `reset role;`). Pending reviews must never be anon-readable.

- [ ] **Step 5: Report status (do NOT push)**

Summarize tsc/build results and the dev-server walkthrough. The owner applies migration `0014`, then merges `feat/customer-reviews` to `main` (which deploys) after review. Note: the email invite only reaches customers on **real paid orders** (the confirmation email is sent by the Stripe webhook), so the very first live invite appears on the next order.

## Out of scope (from the spec)

Per-product reviews / product-page ratings · verified-purchase tokens (loose ref + moderation instead) · review photos, replies, helpful-votes · customer self-editing after submit · scheduled reminder emails · a dedicated `/reviews` listing page · a pending-count badge on the dashboard (the Reviews page shows the pending count itself).

## Notes / deviations from the spec (deliberate)

- **No fabricated fallback:** `getApprovedReviews` returns `[]` (not sample data) on missing config or error — the live site must never show fake reviews.
- **Admin entry via a dashboard card** (`app/admin/page.tsx`), not `AdminHeader` — that's the actual admin navigation pattern (Products/Orders/Labels/Delivery are dashboard cards).
- **`product_name`** is kept in the schema/type and shown when present, but is **not** populated at submission in v1 (the email link carries only the order ref, which can cover multiple items).
