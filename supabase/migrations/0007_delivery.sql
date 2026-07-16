-- 0007_delivery.sql
-- Per-category delivery charge, a private single-row pickup settings table,
-- and order fulfilment fields.

-- Per-category delivery rate (public, part of categories).
alter table categories add column if not exists delivery_charge numeric(10,2) not null default 0;

-- Private shop settings (pickup address/note). Single row (id always true).
create table if not exists settings (
  id             boolean primary key default true check (id),
  pickup_address text,
  pickup_note    text,
  updated_at     timestamptz not null default now()
);
insert into settings (id) values (true) on conflict (id) do nothing;

alter table settings enable row level security;
create policy "admin read settings"  on settings for select using (auth.role() = 'authenticated');
create policy "admin write settings" on settings for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Deliberately NOT granted to anon: the pickup address is never publicly readable.
grant select, insert, update on settings to authenticated;
grant all on settings to service_role;

-- Order fulfilment.
alter table orders add column if not exists fulfilment_method text not null default 'delivery';
alter table orders add column if not exists shipping numeric(10,2) not null default 0;
-- Pickup orders have no delivery address.
alter table orders alter column address drop not null;
