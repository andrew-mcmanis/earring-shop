import { Resend } from 'resend';
import { SITE_URL, INSTAGRAM_URL, INSTAGRAM_HANDLE } from './site';
import { CARE_TIPS } from './care';

export interface OrderEmailData {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  shipping: number;
  fulfilmentMethod: 'delivery' | 'pickup';
  /** Delivery orders only. */
  address: { line: string | null; city: string | null; postcode: string | null } | null;
  /** Pickup orders only — read from private settings at send time. */
  collection: { address: string | null; note: string | null } | null;
}

const INK = '#1A1A1A';
const CREAM = '#FDF8F0';

function money(n: number): string {
  return `£${n.toFixed(2)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function itemsTable(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;color:${INK};">${esc(i.name)} <span style="color:#7a6a58;">×${i.quantity}</span></td>
        <td style="padding:6px 0;text-align:right;color:${INK};">${money(i.unitPrice * i.quantity)}</td>
      </tr>`,
    )
    .join('');
  const total = data.subtotal + data.shipping;
  const shipLabel = data.fulfilmentMethod === 'pickup' ? 'Collection' : 'Delivery';
  const shipValue = data.shipping > 0 ? money(data.shipping) : 'Free';
  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;font-family:Georgia,serif;font-size:15px;">
      ${rows}
      <tr><td colspan="2" style="border-top:1px solid #e6dccb;padding-top:8px;"></td></tr>
      <tr><td style="padding:4px 0;color:#7a6a58;">Subtotal</td><td style="padding:4px 0;text-align:right;color:${INK};">${money(data.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#7a6a58;">${shipLabel}</td><td style="padding:4px 0;text-align:right;color:${INK};">${shipValue}</td></tr>
      <tr><td style="padding:8px 0 0;font-weight:bold;color:${INK};">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;color:${INK};">${money(total)}</td></tr>
    </table>`;
}

function fulfilmentBlock(data: OrderEmailData): string {
  if (data.fulfilmentMethod === 'pickup') {
    const addr = data.collection?.address
      ? `<p style="margin:4px 0;white-space:pre-line;color:${INK};">${esc(data.collection.address)}</p>`
      : `<p style="margin:4px 0;color:${INK};">We'll be in touch with the collection details.</p>`;
    const note = data.collection?.note ? `<p style="margin:4px 0;color:#7a6a58;">${esc(data.collection.note)}</p>` : '';
    return `<h3 style="font-family:Georgia,serif;color:${INK};margin:20px 0 4px;">Collection</h3>${addr}${note}`;
  }
  const line = [data.address?.line, data.address?.city, data.address?.postcode]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join(', ');
  return `<h3 style="font-family:Georgia,serif;color:${INK};margin:20px 0 4px;">Delivery to</h3><p style="margin:4px 0;color:${INK};">${line}</p>`;
}

// Care tips + "follow us" QR, shown on the customer confirmation only. Tips come
// from the shared CARE_TIPS (same source as the /jewellery-care page). The QR is
// a hosted image (like the logo) so it survives email clients that strip data
// URIs; the text link below it covers blocked images and mobile readers.
function careBlock(): string {
  const tips = CARE_TIPS.map(
    (t) => `<li style="margin:6px 0;">${esc(t)}</li>`,
  ).join('');
  return `
    <h3 style="font-family:Georgia,serif;color:${INK};margin:24px 0 4px;">Caring for your jewellery</h3>
    <ul style="margin:8px 0;padding-left:20px;color:${INK};font-family:Georgia,serif;font-size:14px;">
      ${tips}
    </ul>
    <p style="color:#7a6a58;font-size:14px;margin:18px 0 8px;">Follow us for more beautiful designs:</p>
    <a href="${INSTAGRAM_URL}" style="text-decoration:none;">
      <img src="${SITE_URL}/care/instagram-qr.png" alt="Scan to follow ${esc(INSTAGRAM_HANDLE)} on Instagram" width="130" style="display:block;width:130px;height:auto;border:0;margin:0 0 6px;" />
    </a>
    <a href="${INSTAGRAM_URL}" style="color:${INK};font-family:Georgia,serif;font-size:14px;">${esc(INSTAGRAM_HANDLE)}</a>`;
}

function shell(title: string, inner: string): string {
  return `
  <div style="background:${CREAM};padding:24px;font-family:Georgia,serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6dccb;border-radius:8px;padding:28px;">
      <img src="${SITE_URL}/logo/BLG_Creations_wordmark.png" alt="BLG Creations" width="200" style="display:block;width:200px;max-width:60%;height:auto;margin:0 0 12px;border:0;" />
      <h2 style="font-family:Georgia,serif;color:${INK};margin:0 0 16px;font-size:18px;font-weight:normal;">${title}</h2>
      ${inner}
    </div>
  </div>`;
}

function customerHtml(data: OrderEmailData): string {
  return shell(
    `Thank you for your order, ${esc(data.customerName.split(' ')[0] || data.customerName)}!`,
    `<p style="color:${INK};">Your payment has been received. Your order reference is
       <strong>${esc(data.reference)}</strong>.</p>
     ${itemsTable(data)}
     ${fulfilmentBlock(data)}
     ${careBlock()}
     <p style="color:#7a6a58;margin-top:20px;font-size:13px;">Each piece is handmade and one of a kind — thank you for supporting a small maker.</p>`,
  );
}

function ownerHtml(data: OrderEmailData): string {
  const contact = [
    `<strong>${esc(data.customerName)}</strong>`,
    esc(data.customerEmail),
    data.customerPhone ? esc(data.customerPhone) : '',
  ]
    .filter(Boolean)
    .join('<br>');
  return shell(
    `New order — ${esc(data.reference)}`,
    `<p style="color:${INK};">${contact}</p>
     ${itemsTable(data)}
     ${fulfilmentBlock(data)}`,
  );
}

/**
 * Send the customer confirmation and the owner alert. Resilient: missing config
 * or a send failure logs and returns — it must NEVER throw into the webhook,
 * because the order is already paid.
 */
export async function sendOrderEmails(data: OrderEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const ownerTo = process.env.OWNER_ORDER_EMAIL;

  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM missing — skipping emails for', data.reference);
    return;
  }
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: data.customerEmail,
      // No explicit Reply-To: a customer's reply goes to the From address
      // (orders@blgcreations.co.uk) so it matches the sender. That address is a
      // real IONOS mailbox the owner reads and replies from — so replies stay
      // branded as orders@.
      subject: `Your BLG Creations order ${data.reference}`,
      html: customerHtml(data),
    });
  } catch (e) {
    console.error('[email] customer confirmation failed for', data.reference, e);
  }

  if (ownerTo) {
    try {
      await resend.emails.send({
        from,
        to: ownerTo,
        // Pure notification — no customer Reply-To on purpose. Replying to this
        // alert (from the owner's own inbox) would send as that inbox's address,
        // not the brand. The owner corresponds with customers in the orders@
        // mailbox instead (that's where customer replies land), keeping every
        // customer-facing email branded as orders@blgcreations.co.uk.
        subject: `New order ${data.reference} (${money(data.subtotal + data.shipping)})`,
        html: ownerHtml(data),
      });
    } catch (e) {
      console.error('[email] owner alert failed for', data.reference, e);
    }
  } else {
    console.warn('[email] OWNER_ORDER_EMAIL not set — owner alert skipped for', data.reference);
  }
}
