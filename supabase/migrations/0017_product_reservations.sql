-- 0017_product_reservations.sql
-- Prevent overselling one-of-a-kind items: a checkout claims a short, self-
-- expiring hold on each item so a second buyer can't pay for the same piece.
-- Run this once in the Supabase SQL editor.

alter table products
  add column if not exists reserved_until timestamptz,
  add column if not exists reserved_by text;

-- Atomically claim a product for a checkout token. Succeeds (returns true) only
-- if it's not sold out and either unheld, its hold has expired, or it's already
-- held by this same token (so a buyer can re-claim/extend across edit + retry).
create or replace function claim_product(p_id uuid, p_token text, p_minutes int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  update products
     set reserved_until = now() + make_interval(mins => p_minutes),
         reserved_by = p_token
   where id = p_id
     and sold_out = false
     and (reserved_until is null or reserved_until < now() or reserved_by = p_token)
   returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;
grant execute on function claim_product(uuid, text, int) to service_role;
