-- 0015_review_invites.sql
-- Support the delayed + manual "leave a review" email:
--   review_invite_sent_at — when a review email was actually sent (cron or button)
--   auto_review_invite     — whether the automatic job may email this order
-- Existing orders are handled manually (the button), so the automatic job skips
-- them: backfill auto_review_invite=false. New orders default true.
-- Run this once in the Supabase SQL editor.

alter table orders
  add column if not exists review_invite_sent_at timestamptz,
  add column if not exists auto_review_invite boolean not null default true;

update orders set auto_review_invite = false;
