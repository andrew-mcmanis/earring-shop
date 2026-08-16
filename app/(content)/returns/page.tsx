import type { Metadata } from 'next';
import { Prose } from '../../components/Prose';
import { ORDERS_EMAIL } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Returns Policy',
};

export default function ReturnsPage() {
  return (
    <Prose>
      <h1>Returns Policy</h1>
      <p className="lead">
        At BLG Creations, every item is handmade with care, including polymer
        clay earrings, bookmarks and gifts. We hope you love your order, but if
        something is not quite right, please read the policy below and get in
        touch so we can help.
      </p>

      <h2>Change-of-Mind Returns</h2>
      <p>
        If you have changed your mind about a non-personalised item, please
        contact us within 14 days of receiving your order. Once you have told us
        you would like to return an eligible item, it should be sent back to us
        within a further 14 days.
      </p>
      <p>
        Returned items must be unused, unworn, in their original condition and,
        where applicable, in their original packaging. We reserve the right to
        reduce or refuse a refund if an item is returned used, damaged,
        incomplete or not in a resaleable condition.
      </p>

      <h2>Items That Cannot Be Returned Unless Faulty</h2>
      <p>
        For hygiene reasons, pierced earrings cannot be returned once they have
        been opened, tried on or worn, unless they are faulty. Personalised,
        customised or made-to-order items also cannot be returned for a change
        of mind unless they arrive faulty, damaged or not as described.
      </p>

      <h2>Faulty, Damaged or Incorrect Items</h2>
      <p>
        If your order arrives faulty, damaged or incorrect, please contact us as
        soon as possible with your order details and clear photographs of the
        issue. We will review the problem and, where appropriate, offer a
        replacement, repair, refund or another suitable solution.
      </p>
      <p>
        Please do not return a faulty or damaged item before contacting us, as
        we may need photographs or further details to resolve the matter
        quickly.
      </p>

      <h2>Return Postage</h2>
      <p>
        For change-of-mind returns, customers are responsible for the cost of
        return postage. We recommend using a tracked or proof-of-postage
        service, as we cannot be responsible for items that are lost or damaged
        on their way back to us.
      </p>
      <p>
        If an item is confirmed to be faulty, damaged or incorrect, we will
        discuss the most appropriate return or replacement arrangement with you.
      </p>

      <h2>Refunds</h2>
      <p>
        Once we receive and inspect an eligible returned item, we will let you
        know whether the refund has been approved. Approved refunds will be
        processed using the original payment method. Please allow time for your
        bank or payment provider to process the refund.
      </p>
      <p>
        Where a refund is due for a change-of-mind return, the original standard
        delivery cost will be refunded where required by law. Any upgraded,
        express or premium delivery charges may not be refunded beyond the
        standard delivery amount.
      </p>

      <h2>How to Request a Return</h2>
      <ol>
        <li>
          Contact BLG Creations via{' '}
          <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>{' '}
          within the relevant timeframe with your order number and reason for
          return.
        </li>
        <li>Wait for confirmation before sending anything back.</li>
        <li>
          Pack the item securely and return it in its original condition and
          packaging where possible.
        </li>
        <li>
          Keep proof of postage until your return has been received and
          resolved.
        </li>
      </ol>

      <h2>Questions</h2>
      <p>
        If you have any questions about your order or this returns policy,
        please contact BLG Creations before making a return. We are always happy
        to help. You can reach us at{' '}
        <a href={`mailto:${ORDERS_EMAIL}`}>{ORDERS_EMAIL}</a>
        .
      </p>
    </Prose>
  );
}
