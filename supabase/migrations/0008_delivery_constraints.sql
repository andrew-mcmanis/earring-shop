-- 0008_delivery_constraints.sql
-- DB-level backstops for order fulfilment, added before Phase 2 introduces a
-- second writer (the Stripe webhook): only the two known methods are allowed,
-- and a delivery order must carry an address. placeOrder already enforces both
-- in the app; these catch any other write path at the database.
-- (drop + add keeps re-runs safe — ADD CONSTRAINT has no IF NOT EXISTS.)

alter table orders drop constraint if exists orders_fulfilment_method_check;
alter table orders add constraint orders_fulfilment_method_check
  check (fulfilment_method in ('delivery', 'pickup'));

alter table orders drop constraint if exists orders_delivery_address_check;
alter table orders add constraint orders_delivery_address_check
  check (fulfilment_method = 'pickup' or address is not null);
