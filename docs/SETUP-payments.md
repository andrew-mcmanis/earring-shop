# Taking payments — setup (for the shop owner)

This gets card payments and automatic emails working. You'll create two free
accounts and paste six keys into the project. **Start in test mode** — no real
money moves until we deliberately switch to live at launch.

## 1. Stripe (card payments)

1. Go to https://stripe.com and sign up (business name: BLG Creations).
2. You can skip/park the full business verification while in **test mode**.
3. In the dashboard, make sure the toggle top-right says **Test mode**.
4. Go to **Developers → API keys**. Copy:
   - **Publishable key** (starts `pk_test_…`)
   - **Secret key** (starts `sk_test_…`) — click "Reveal".

## 2. Resend (order emails)

1. Go to https://resend.com and sign up.
2. Go to **API Keys → Create API Key**. Copy it (starts `re_…`).
3. For test mode you can send from `onboarding@resend.dev`, but it can only
   deliver to **your own** Resend account email. So use your own email as the
   "owner" address and, when we test, place a test order with your own email as
   the customer. (Your branded sender address comes later, at launch.)

## 3. Give the keys to your developer

Paste these into `.env.local` (never commit this file):

    STRIPE_SECRET_KEY=sk_test_...
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
    STRIPE_WEBHOOK_SECRET=whsec_...        # from the Stripe CLI during local testing
    RESEND_API_KEY=re_...
    RESEND_FROM=onboarding@resend.dev
    OWNER_ORDER_EMAIL=you@youremail.com    # where "new order" alerts go

## 4. Database

Your developer will send you one SQL file (`0010_order_payments.sql`) to paste
into the Supabase **SQL editor** and run — same as previous updates.

## What happens at launch (later)

- Verify your own domain in Resend so emails come from your brand.
- Add the live webhook endpoint in Stripe and switch to live keys.
- Do one real test purchase, then refund it.
