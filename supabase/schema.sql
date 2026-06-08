-- BLG Creations — database schema
-- Run this once in the Supabase SQL editor (see SETUP.md), then seed.sql.

-- ============================================================
-- Label tables (data-driven so the owner can add new ones)
-- ============================================================

create table if not exists categories (
  slug        text primary key,
  name        text not null,
  sort_order  int  not null default 0
);

create table if not exists subcategories (
  slug          text primary key,
  name          text not null,
  category_slug text not null references categories(slug) on delete cascade,
  sort_order    int  not null default 0
);

create table if not exists colours (
  slug text primary key,
  name text not null,
  hex  text not null default ''   -- empty = special "multicolour" swatch
);

-- ============================================================
-- Products
-- ============================================================

create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text not null default '',
  price            numeric(10,2) not null default 0,
  category_slug    text not null references categories(slug) on delete restrict,
  subcategory_slug text references subcategories(slug) on delete set null,
  colour_slug      text references colours(slug) on delete set null,
  accent_color     text not null default '#B5865A',  -- placeholder tint
  image_url        text,                              -- null = show placeholder
  visible          boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_category_idx on products(category_slug);
create index if not exists products_visible_idx  on products(visible);

-- ============================================================
-- Row Level Security
--   • Anyone may READ labels + visible products (public storefront).
--   • Only signed-in users (the owner) may write (admin area).
-- ============================================================

alter table categories    enable row level security;
alter table subcategories enable row level security;
alter table colours       enable row level security;
alter table products      enable row level security;

-- Public read
create policy "public read categories"    on categories    for select using (true);
create policy "public read subcategories" on subcategories for select using (true);
create policy "public read colours"       on colours       for select using (true);
create policy "public read products"      on products      for select using (true);

-- Authenticated write (single-admin model — only the owner has an account)
create policy "admin write categories"    on categories    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write subcategories" on subcategories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write colours"       on colours       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write products"      on products      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- Table privileges for the Data API roles
--   Needed because the project has "automatically expose new tables" OFF.
--   RLS (above) still governs which rows each role may touch.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Public storefront can read labels + products
grant select on categories, subcategories, colours, products to anon, authenticated;

-- The signed-in owner (admin) can manage everything
grant insert, update, delete on categories, subcategories, colours, products to authenticated;
