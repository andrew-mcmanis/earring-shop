-- BLG Creations — database schema
-- Run this once in the Supabase SQL editor (see SETUP.md), then seed.sql.

-- ============================================================
-- Label tables (data-driven so the owner can add new ones)
-- ============================================================

create table if not exists categories (
  slug           text primary key,
  name           text not null,
  sort_order     int  not null default 0
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
  image_url        text,                              -- null = show placeholder (legacy single photo; synced to image_urls[1])
  image_urls       text[] not null default '{}',      -- ordered gallery; image_urls[1] = main photo
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
  address        text,                          -- null for pickup orders
  city           text,
  postcode       text,
  recipient_name text,                          -- gift orders: who it's addressed to
  country        text not null default 'United Kingdom',
  notes          text,
  subtotal       numeric(10,2) not null default 0,
  shipping       numeric(10,2) not null default 0,
  fulfilment_method text not null default 'delivery'
                 check (fulfilment_method in ('delivery', 'pickup')),
  is_gift        boolean not null default false, -- posted to someone other than the buyer
  status         text not null default 'new',  -- new | made | posted | cancelled
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid', 'paid', 'refunded')),
  stripe_payment_intent text,
  paid_at        timestamptz,
  refunded_amount numeric(10,2),
  refunded_at    timestamptz,
  review_invite_sent_at timestamptz,             -- set when a review email is sent
  auto_review_invite boolean not null default true, -- automatic job may email this order
  created_at     timestamptz not null default now(),
  -- A delivery order must carry an address (pickup orders store null).
  check (fulfilment_method = 'pickup' or address is not null),
  -- A gift is always a delivery with a named recipient + address.
  check (is_gift = false or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null))
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
create index if not exists orders_payment_intent_idx on orders (stripe_payment_intent);

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

-- ============================================================
-- Private shop settings (pickup address/note). Not readable by anon.
-- ============================================================
create table if not exists settings (
  id             boolean primary key default true check (id),
  delivery_base  numeric(10,2) not null default 0,  -- flat delivery: 1st item full, extras 50%
  pickup_address text,
  pickup_note    text,
  updated_at     timestamptz not null default now()
);
insert into settings (id) values (true) on conflict (id) do nothing;
alter table settings enable row level security;
create policy "admin read settings"  on settings for select using (auth.role() = 'authenticated');
create policy "admin write settings" on settings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
grant select, insert, update on settings to authenticated;
grant all on settings to service_role;

-- ============================================================
-- Rate limiting (checkout throttle). Durable per-key counters; touched only by
-- the service role via check_rate_limit(). Not readable by anon/authenticated.
-- ============================================================
create table if not exists rate_limits (
  key          text primary key,          -- e.g. 'checkout:<ip>'
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;

-- Atomic fixed-window limiter: true = allowed (count within window <= p_limit),
-- false = blocked.
create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else rate_limits.window_start
      end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
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
