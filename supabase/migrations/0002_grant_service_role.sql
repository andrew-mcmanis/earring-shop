-- Run this once in the Supabase SQL editor on the existing project.
-- Grants the service role access to the catalogue tables — needed because the
-- project was created with "automatically expose new tables" turned off.
-- (New projects get this from schema.sql; this migration patches the live DB.)

grant usage on schema public to service_role;
grant all on categories, subcategories, colours, products to service_role;
