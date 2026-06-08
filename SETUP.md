# Setup — Supabase (Phase 0)

The shop runs right now on an in-repo sample catalogue, so you can develop
without any of this. Do these steps when you're ready to move products into a
real database that your sister can manage.

## 1. Create a Supabase project
1. Go to <https://supabase.com> and sign in (free).
2. **New project** → give it a name (e.g. `blg-creations`), pick a region close
   to the UK, and set a database password (save it somewhere safe).
3. Wait ~2 minutes for it to provision.

## 2. Create the database tables + sample data
1. In the project, open **SQL Editor**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql), run it.
3. Paste the contents of [`supabase/seed.sql`](supabase/seed.sql), run it.
4. Open **Table Editor** → you should see `categories`, `subcategories`,
   `colours`, and 18 rows in `products`.

## 3. Create the image storage bucket
1. Open **Storage** → **New bucket** → name it `product-images` → mark it
   **Public** → create. (This is where uploaded photos will live in Phase 2.)

## 4. Grab the keys
Open **Project Settings → API** and copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

Copy `.env.local.example` to `.env.local` and paste them in.

## 5. Tell me you're done
Once `.env.local` has the three values, the next step (wiring the Supabase
client and switching the data layer to read from the database) takes over —
the storefront will then show whatever is in your `products` table instead of
the sample data, with **no visible change** until you start editing products.

---

### What's already prepared in the repo
- New data model + sample catalogue in the **Earrings / Bookmarks / Gifts**
  taxonomy (Metal removed, Colour kept), behind an async data-access layer
  (`app/data/products.ts`) whose function signatures already match the DB.
- `supabase/schema.sql` + `supabase/seed.sql` — the database and sample rows.
- `.env.local.example` — every key you'll need.

See `ROADMAP.md` for the full phased plan.
