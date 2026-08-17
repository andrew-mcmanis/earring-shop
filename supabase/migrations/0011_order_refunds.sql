-- 0011_order_refunds.sql
-- Record refunds synced from Stripe's charge.refunded webhook. payment_status
-- already allows 'refunded' (migration 0010); we only add the amount refunded
-- and when. Both nullable — set on the first refund.

alter table orders
  add column if not exists refunded_amount numeric(10,2),
  add column if not exists refunded_at timestamptz;
