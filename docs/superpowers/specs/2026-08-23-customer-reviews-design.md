# Customer reviews — design

_Date: 2026-08-23_

## Problem

The shop has no reviews / social proof. Bev asked to "add customer reviews."

The critical constraint: **products are one-of-a-kind.** `createOrderAndIntent`
forces every order line to quantity 1, and a product auto-flips to `sold_out` the
moment it sells; relisting/duplicating makes a *new* product with a new id. So
reviews **cannot accumulate on a product** and a per-product review would be seen
by almost nobody (the item is sold seconds later). Reviews here must be
**shop-level social proof about the maker**, not per-product ratings.

The site is also **LIVE and taking real card payments**, and UK law (DMCC Act)
now penalises fake/undisclosed reviews. So reviews must be genuine and Bev must
control what's published — but we want real customers' words, not just quotes she
types herself.

## Decisions (confirmed with the owner)

- **Customer-submitted, owner-approved ("between curated and full post-purchase
  invite").** After a paid order, the confirmation email invites feedback; the
  customer submits via a simple form; the review is **unapproved by default** and
  Bev approves it in the admin before it shows. This gives genuine customer
  voices with full editorial control and no fake-review risk. (Rejected:
  owner-typed-only testimonials — loses authenticity. Rejected: hardened
  per-order verified tokens — more machinery than needed; moderation + a loose
  order-reference tie is enough.)
- **Star ratings (1–5), not text-only.** Enables an aggregate ("4.9 ★ from N
  reviews") that converts well.
- **Displayed shop-wide on the homepage, not on product pages** — for the
  one-of-a-kind reason above.
- **No raw public insert.** Submissions are written **server-side via the service
  role** (like checkout), gated by the existing rate limiter. Anon can only ever
  *read approved* reviews (enforced by RLS).

## Data model — migration `0014_reviews.sql`

_(Next free migration after the gift feature; adjust the number to the next free
one at implementation time.)_

```sql
-- 0014_reviews.sql
-- Shop-level customer reviews. Submitted via the storefront (service-role write,
-- unapproved by default) and shown publicly only once the owner approves.

create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  rating          int  not null check (rating between 1 and 5),
  body            text not null,
  reviewer_name   text not null,
  order_reference text,                 -- from the email link (e.g. BLG-123); loose authenticity signal
  product_name    text,                 -- snapshot of what they bought, if known
  approved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists reviews_approved_idx on reviews(approved);
create index if not exists reviews_created_idx  on reviews(created_at desc);

alter table reviews enable row level security;

-- Public may read ONLY approved reviews; the owner (authenticated) reads all.
create policy "public read approved reviews" on reviews for select using (approved = true);
create policy "admin read reviews"           on reviews for select using (auth.role() = 'authenticated');
create policy "admin update reviews"         on reviews for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete reviews"         on reviews for delete using (auth.role() = 'authenticated');

-- Grants ("automatically expose new tables" is off, so grant explicitly).
grant select on reviews to anon, authenticated;   -- RLS above restricts anon to approved rows
grant update, delete on reviews to authenticated;  -- moderation
grant all on reviews to service_role;              -- storefront submission writes here
```

- Mirror the whole table + policies in `supabase/schema.sql` (repo convention).
- **Owner runs `0014` by hand in the Supabase SQL editor before deploying.**
- Types (`app/data/types.ts`): add `Review { id; rating; body; reviewerName;
  orderReference: string | null; productName: string | null; approved; createdAt }`.

## Submission flow

1. **Invite in the confirmation email** — `app/lib/email.ts`, `customerHtml`
   only (never the owner email). Add a "We'd love your feedback" block linking to
   `${SITE_URL}/reviews/new?ref=<reference>` (the `BLG-###` already in scope).
   This rides the existing paid-order confirmation, so only genuine paying
   customers are invited.
2. **Form page** — new `app/reviews/new/page.tsx`: fields for name, a 1–5 star
   picker, and the review body; the order reference is read from `?ref` and
   carried through (hidden). Styled with the existing brand tokens.
3. **Server action** — new `app/lib/reviews.ts` (`'use server'`), `submitReview`,
   mirroring `orders.ts` conventions:
   - reuse the `str()` / `getClientIp()` helpers' approach and the durable rate
     limiter `check_rate_limit` (key `review:<ip>`, sensible small limit) so the
     public write can't be spammed;
   - validate: `rating` in 1–5, `reviewer_name` non-empty (cap ~80 chars),
     `body` non-empty (cap ~1000 chars); trim; `order_reference` optional;
   - insert via `createServiceClient()` with `approved = false`;
   - return a success/thank-you state.
4. **Thank-you state** — after submit: "Thanks — your review will appear once
   approved." No account, no login.

## Display — homepage

- New data accessor in `app/data/` (e.g. `getApprovedReviews(limit)`) using the
  read client (`approved = true`, newest first), with a sample-data fallback for
  the no-DB/dev path (mirrors how `products.ts` degrades).
- A **testimonials strip** on the homepage (rendered from `app/page.tsx` /
  `app/components/ShopContent.tsx`): each card shows the star rating, the body,
  the reviewer as **first name + last initial** (privacy — format on display; no
  email/PII ever shown), and the product name if present.
- An **aggregate** line — "4.9 ★ from N reviews" — derived from the approved set.
- If there are no approved reviews yet, the strip renders nothing (no empty
  state).
- Rendered through React (auto-escaped); **no `dangerouslySetInnerHTML`** for
  review content.

## Admin moderation — `app/admin/reviews/`

- New `app/admin/reviews/page.tsx` listing all reviews (pending first), gated by
  `requireUser()` like the other admin pages.
- Per review: an **Approve/Hide** capsule toggle (reuse the `ApproveToggle` shape
  of [VisibilityToggle.tsx](app/admin/products/VisibilityToggle.tsx)), **Edit**
  (fix a typo / trim), and **Delete** (spam). Actions in
  `app/admin/reviews/actions.ts`, gated by `requireUser()`, calling
  `revalidatePath('/')` and `'/admin/reviews'` so approving publishes immediately.
- Add a **Reviews** link to `app/admin/AdminHeader.tsx`; a pending-count badge is
  a nice-to-have (optional).

## Anti-abuse & trust

- `approved = false` by default; **RLS makes unapproved reviews unreadable by
  anon** — they can't leak even via the public API.
- Rate-limited submission (reuses `check_rate_limit`).
- Length caps + rating CHECK constraint.
- `order_reference` recorded so Bev has a loose authenticity signal in
  moderation (submissions with no ref are still allowed but visibly flagged).
- React escaping prevents stored-XSS in the review body.

## Out of scope (deliberately)

- Per-product reviews / star ratings on product pages (one-of-a-kind).
- Verified-purchase enforcement via secure per-order tokens (loose ref + owner
  moderation instead).
- Review photos, replies/threads, helpful-votes.
- Customer editing/deleting their own review after submit.
- Scheduled follow-up reminder emails (the invite rides the existing single
  confirmation email only).
- A dedicated `/reviews` listing page (homepage strip for v1; easy to add later).

## Edge cases

- **Submission with no `ref`:** allowed; stored with `order_reference = null` and
  flagged "no order ref" in the admin list.
- **Duplicate / spam submissions:** rate limiter throttles; Bev deletes
  duplicates in moderation.
- **Empty or over-long input:** rejected by validation (server) + CHECK (rating).
- **No approved reviews yet:** homepage strip and aggregate are hidden.
- **XSS attempt in body/name:** stored as text, escaped on render.
- **Unapproved review requested directly via the anon API:** RLS returns nothing.
- **Homepage caching:** approving calls `revalidatePath('/')` so a newly approved
  review appears without a redeploy.

## Verification

- `tsc` clean; `npm run build` succeeds. (No unit-test runner — project
  convention.)
- **End-to-end in dev:** submit a review via `/reviews/new?ref=BLG-123` → it
  appears in `/admin/reviews` as **pending** and is **absent** from the homepage;
  approve it → it appears on the homepage and the aggregate updates; delete a
  test review → it disappears.
- **RLS check:** confirm an anon read of `reviews` returns only approved rows.
- **Rate limit:** rapid repeat submissions are throttled.
- Owner: run migration `0014` in Supabase, then deploy; place a test-mode order
  and confirm the confirmation email carries the feedback link.
