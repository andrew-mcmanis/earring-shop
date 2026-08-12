# BLG Creations — Go-Live Runbook

_The launch-day checklist for switching the shop from **Stripe test mode** to **live, real payments**._

## Where things stand (as of 2026-08-12)

Phase 2 (card payments + automatic emails) is **built, deployed, and fully validated** on the live domain in **Stripe test mode**:

- `https://blgcreations.co.uk` serves the shop (apex canonical; `www` redirects to it). HTTPS, public.
- Checkout takes card via the embedded Stripe Payment Element (GBP). The webhook marks orders paid, flips one-of-a-kind pieces to sold-out, and sends branded emails from `orders@blgcreations.co.uk` (with the logo).
- Migration `0010` (payment columns) is applied to the production database.
- **It's in TEST mode** — real cards decline; the shop isn't promoted yet. Bev is testing with the `4242 4242 4242 4242` test card.

Nothing below happens until **Bev is happy with her testing.**

---

## Pre-launch (can be done any time before flipping keys)

### A. Policy + about pages *(required before taking real money)*
Build and deploy: **Returns & Refunds**, **Privacy**, **Terms**, and an **About the maker + contact** page. These need content from Bev:
- Her returns stance (do handmade/made-to-order pieces qualify; who pays return postage).
- A customer contact email.
- A few sentences "meet the maker" (+ optional photo).

### B. Supabase Pro *(recommended)*
Upgrade the Supabase project to **Pro** so the database never auto-pauses under real traffic. Then remove the keep-alive cron: delete `app/api/keep-alive/route.ts` and its entry in `vercel.json`, and redeploy.

---

## Launch day — in order

### 1. Let Bev finish testing
Confirm she's placed test orders end-to-end and is happy with the flow and the emails.

### 2. Wipe the test data from the database
Every order in the table right now is test/dev data. In **Supabase → SQL Editor**, run:

```sql
delete from orders;
alter table orders alter column order_number restart with 1;
```

This clears all test orders (order items delete automatically) and resets the counter so the **first real order is BLG-1**. Then, in the **admin**, check every product shows the correct **in-stock / sold-out** state.

> ⚠️ One-time, pre-launch only. Once real customer orders exist, never blanket-delete.

### 3. Create the LIVE Stripe webhook endpoint
In the **Stripe dashboard**, switch to **Live mode** (toggle, top-right), then **Developers → Webhooks → Add endpoint**:
- **URL:** `https://blgcreations.co.uk/api/stripe/webhook`  *(must be the custom domain — a `*.vercel.app` URL is behind Vercel's login wall)*
- **Events:** `payment_intent.succeeded` and `payment_intent.payment_failed`
- Save, then **copy the endpoint's Signing secret** (`whsec_…`).

### 4. Switch Vercel to live keys
In **Vercel → earring-shop → Settings → Environment Variables** (Production), update:
- `STRIPE_SECRET_KEY` → your **live** `sk_live_…`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → your **live** `pk_live_…`
- `STRIPE_WEBHOOK_SECRET` → the **live** `whsec_…` from step 3

Leave the rest as-is (`RESEND_*`, `OWNER_ORDER_EMAIL=bev@blgconsulting.co.uk`, `NEXT_PUBLIC_APP_URL`).

### 5. Redeploy
**Vercel env changes only take effect after a redeploy.** Vercel → Deployments → the latest Production one → ⋯ → **Redeploy**. Wait for **Ready**.

### 6. Final QA
- Place **one real purchase** on `blgcreations.co.uk` with a real card → confirm the order shows **paid** in the admin, the item flips to sold-out, and both emails arrive.
- **Refund** that order from the Stripe dashboard.
- Do a full **mobile pass**: shop → product → cart → checkout → payment → confirmation.

### 7. Go
Flip the product stock back as needed, then start sharing the link / promoting.

---

## Handy reference

- **Vercel project:** `earring-shop` (`prj_aOtZSAUziLUw6zJ2adGl3sjhJHNm`, team `team_QgFFJRdkPwY6zA2zqsusdemW`)
- **Webhook URL (both test + live):** `https://blgcreations.co.uk/api/stripe/webhook`
- **Test cards** (test mode only): `4242 4242 4242 4242` succeeds · `4000 0000 0000 0002` declines · `4000 0027 6000 3184` triggers 3-D Secure. Any future expiry, any CVC, any postcode.
- **Vercel gotcha:** SSO protection is on for everything *except* the custom domain — always use `blgcreations.co.uk` for public URLs and the webhook.
- **Reminder:** env var changes require a redeploy; migrations are run by hand in the Supabase SQL editor.
