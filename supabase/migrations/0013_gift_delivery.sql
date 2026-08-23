-- 0013_gift_delivery.sql
-- Gift orders: posted to someone other than the buyer. The existing address
-- columns hold the RECIPIENT's address; recipient_name is who it's addressed to.
-- A gift is always a delivery (never pickup). The app enforces this too; this is
-- the DB backstop for any other write path.
-- (drop + add keeps re-runs safe — ADD CONSTRAINT has no IF NOT EXISTS.)

alter table orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists recipient_name text;

alter table orders drop constraint if exists orders_gift_requires_recipient;
alter table orders add constraint orders_gift_requires_recipient
  check (
    is_gift = false
    or (fulfilment_method = 'delivery' and recipient_name is not null and address is not null)
  );
