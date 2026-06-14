-- Adds a "sold out" flag: keeps a product on display but un-orderable.
-- Distinct from `visible` (which hides it entirely). Run once in the
-- Supabase SQL editor.

alter table products
  add column if not exists sold_out boolean not null default false;

create index if not exists products_sold_out_idx on products(sold_out);
