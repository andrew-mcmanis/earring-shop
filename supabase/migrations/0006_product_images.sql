-- 0006_product_images.sql
-- Add an ordered gallery of photo URLs. image_urls[1] (Postgres 1-indexed) is
-- the main photo; the legacy single image_url column is kept and synced to it by
-- the admin save action.
alter table products add column if not exists image_urls text[] not null default '{}';

-- Backfill the array from the existing single image for products that have one.
update products
   set image_urls = array[image_url]
 where image_url is not null
   and image_url <> ''
   and (image_urls is null or array_length(image_urls, 1) is null);
