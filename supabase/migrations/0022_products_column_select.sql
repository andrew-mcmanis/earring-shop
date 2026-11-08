-- 0022_products_column_select.sql
-- Stop the Data API roles reading the checkout hold token.
--
-- products.reserved_by holds the buyer's checkout token; anyone who can read it
-- can share that buyer's hold. anon/authenticated had table-level SELECT, so
-- every column was readable. A column-level REVOKE does nothing while the
-- table-level grant exists, so the table grant is removed and only the columns
-- the storefront and admin read are granted back. reserved_until, reserved_by,
-- created_at and updated_at stay readable by service_role and the owner only.
--
-- The app must read products with an explicit column list (PRODUCT_COLUMNS in
-- app/data/products.ts) before this runs: select('*') is denied as a whole.
-- A new product column the storefront needs must be added to that list AND
-- granted here in a later migration.
--
-- The live database gets this change through the guarded, single-transaction
-- release script (SEC-04-D41 r2), not by replaying this file.

revoke select on table public.products from public, anon, authenticated;
grant select (id, name, description, price, category_slug, subcategory_slug,
              colour_slug, accent_color, image_url, image_urls, visible,
              sold_out, sort_order)
  on table public.products to anon, authenticated;

do $check$
declare
  r text;
  c text;
begin
  foreach r in array array['public', 'anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.products', 'SELECT') then
      raise exception '0022: % still has table-level SELECT on products', r;
    end if;
    foreach c in array array['reserved_by', 'reserved_until', 'created_at', 'updated_at'] loop
      if has_column_privilege(r, 'public.products', c, 'SELECT') then
        raise exception '0022: % can still SELECT products.%', r, c;
      end if;
    end loop;
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    foreach c in array array['id','name','description','price','category_slug','subcategory_slug',
                             'colour_slug','accent_color','image_url','image_urls','visible',
                             'sold_out','sort_order'] loop
      if not has_column_privilege(r, 'public.products', c, 'SELECT') then
        raise exception '0022: % cannot SELECT products.%', r, c;
      end if;
    end loop;
  end loop;
end
$check$;
