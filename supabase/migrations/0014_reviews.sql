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
