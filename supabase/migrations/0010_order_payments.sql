-- 0010_order_payments.sql
-- Phase 2: card payment. Payment status is tracked SEPARATELY from the
-- fulfilment status (new/made/posted) — an order can be paid but not yet made.
-- The payment_intent.succeeded webhook is the source of truth for these.

alter table orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  add column if not exists stripe_payment_intent text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_payment_intent_idx on orders (stripe_payment_intent);
