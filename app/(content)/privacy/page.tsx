import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';
import { ORDERS_EMAIL } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p>Last updated: 16 August 2026</p>
      <p className="lead">
        This policy explains how BLG Creations handles the personal information
        you provide when you visit or buy from blgcreations.co.uk. We only
        collect what we need to process your order, and we never sell your
        information.
      </p>

      <h2>Who We Are</h2>
      <p>
        BLG Creations is a small independent maker of handmade jewellery and
        gifts. We are the &ldquo;data controller&rdquo; for the information
        described here. For any privacy question, or to exercise your rights
        below, contact us at{' '}
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>.
      </p>

      <h2>What We Collect</h2>
      <ul>
        <li>
          Your name and email address, and — for deliveries — your postal
          address and, if you provide it, your phone number.
        </li>
        <li>Details of the items you order and your order history with us.</li>
        <li>Any messages you send us by email.</li>
      </ul>
      <p>
        You provide this information yourself when you place an order or contact
        us.
      </p>

      <h2>Payment</h2>
      <p>
        Card payments are handled securely by our payment provider, Stripe. Your
        full card details are entered directly with Stripe — BLG Creations never
        sees or stores your card number.
      </p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>
          To take payment for and fulfil your order, and to send you order
          confirmations and updates.
        </li>
        <li>To respond to your questions and provide customer support.</li>
        <li>To keep the records we must keep for tax and accounting.</li>
      </ul>
      <p>
        Our lawful basis is performing our contract with you when you place an
        order, together with our legitimate interest in running the shop and
        replying to enquiries.
      </p>

      <h2>Who We Share It With</h2>
      <p>
        We share your information only with the service providers that help us
        run the shop, and only so they can perform their service:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — to process card payments.
        </li>
        <li>
          <strong>Resend</strong> — to send your order confirmation emails.
        </li>
        <li>
          <strong>Vercel</strong> — to host the website.
        </li>
        <li>
          <strong>Supabase</strong> — to store order records securely.
        </li>
      </ul>
      <p>
        We do not sell your personal information or use it for third-party
        advertising.
      </p>

      <h2>Cookies</h2>
      <p>
        Our site uses only essential cookies needed to remember your shopping
        basket while you browse. We use privacy-friendly, cookieless analytics
        to understand general site usage, so there is no advertising or tracking
        cookie for you to consent to.
      </p>

      <h2>How Long We Keep It</h2>
      <p>
        We keep order records for as long as we need them to complete your order
        and to meet our legal and accounting obligations, after which they are
        deleted or anonymised.
      </p>

      <h2>Your Rights</h2>
      <p>
        You have the right to ask us for a copy of the information we hold about
        you, to correct it if it is wrong, or to ask us to delete it where we
        are not required to keep it. To make a request, email{' '}
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>.
      </p>
      <p>
        If you are unhappy with how we have handled your information, you can
        complain to the UK&rsquo;s data protection regulator, the Information
        Commissioner&rsquo;s Office, at{' '}
        <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">
          ico.org.uk
        </a>
        .
      </p>
    </Prose>
  );
}
