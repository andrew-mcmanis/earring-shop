// Server-side hand-off to the ClearInvoice app. Imported only by the
// `placeOrder` Server Action, so it never reaches the browser bundle.

export interface OrderLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderPayload {
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    city?: string;
    postcode?: string;
    country: string;
  };
  items: OrderLine[];
  subtotal: number;
  notes?: string;
  placedAt: string;
}

export interface ForwardResult {
  ok: boolean;
  /** Whether the order actually reached ClearInvoice (vs. only logged locally). */
  forwarded: boolean;
  /** Invoice number / reference returned by ClearInvoice, when available. */
  reference?: string;
  error?: string;
}

/**
 * Forwards a placed order to ClearInvoice so it shows up as an invoice.
 *
 * Until CLEARINVOICE_INTAKE_URL + CLEARINVOICE_INTAKE_SECRET are set, the
 * order is accepted and logged (so the shop is fully usable now); once the
 * ClearInvoice intake endpoint exists, set those env vars and orders flow
 * straight into the invoice list with no further changes here.
 */
export async function forwardOrderToClearInvoice(order: OrderPayload): Promise<ForwardResult> {
  const url = process.env.CLEARINVOICE_INTAKE_URL;
  const secret = process.env.CLEARINVOICE_INTAKE_SECRET;

  if (!url || !secret) {
    console.info(
      '[order] ClearInvoice intake not configured — order accepted but not forwarded:\n',
      JSON.stringify(order, null, 2),
    );
    return { ok: true, forwarded: false };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(order),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[order] ClearInvoice intake failed:', res.status, text);
      return { ok: false, forwarded: false, error: `Invoice service returned ${res.status}.` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      invoiceNumber?: string;
      reference?: string;
    };
    return { ok: true, forwarded: true, reference: data.invoiceNumber ?? data.reference };
  } catch (err) {
    console.error('[order] ClearInvoice intake error:', err);
    return { ok: false, forwarded: false, error: 'Could not reach the invoice service.' };
  }
}
