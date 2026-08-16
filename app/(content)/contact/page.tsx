import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';
import { ORDERS_EMAIL, INSTAGRAM_URL, INSTAGRAM_HANDLE } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Contact',
};

export default function ContactPage() {
  return (
    <Prose>
      <h1>Get in Touch</h1>
      <p className="lead">
        Have a question about an order, a piece, or a custom request? We would
        love to hear from you — the best way to reach us is by email.
      </p>

      <h2>Email</h2>
      <p>
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>
        <br />
        We aim to reply within a couple of days. Please include your order
        number if your message is about an existing order.
      </p>

      <h2>Instagram</h2>
      <p>
        Follow{' '}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {INSTAGRAM_HANDLE}
        </a>{' '}
        for new designs, works in progress and updates.
      </p>

      <h2>Before You Write</h2>
      <p>
        Looking for our returns process or jewellery care advice? You may find
        the answer on our <a href="/returns">Returns Policy</a> or{' '}
        <a href="/jewellery-care">Jewellery Care</a> pages.
      </p>
    </Prose>
  );
}
