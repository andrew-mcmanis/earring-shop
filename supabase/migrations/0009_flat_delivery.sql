-- 0009_flat_delivery.sql
-- Delivery moves from a per-category rate to a single flat base price: the
-- first item pays the full base, each additional item pays 50% (computed in
-- app/lib/shipping.ts). The base lives on the private settings row.

alter table settings add column if not exists delivery_base numeric(10,2) not null default 0;

-- The per-category rate is replaced by the single flat price above.
alter table categories drop column if exists delivery_charge;
