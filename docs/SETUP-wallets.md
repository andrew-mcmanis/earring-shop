# Apple Pay & Google Pay — setup & verification runbook

How to turn on Apple Pay / Google Pay at checkout, and how to prove they work
without spending real money you don't have to. Wallets ride on the **existing**
Stripe Payment Element — this is mostly Stripe Dashboard config, not code.

**Audience:** Andrew (dashboard + verify). One optional file-hosting step needs a
code push. Bev doesn't need to do anything.

---

## TL;DR

1. Confirm Apple Pay + Google Pay are enabled in the Stripe Dashboard (usually already on).
2. Register `blgcreations.co.uk` on the **Payment method domains** page (this is the only real Apple Pay requirement).
3. Deploy nothing — the Payment Element already renders wallet buttons by default.
4. Verify on a **real iPhone/Safari** (render-only check = no charge) and an **Android/Chrome** phone for Google Pay.

Expected effort: ~10–15 min in the dashboard, 0 lines of code in the common case.

---

## Part 1 — Why this is (almost) free

Nothing in the payment code needs to change for wallets to appear. What's already in place:

- **`automatic_payment_methods: { enabled: true }`** on the PaymentIntent
  ([`app/lib/orders.ts`](../app/lib/orders.ts)) → Stripe shows whichever methods are
  enabled in the Dashboard, wallets included.
- **`<PaymentElement />`** ([`app/components/StripePaymentStep.tsx`](../app/components/StripePaymentStep.tsx))
  renders Apple Pay / Google Pay buttons **by default**. Per Stripe's Payment Element
  docs, the `wallets` option "default is to show them when possible," and we set no override.
- **Same PaymentIntent + same webhook.** An Apple Pay / Google Pay tap confirms the
  *identical* PaymentIntent and fires the *identical* `payment_intent.succeeded` webhook
  ([`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts)) that already
  marks orders paid, flips sold-out, and sends both emails. **The back half of the flow
  is already proven in production by the live card flow** — wallets only change how the
  customer authenticates on the front end. That keeps the risk surface small.
- **Flow fit.** Checkout collects name / email / address *first*, then creates the
  PaymentIntent, then shows the Payment Element. By the time a wallet button appears the
  amount and shipping address are already fixed server-side, so there's no wallet-address
  reconciliation to build.

Because of the two-step flow, we're using wallets as a **payment method inside the
existing Payment Element** — not the "one-tap Express Checkout button at the top of the
cart." That bigger variant (Express Checkout Element) is deliberately out of scope here;
see Part 6.

---

## Part 2 — Dashboard setup (LIVE account)

> Do this on the **live** Stripe account (the one with `sk_live_` / `pk_live_` keys).
> Registering in live mode also auto-registers the domain for test sandboxes.

### 2a. Confirm the wallets are enabled

1. Open **Payment methods**: <https://dashboard.stripe.com/settings/payment_methods>
2. Check that **Apple Pay** and **Google Pay** are **On**. They're on by default for most
   accounts under Dynamic payment methods — if either is off, turn it on.

### 2b. Register the domain for Apple Pay (the one required step)

Apple requires every domain that shows an Apple Pay button to be registered. Stripe
handles Apple's merchant validation for you — **do not** create an Apple Merchant ID or
follow Apple's own process.

1. Open **Payment method domains**: <https://dashboard.stripe.com/settings/payment_method_domains>
2. Click **Add a new domain**.
3. Enter `blgcreations.co.uk` → **Save and continue**.
4. (Optional) Add `www.blgcreations.co.uk` too. Harmless, but note that `www` 308-redirects
   to the apex *before* any page renders, so checkout never actually loads on `www` — the
   apex registration is the one that matters.

Google Pay needs no Apple-style file; registering the domain above covers it, and it works
on Chrome/Android once enabled in 2a.

### 2c. If (and only if) the domain doesn't auto-verify

The modern **Payment method domains** flow usually verifies automatically. If the dashboard
shows the domain as **not verified** and offers a **domain association file** to download,
host it in the repo — Next.js serves `public/` at the site root:

1. Download the file Stripe gives you (it has **no extension**):
   `apple-developer-merchantid-domain-association`
2. Save it to:
   ```
   public/.well-known/apple-developer-merchantid-domain-association
   ```
3. Commit + push (deploys to Vercel). Confirm it's reachable:
   ```bash
   curl -I https://blgcreations.co.uk/.well-known/apple-developer-merchantid-domain-association
   ```
   Expect `200 OK`.
4. Back on the Payment method domains page, click the domain → **Verify** / **Re-check**.

> This is the *only* code change wallets might require, and only in the fallback case.
> There is currently **no** `.well-known` route or file in the repo, so the path above is
> free to use.

---

## Part 3 — Code changes

**Common case: none.** The Payment Element already shows wallets by default.

The only possible change is hosting the association file in Part 2c, and only if
auto-verification fails.

You do **not** need to touch `automatic_payment_methods`, add a `wallets` option, or add
the Express Checkout Element for Part 1's scope.

---

## Part 4 — Verification

Pick the depth you want. Options A + D are enough for a confident go-live; B or C add
end-to-end proof.

### Constraints to keep in mind first

- **Apple Pay can't be tested on `localhost` or `*.vercel.app`.** It needs a registered
  HTTPS domain. `*.vercel.app` is also behind Vercel SSO here, so it's not a clean target.
  The real test surface is live `blgcreations.co.uk` on a real device.
- **Apple Pay testing uses a REAL card + TEST keys** — Stripe recognises the test key and
  returns a test token, so a real card is **not** charged. You **cannot** add Stripe test
  cards to Apple Wallet.
- **Live site = LIVE keys**, so *completing* a wallet payment on `blgcreations.co.uk`
  charges real money (refundable). *Rendering* the button charges nothing — see Option A.
- ⚠️ Any checkout that reaches "Continue to payment" — local or live — writes a **real
  `orders` row** to the shared prod DB and burns an order number. Plan test orders
  accordingly (see [`docs/GO-LIVE.md`](./GO-LIVE.md) conventions).

### Option A — Render check on live (no charge, ~2 min) ✅ recommended first

1. On a real **iPhone (Safari)** with a card already in Apple Wallet, go to
   `https://blgcreations.co.uk`, add an item, and proceed to checkout.
2. Fill the details step, tap **Continue to payment**. *(This does create one real unpaid
   order row — that's expected; leave it unpaid.)*
3. Confirm the **Apple Pay** button appears at the top of the Payment Element.
4. **Stop there — do not authorise.** Button visible = eligibility + domain registration
   are correct. No money moves.

Repeat on **Android (Chrome)** with a card in Google Wallet to confirm the **Google Pay**
button.

### Option B — Full end-to-end with no real money (ngrok + test keys, optional)

For a complete tap-to-paid-to-email test without charging a real card:

1. Run the app locally with the **TEST** Stripe keys from `.env.local`.
2. Expose it over HTTPS with a tunnel: `ngrok http 3000` (gives an `https://…ngrok…` URL).
3. In a Stripe **sandbox**, register that ngrok domain on the Payment method domains page.
4. Load the ngrok URL on a real iPhone, add a card-backed Apple Pay, and pay. With test
   keys, the real card is **not** charged; the local `stripe listen` webhook drives the
   paid → email flow.

   ⚠️ Local dev writes to the **shared prod DB** and burns an order number. Delete the test
   row afterwards with a **targeted single-row** delete (never blanket-delete `orders`).

### Option C — One real purchase, then refund (matches go-live)

Same pattern as the launch smoke test: buy the cheapest live item via Apple Pay on your
phone, confirm the confirmation email + admin order, then refund it in Stripe. Confirms the
true live path end-to-end at the cost of one refunded transaction.

### Option D — Stripe's wallet test page

If a button doesn't show and you're not sure why, load Stripe's diagnostic page on the same
device to see which eligibility check is failing:
<https://docs.stripe.com/testing/wallets>

---

## Part 5 — Rollback

Wallets are dashboard-controlled, so rollback is instant and needs **no deploy**:

- **Remove Apple Pay from the site:** Payment method domains page → the domain → **Disable**.
- **Turn a wallet off entirely:** Payment methods page → toggle **Apple Pay** / **Google
  Pay** off.
- **Belt-and-braces in code (optional):** pass `wallets: { applePay: 'never', googlePay:
  'never' }` in the Payment Element options in
  [`app/components/StripePaymentStep.tsx`](../app/components/StripePaymentStep.tsx). Not
  needed for a quick disable.

---

## Part 6 — Out of scope (deliberately): Express Checkout Element

The prominent "one-tap Apple Pay / Google Pay button *before* filling the form" uses
Stripe's separate **Express Checkout Element**. It's a bigger change because the wallet
returns its own name / email / shipping address, which would have to be mapped into
`createOrderAndIntent` and reconciled with the delivery-vs-pickup shipping choice before an
amount exists — it fights the current "details first, server-authoritative money" model.
If we ever want it, start with a proper design pass, not this runbook.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| No Apple Pay button on iPhone/Safari | Domain not registered/verified (Part 2b/2c); or no card in Apple Wallet; or not Safari. |
| No Google Pay button on Android/Chrome | Google Pay disabled in Payment methods (2a); or no card in Google Wallet; or not Chrome. |
| Button shows on desktop but not mobile (or vice-versa) | Normal — wallets are device/browser-specific. Test on the matching device. |
| Nothing works on `localhost` / preview | Expected — Apple Pay needs the registered live domain; use Option A or the ngrok path (Option B). |
| Domain won't verify in the dashboard | Host the association file (Part 2c) and re-check. |

---

## Sources

- Stripe — Apple Pay (web): <https://docs.stripe.com/apple-pay?platform=web>
- Stripe — Register domains for payment methods: <https://docs.stripe.com/payments/payment-methods/pmd-registration>
- Stripe — Payment Element (`wallets` default "show when possible"): <https://docs.stripe.com/payments/payment-element>
- Stripe — Test wallets: <https://docs.stripe.com/testing/wallets>
