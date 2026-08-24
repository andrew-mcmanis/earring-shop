import { createServiceClient } from '../../lib/supabase';
import { sendReviewRequestEmail } from '../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Days after payment before the review email is sent. A once-daily cron, so it's
// "at least this many days".
const REVIEW_DELAY_DAYS = 5;

interface EligibleOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
}

// Sends the delayed review invite to orders that are due. Triggered daily by a
// Vercel Cron (see vercel.json). New orders only (auto_review_invite), paid >= N
// days ago, not cancelled/refunded, not already sent. Idempotent.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: true, sent: 0, reason: 'supabase not configured' });
  }

  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - REVIEW_DELAY_DAYS * 86_400_000).toISOString();

  const { data, error } = await svc
    .from('orders')
    .select('id, order_number, customer_name, customer_email')
    .eq('payment_status', 'paid')        // excludes unpaid + refunded
    .eq('auto_review_invite', true)      // excludes the pre-launch backlog
    .is('review_invite_sent_at', null)
    .neq('status', 'cancelled')
    .lte('paid_at', cutoff)
    .limit(50);

  if (error) {
    console.error('[review-invites] query failed:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const orders = (data ?? []) as EligibleOrder[];
  let sent = 0;
  let failed = 0;
  for (const o of orders) {
    const reference = `BLG-${o.order_number}`;
    const ok = await sendReviewRequestEmail({
      reference,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
    });
    if (!ok) {
      failed++;
      continue; // leave unstamped — retry next run
    }
    const { error: stampError } = await svc
      .from('orders')
      .update({ review_invite_sent_at: new Date().toISOString() })
      .eq('id', o.id);
    if (stampError) {
      console.error('[review-invites] sent but failed to stamp', reference, stampError.message);
      failed++;
    } else {
      sent++;
    }
  }

  return Response.json({ ok: true, considered: orders.length, sent, failed });
}
