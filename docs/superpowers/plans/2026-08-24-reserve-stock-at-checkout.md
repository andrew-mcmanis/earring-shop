# Reserve Stock at Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent overselling one-of-a-kind items by claiming a short, self-expiring hold on each cart item at "Continue to payment", so a second buyer can't pay for the same piece.

**Architecture:** Two columns on `products` (`reserved_until`, `reserved_by`) plus a row-atomic `claim_product(p_id, p_token, p_minutes)` Postgres function (like the existing `check_rate_limit` RPC). The checkout form sends a per-checkout token; `createOrderAndIntent` claims every cart item via the RPC before creating the order/PaymentIntent and rejects if any item is held by someone else. Holds self-expire after 15 minutes — no cron.

**Tech Stack:** Next.js 16 (Server Actions), React 19, TypeScript, Supabase (Postgres + service role RPC), Stripe. No test runner — verification is `npx tsc --noEmit` + `npm run build`, plus a manual two-session check.

---

## Conventions for this plan (read first)

- **No unit tests / no test runner** (project rule). Verify with `npx tsc --noEmit` and `npm run build`; the concurrency behaviour is checked manually in the final task.
- **Commits are LOCAL only.** Branch `feat/reserve-stock-at-checkout` (already checked out). **Do not push** — pushing `main` auto-deploys production. The owner pushes/merges after review.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Migration `0017` is an owner op.** The claim **fails open** on an RPC error (function missing pre-migration / transient), so a code-ahead-of-migration window degrades to today's behaviour (no hold) rather than blocking every checkout — but run `0017` to actually activate the prevention.
- Follow existing patterns: the `check_rate_limit` RPC, the `str()` form helper, `createServiceClient`, and the existing sold-out rejection copy.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/0017_product_reservations.sql` | Create | `reserved_until` + `reserved_by` columns + `claim_product` RPC |
| `supabase/schema.sql` | Modify | Mirror the columns + function |
| `app/components/CheckoutForm.tsx` | Modify | Per-checkout reservation token → hidden field |
| `app/lib/orders.ts` | Modify | Validate token; claim every cart item before order/PaymentIntent |

---

## Task 1: Migration + schema mirror (data model + RPC)

SQL isn't type-checked; verify by review.

**Files:**
- Create: `supabase/migrations/0017_product_reservations.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/migrations/0017_product_reservations.sql`**

```sql
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
```

- [ ] **Step 2: Mirror the columns in `supabase/schema.sql`**

Find:

```sql
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
```

Replace with:

```sql
  sort_order       int not null default 0,
  reserved_until   timestamptz,                       -- checkout hold; null = not held
  reserved_by      text,                              -- opaque per-checkout token
  created_at       timestamptz not null default now(),
```

- [ ] **Step 3: Mirror the `claim_product` function in `supabase/schema.sql`**

Find:

```sql
-- Server-side (service role) full access — needed for server tasks (e.g. orders)
grant all on categories, subcategories, colours, products to service_role;
```

Replace with:

```sql
-- Server-side (service role) full access — needed for server tasks (e.g. orders)
grant all on categories, subcategories, colours, products to service_role;

-- Atomic one-of-a-kind stock hold used by checkout (see migration 0017).
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
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_product_reservations.sql supabase/schema.sql
git commit -m "Add migration 0017: product reservation columns + claim_product RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Per-checkout reservation token (client)

A stable token for the checkout session, generated after mount (to avoid an SSR/client hydration mismatch) and persisted in `sessionStorage` so it survives "Edit details", a retry, and a 3-D Secure redirect.

**Files:**
- Modify: `app/components/CheckoutForm.tsx`

- [ ] **Step 1: Add the token helper above the component**

In `app/components/CheckoutForm.tsx`, find:

```tsx
export function CheckoutForm({ deliveryBase, paymentEnabled }: { deliveryBase: number; paymentEnabled: boolean }) {
```

Insert immediately **before** it:

```tsx
// A stable per-checkout token so the buyer can re-claim/extend their own stock
// hold across edit + retry. Persisted in sessionStorage; falls back to an
// in-memory value if storage is blocked.
function getOrCreateReservationToken(): string {
  try {
    const existing = sessionStorage.getItem('blg-reservation-token');
    if (existing) return existing;
    const token = crypto.randomUUID();
    sessionStorage.setItem('blg-reservation-token', token);
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

```

- [ ] **Step 2: Add the token state + mount effect**

Find:

```tsx
  const [method, setMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [isGift, setIsGift] = useState(false);
```

Replace with:

```tsx
  const [method, setMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [isGift, setIsGift] = useState(false);
  // Set after mount so SSR and first client render agree (empty), then filled.
  const [reservationToken, setReservationToken] = useState('');
  useEffect(() => {
    setReservationToken(getOrCreateReservationToken());
  }, []);
```

- [ ] **Step 3: Add the hidden field beside the other hidden inputs**

Find:

```tsx
        <input type="hidden" name="is_gift" value={method === 'delivery' && isGift ? 'true' : 'false'} />
```

Replace with:

```tsx
        <input type="hidden" name="is_gift" value={method === 'delivery' && isGift ? 'true' : 'false'} />
        <input type="hidden" name="reservation_token" value={reservationToken} />
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`useState`/`useEffect` are already imported; `crypto.randomUUID` is a browser global.)

- [ ] **Step 5: Commit**

```bash
git add app/components/CheckoutForm.tsx
git commit -m "Checkout: per-checkout reservation token (hidden field)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Claim the stock at checkout (server)

Claim every cart item via the RPC before the order + PaymentIntent are created; reject if any item is held by someone else. Fails open on an RPC error.

**Files:**
- Modify: `app/lib/orders.ts`

- [ ] **Step 1: Add the reservation constants**

In `app/lib/orders.ts`, find:

```ts
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_S = 300; // 5 minutes
```

Replace with:

```ts
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_S = 300; // 5 minutes

// One-of-a-kind stock: how long a checkout holds a piece while the buyer pays.
// Self-expiring, so an abandoned checkout frees the item after this window.
const RESERVATION_MINUTES = 15;
const UUID_RE = /^[0-9a-f-]{36}$/i;
```

- [ ] **Step 2: Add the token + claim helpers**

Find the end of `isRateLimited`:

```ts
  } catch (e) {
    console.error('[order] rate-limit check threw (allowing):', e);
    return false;
  }
}
```

Insert immediately **after** it:

```ts

// Normalise the client's reservation token: a UUID, or a fresh server-minted one.
function validReservationToken(raw: string): string {
  return UUID_RE.test(raw) ? raw : crypto.randomUUID();
}

// Atomically reserve each product for this checkout token (a self-expiring hold),
// so a concurrent buyer can't pay for the same one-of-a-kind piece. Returns the
// product ids that could NOT be claimed (sold out, or held by someone else).
// Fails OPEN on an RPC error (missing pre-migration / transient) so a claim
// outage degrades to today's behaviour rather than blocking every sale.
async function claimProducts(token: string, productIds: string[]): Promise<string[]> {
  const svc = createServiceClient();
  const failed: string[] = [];
  for (const id of [...new Set(productIds)]) {
    const { data, error } = await svc.rpc('claim_product', {
      p_id: id,
      p_token: token,
      p_minutes: RESERVATION_MINUTES,
    });
    if (error) {
      console.error('[order] claim_product failed (allowing) for', id, error.message);
      continue; // fail open on infra error
    }
    if (data !== true) failed.push(id);
  }
  return failed;
}
```

- [ ] **Step 3: Read the token with the other form fields**

Find:

```ts
  // A gift is always a delivery — never honour it for pickup.
  const isGift = !isPickup && formData.get('is_gift') === 'true';
```

Replace with:

```ts
  // A gift is always a delivery — never honour it for pickup.
  const isGift = !isPickup && formData.get('is_gift') === 'true';
  const reservationToken = validReservationToken(str(formData, 'reservation_token'));
```

- [ ] **Step 4: Claim the stock after the items are validated**

Find:

```ts
  if (items.length === 0) {
    return { status: 'error', message: 'Your basket is empty — add an item before checking out.' };
  }
```

Replace with:

```ts
  if (items.length === 0) {
    return { status: 'error', message: 'Your basket is empty — add an item before checking out.' };
  }

  // Reserve the one-of-a-kind pieces for this checkout before creating the order
  // or taking payment, so two buyers can't pay for the same item. Service-role
  // only; the RPC self-expires the hold after RESERVATION_MINUTES.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const unclaimed = await claimProducts(reservationToken, items.map((l) => l.productId));
    if (unclaimed.length > 0) {
      const names = [...new Set(items.filter((l) => unclaimed.includes(l.productId)).map((l) => l.name))];
      const pronoun = names.length > 1 ? 'them' : 'it';
      return {
        status: 'error',
        message: `Sorry, someone's just buying ${names.join(', ')} — please remove ${pronoun} from your basket to continue.`,
      };
    }
  }
```

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. (`createServiceClient` and `str` are already imported; `crypto.randomUUID` is available in the Node server runtime.)

- [ ] **Step 6: Commit**

```bash
git add app/lib/orders.ts
git commit -m "Checkout: atomically reserve one-of-a-kind stock before payment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full verification + owner ops

No new code.

- [ ] **Step 1: Whole-branch checks**

Run: `npx tsc --noEmit && npm run build`
Expected: clean tsc; build succeeds.

- [ ] **Step 2: Owner op — apply the migration**

In **Supabase → SQL Editor**, run the contents of
`supabase/migrations/0017_product_reservations.sql` (adds the two columns + the
`claim_product` function). Run it before relying on the prevention. (Until it's
applied the claim fails open — checkout works, but without the hold.)

- [ ] **Step 3: Manual concurrency check (two browser sessions)**

With the migration applied and the dev server running (`npm run dev`) — or a
preview deploy — open the same in-stock piece in **two separate browser sessions**
(e.g. a normal window + a private window, so they get different reservation
tokens):
- Session A: reach the **payment** step (this claims the hold).
- Session B: click **Continue to payment** → rejected with
  *"Sorry, someone's just buying … — please remove it to continue."* No order/charge.
- Session A: complete payment → the piece is permanently sold out.
- Abandon instead: with A holding (unpaid), in Supabase set that product's
  `reserved_until` to a past time (or wait 15 min) → Session B can now buy it.
- Single buyer: reach payment, click **Edit details**, change something, resubmit →
  **not** blocked (same token re-claims). Normal single-buyer and genuine sold-out
  flows are unchanged.

- [ ] **Step 4: Report status (do NOT push)**

Summarize tsc/build + the two-session check. The owner applies migration `0017`,
then merges `feat/reserve-stock-at-checkout` to `main` (which deploys).

## Out of scope (from the spec)

Reflecting live holds in the storefront/product/cart display · a cron/background release · auto-refunding a collided order · different pickup vs delivery handling.
