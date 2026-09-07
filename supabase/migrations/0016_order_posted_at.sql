-- 0016_order_posted_at.sql
-- The delayed review email now fires 5 days after an order is marked *posted*
-- (the "sent" flag), not 5 days after payment. Record when an order is first
-- marked posted so the cron can key off it.
-- Run this once in the Supabase SQL editor.

alter table orders
  add column if not exists posted_at timestamptz;
