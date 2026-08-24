import { Resend } from 'resend';
import { SITE_URL, INSTAGRAM_URL, INSTAGRAM_HANDLE, ORDERS_EMAIL } from './site';
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
  /** True when the order is a gift posted to someone other than the buyer. */
  isGift: boolean;
  /** Gift orders: who the parcel is addressed to. Null otherwise. */
  recipientName: string | null;
  /** Delivery orders only. */
  address: { line: string | null; city: string | null; postcode: string | null } | null;
  /** Pickup orders only — read from private settings at send time. */
  collection: { address: string | null; note: string | null } | null;
  /** Customer's order notes, if any — shown to the owner so a delivery/gift
   *  instruction isn't missed. */
  notes: string | null;
}

// Palette (brand tokens). Warm cream "paper", ink text, kraft accents.
const INK = '#1A1A1A';
const BODY = '#4A4A4A'; // ink-light — body copy
const MUTED = '#8A7C6A'; // warm grey — secondary text
const KRAFT = '#B5865A';
const KRAFT_DARK = '#8B6347';
const CREAM = '#FDF8F0';
const CARD = '#FFFFFF';
const PANEL = '#F6EFE1'; // soft kraft-tinted panel
const HAIR = '#EADFC8'; // hairline rule
const SERIF = "Georgia, 'Times New Roman', serif";

function money(n: number): string {
  return `£${n.toFixed(2)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

// Vertical spacer between sections (email-safe — margins are unreliable).
function gap(px = 28): string {
  return `<div style="line-height:${px}px;height:${px}px;font-size:0;">&nbsp;</div>`;
}

// Uppercase, letter-spaced section label — the repeating rhythm that ties the
// whole email together.
function label(text: string): string {
  return `<div style="font-family:${SERIF};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${KRAFT_DARK};margin:0 0 12px;">${esc(text)}</div>`;
}

function itemsTable(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SERIF};font-size:15px;color:${INK};">${esc(i.name)}${i.quantity > 1 ? ` <span style="color:${MUTED};">&times; ${i.quantity}</span>` : ''}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${HAIR};font-family:${SERIF};font-size:15px;color:${INK};text-align:right;white-space:nowrap;">${money(i.unitPrice * i.quantity)}</td>
      </tr>`,
    )
    .join('');
  const total = data.subtotal + data.shipping;
  const shipLabel = data.fulfilmentMethod === 'pickup' ? 'Collection' : 'Delivery';
  const shipValue = data.shipping > 0 ? money(data.shipping) : 'Free';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
      <tr>
        <td style="padding:12px 0 4px;font-family:${SERIF};font-size:14px;color:${MUTED};">Subtotal</td>
        <td style="padding:12px 0 4px;font-family:${SERIF};font-size:14px;color:${BODY};text-align:right;">${money(data.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0;font-family:${SERIF};font-size:14px;color:${MUTED};">${shipLabel}</td>
        <td style="padding:2px 0;font-family:${SERIF};font-size:14px;color:${BODY};text-align:right;">${shipValue}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;border-top:2px solid ${INK};font-family:${SERIF};font-size:17px;font-weight:bold;color:${INK};">Total</td>
        <td style="padding:12px 0 0;border-top:2px solid ${INK};font-family:${SERIF};font-size:17px;font-weight:bold;color:${INK};text-align:right;">${money(total)}</td>
      </tr>
    </table>`;
}

function fulfilmentBlock(data: OrderEmailData, audience: 'customer' | 'owner'): string {
  if (data.fulfilmentMethod === 'pickup') {
    const body = data.collection?.address
      ? `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};white-space:pre-line;">${esc(data.collection.address)}</p>`
      : `<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">We&rsquo;ll be in touch with the collection details.</p>`;
    const note = data.collection?.note
      ? `<p style="margin:8px 0 0;font-family:${SERIF};font-size:14px;line-height:1.6;color:${MUTED};">${esc(data.collection.note)}</p>`
      : '';
    return `${label('Collection')}${body}${note}`;
  }
  const line = [data.address?.line, data.address?.city, data.address?.postcode]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join('<br>');
  if (data.isGift) {
    // Owner sees a clear GIFT marker (so she addresses the parcel to the
    // recipient); the buyer sees a reassuring "Sending to".
    const heading = audience === 'owner' ? 'Deliver to (gift)' : 'Sending to';
    const name = data.recipientName
      ? `<p style="margin:0 0 4px;font-family:${SERIF};font-size:15px;font-weight:bold;line-height:1.6;color:${INK};">${esc(data.recipientName)}</p>`
      : '';
    return `${label(heading)}${name}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">${line}</p>`;
  }
  return `${label('Delivery to')}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};">${line}</p>`;
}

// Care tips panel + centred "follow us" QR — customer confirmation only. Tips
// come from the shared CARE_TIPS (same source as the /jewellery-care page). The
// QR is a hosted image (like the logo) so it survives clients that strip data
// URIs; the text link beneath covers blocked images and mobile readers.
function careBlock(): string {
  const tips = CARE_TIPS.map(
    (t) => `
        <tr>
          <td valign="top" style="padding:5px 12px 5px 0;font-family:${SERIF};font-size:16px;line-height:1.5;color:${KRAFT};">&bull;</td>
          <td valign="top" style="padding:5px 0;font-family:${SERIF};font-size:14px;line-height:1.55;color:${BODY};">${esc(t)}</td>
        </tr>`,
  ).join('');
  return `
    ${label('Caring for your jewellery')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PANEL}" style="background:${PANEL};border-radius:8px;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tips}</table>
      </td></tr>
    </table>`;
}

function reviewInviteBlock(reference: string): string {
  const url = `${SITE_URL}/reviews/new?ref=${encodeURIComponent(reference)}`;
  return `
    ${label('Enjoyed your order?')}
    <p style="margin:0 0 14px;font-family:${SERIF};font-size:15px;line-height:1.6;color:${BODY};">A few words from you help other customers find us &mdash; and they always make our day. It only takes a minute.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${KRAFT}" style="border-radius:6px;">
      <a href="${url}" style="display:inline-block;padding:11px 22px;font-family:${SERIF};font-size:14px;font-weight:bold;color:${CREAM};text-decoration:none;">Leave a review</a>
    </td></tr></table>`;
}

function followBlock(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:2px 0;">
        <div style="font-family:${SERIF};font-size:15px;color:${INK};">Follow us for more beautiful designs</div>
        <a href="${INSTAGRAM_URL}" style="text-decoration:none;">
          <img src="${SITE_URL}/care/instagram-qr.png" alt="Scan to follow ${esc(INSTAGRAM_HANDLE)} on Instagram" width="118" style="display:block;width:118px;height:auto;border:0;border-radius:8px;margin:14px auto 10px;" />
        </a>
        <a href="${INSTAGRAM_URL}" style="font-family:${SERIF};font-size:14px;font-weight:bold;letter-spacing:0.5px;color:${KRAFT_DARK};text-decoration:none;">${esc(INSTAGRAM_HANDLE)}</a>
      </td></tr>
    </table>`;
}

// Shared chrome: cream page → paper card → centred header (logo + tagline +
// rule) → greeting → body sections → centred brand footer. Used by both emails.
function shell(preheader: string, greeting: string, intro: string, inner: string): string {
  return `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CREAM};opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CREAM}" style="background:${CREAM};margin:0;padding:0;">
    <tr><td align="center" style="padding:30px 14px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="${CARD}" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${HAIR};border-radius:12px;">
        <tr><td align="center" style="padding:36px 40px 0;">
          <img src="${SITE_URL}/logo/BLG_Creations_wordmark.png" alt="BLG Creations" width="180" style="display:block;width:180px;max-width:58%;height:auto;border:0;margin:0 auto;" />
          <div style="font-family:${SERIF};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};margin:10px 0 0;">Handmade Jewellery &amp; Gifts</div>
          <div style="height:1px;background:${HAIR};line-height:1px;font-size:0;margin:24px 0 0;">&nbsp;</div>
        </td></tr>
        <tr><td align="center" style="padding:26px 40px 0;">
          <h1 style="margin:0;font-family:${SERIF};font-size:24px;font-weight:normal;color:${INK};">${greeting}</h1>
          ${intro ? `<p style="margin:12px 0 0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${BODY};">${intro}</p>` : ''}
        </td></tr>
        <tr><td style="padding:30px 40px 4px;">${inner}</td></tr>
        <tr><td style="padding:4px 40px 36px;">
          <div style="height:1px;background:${HAIR};line-height:1px;font-size:0;margin:18px 0 22px;">&nbsp;</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="font-family:${SERIF};font-size:19px;color:${INK};">BLG Creations</div>
            <div style="font-family:${SERIF};font-size:12px;color:${MUTED};margin:5px 0 12px;">Handmade with care</div>
            <a href="mailto:${ORDERS_EMAIL}" style="font-family:${SERIF};font-size:13px;color:${KRAFT_DARK};text-decoration:none;">${ORDERS_EMAIL}</a>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function customerHtml(data: OrderEmailData): string {
  const first = esc(data.customerName.split(' ')[0] || data.customerName);
  const inner = [
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'customer'),
    careBlock(),
    followBlock(),
  ].join(gap());
  return shell(
    `Your BLG Creations order ${data.reference} is confirmed`,
    `Thank you, ${first}`,
    'Your payment has been received and your order is confirmed. Here are the details.',
    inner,
  );
}

function ownerHtml(data: OrderEmailData): string {
  const contact = [
    `<span style="color:${INK};font-weight:bold;">${esc(data.customerName)}</span>`,
    `<a href="mailto:${esc(data.customerEmail)}" style="color:${KRAFT_DARK};text-decoration:none;">${esc(data.customerEmail)}</a>`,
    data.customerPhone ? esc(data.customerPhone) : '',
  ]
    .filter(Boolean)
    .join('<br>');
  const notesBlock = data.notes
    ? `${label('Notes')}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${INK};white-space:pre-line;">${esc(data.notes)}</p>`
    : '';
  const inner = [
    `${label('Customer')}<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.7;color:${BODY};">${contact}</p>`,
    `${label('Order ' + data.reference)}${itemsTable(data)}`,
    fulfilmentBlock(data, 'owner'),
    notesBlock,
  ]
    .filter(Boolean)
    .join(gap());
  return shell(
    `New order ${data.reference} — ${money(data.subtotal + data.shipping)}`,
    `New order &mdash; ${esc(data.reference)}`,
    '',
    inner,
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

export interface ReviewRequestData {
  reference: string;
  customerName: string;
  customerEmail: string;
}

function reviewRequestHtml(data: ReviewRequestData): string {
  const first = esc(data.customerName.split(' ')[0] || data.customerName);
  const inner = [reviewInviteBlock(data.reference), followBlock()].join(gap());
  return shell(
    'How are you enjoying your BLG Creations order?',
    `Hi ${first}`,
    `We hope your order (${esc(data.reference)}) arrived safely and you&rsquo;re loving it. If you have a moment, we&rsquo;d be so grateful for a quick review.`,
    inner,
  );
}

/**
 * Send the "leave a review" email to the buyer. Returns true ONLY on a
 * successful send, so callers (cron + admin button) stamp review_invite_sent_at
 * only when the email actually went out. Never throws.
 */
export async function sendReviewRequestEmail(data: ReviewRequestData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM missing — skipping review email for', data.reference);
    return false;
  }
  try {
    // No explicit Reply-To (as with the order emails): a reply goes to the From
    // address (orders@blgcreations.co.uk), the mailbox the owner reads.
    await new Resend(apiKey).emails.send({
      from,
      to: data.customerEmail,
      subject: 'How are you enjoying your BLG Creations order?',
      html: reviewRequestHtml(data),
    });
    return true;
  } catch (e) {
    console.error('[email] review request failed for', data.reference, e);
    return false;
  }
}
