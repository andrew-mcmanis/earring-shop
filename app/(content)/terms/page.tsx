import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';
import { ORDERS_EMAIL } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
};

export default function TermsPage() {
  return (
    <Prose>
      {/* REVIEW BEFORE GO-LIVE — assumptions in this draft, confirm with Bev:
          1. Trading status: sole trader, "Bev Gallifant trading as BLG
             Creations". Confirm the exact legal/trading name.
          2. VAT: drafted as NOT VAT-registered (no VAT added to prices).
             Confirm — change the "Prices and Payment" wording if registered.
          3. Governing law: drafted as England & Wales. Change if Bev trades
             from Scotland or Northern Ireland.
          4. Set "Last updated" to the actual publish date at go-live.
          Remove this comment once confirmed. */}
      <h1>Terms &amp; Conditions</h1>
      <p>Last updated: 16 August 2026</p>
      <p className="lead">
        These terms apply when you buy from BLG Creations at blgcreations.co.uk.
        BLG Creations is run by Bev Gallifant as a sole trader. Please read them
        alongside our <a href="/privacy">Privacy Policy</a> and{' '}
        <a href="/returns">Returns Policy</a>.
      </p>

      <h2>Our Products</h2>
      <p>
        Every item is handmade, often from polymer clay. Because pieces are made
        by hand, small variations in colour, shape, pattern and size are natural
        and are part of their character, not a fault. Photographs are as
        accurate as we can make them, but colours may appear slightly different
        from one screen to another.
      </p>

      <h2>Ordering</h2>
      <p>
        When you place an order and payment is successful, you are offering to
        buy the items in your basket. A contract is formed once we confirm your
        order by email. Occasionally we may be unable to fulfil an order (for
        example, if an item is no longer available) — if that happens we will
        contact you and arrange a full refund.
      </p>

      <h2>Prices and Payment</h2>
      <p>
        Prices are shown in pounds sterling (GBP) and are the price you pay; no
        VAT is added. Payment is taken securely at checkout by card via Stripe.
        Any delivery charge is shown before you pay.
      </p>

      <h2>Delivery</h2>
      <p>
        We post to addresses within the United Kingdom. Delivery options and any
        charges are shown at checkout. We aim to dispatch promptly, but as
        pieces are handmade, please allow a little time for your order to be
        prepared. Any delivery timescales are estimates.
      </p>

      <h2>Cancellations and Returns</h2>
      <p>
        You have the right to cancel or return eligible items as set out in our{' '}
        <a href="/returns">Returns Policy</a>, which forms part of these terms.
        Some items — such as pierced earrings that have been worn, and
        personalised or made-to-order pieces — cannot be returned for a change
        of mind unless faulty, as explained there.
      </p>

      <h2>Faulty Items</h2>
      <p>
        If something arrives faulty, damaged or not as described, you have
        rights under the Consumer Rights Act 2015, including the right to a
        repair, replacement or refund. Please contact us at{' '}
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>{' '}
        with your order details and photographs so we can put things right.
      </p>

      <h2>Our Responsibility to You</h2>
      <p>
        We take care to describe and make our products accurately. We are
        responsible for foreseeable loss caused by us failing to meet these
        terms, but we are not responsible for loss that is not foreseeable or
        that arises from circumstances beyond our reasonable control. Nothing in
        these terms affects your statutory rights as a consumer.
      </p>

      <h2>Governing Law</h2>
      <p>
        These terms are governed by the law of England and Wales, and any
        disputes will be subject to the courts of England and Wales. This does
        not affect your statutory rights.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email us at{' '}
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>.
      </p>
    </Prose>
  );
}
