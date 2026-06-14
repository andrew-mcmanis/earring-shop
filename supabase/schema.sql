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
  sold_out         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_category_idx on products(category_slug);
create index if not exists products_visible_idx  on products(visible);
create index if not exists products_sold_out_idx on products(sold_out);

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

grant usage on schema public to anon, authenticated, service_role;

-- Public storefront can read labels + products
grant select on categories, subcategories, colours, products to anon, authenticated;

-- The signed-in owner (admin) can manage everything
grant insert, update, delete on categories, subcategories, colours, products to authenticated;

-- Server-side (service role) full access — needed for server tasks (e.g. orders)
grant all on categories, subcategories, colours, products to service_role;
-- Orders received from the storefront checkout.
-- Run this once in the Supabase SQL editor.

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   bigint generated always as identity,
  customer_name  text not null,
  customer_email text not null,
  customer_phone text,
  address        text not null,
  city           text,
  postcode       text,
  country        text not null default 'United Kingdom',
  notes          text,
  subtotal       numeric(10,2) not null default 0,
  status         text not null default 'new',  -- new | made | posted | cancelled
  created_at     timestamptz not null default now()
);

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,          -- snapshot, survives product edits/deletes
  unit_price numeric(10,2) not null default 0,
  quantity   int not null default 1
);

create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists orders_created_idx on orders(created_at desc);

-- ============================================================
-- Row Level Security
--   • Customers never read orders.
--   • Checkout inserts via the service role (bypasses RLS).
--   • The signed-in owner (admin) reads orders and updates status.
-- ============================================================
alter table orders      enable row level security;
alter table order_items enable row level security;

create policy "admin read orders"     on orders      for select using (auth.role() = 'authenticated');
create policy "admin update orders"   on orders      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin read order_items" on order_items for select using (auth.role() = 'authenticated');

-- Grants ("automatically expose new tables" is off, so grant explicitly)
grant select, update on orders to authenticated;
grant select on order_items to authenticated;
grant all on orders to service_role;
grant all on order_items to service_role;
grant usage, select on all sequences in schema public to service_role;
