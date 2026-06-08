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
