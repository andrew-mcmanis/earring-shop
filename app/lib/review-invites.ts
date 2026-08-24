import { createServiceClient } from './supabase';
import { sendReviewRequestEmail } from './email';

// Days after payment before the review email is sent. A once-daily cron, so it's
// "at least this many days".
const REVIEW_DELAY_DAYS = 5;

interface EligibleOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
}

export interface ReviewInviteRun {
  ok: boolean;
  considered: number;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Send the delayed review invite to every order that's due: paid >= N days ago,
 * eligible for the automatic job (auto_review_invite — excludes the pre-launch
 * backlog), not cancelled/refunded, not already sent. Stamps each on success so
 * it never repeats. Shared by the daily cron (folded into /api/keep-alive) and
 * the /api/review-invites manual trigger. Never throws.
 */
export async function sendDueReviewInvites(): Promise<ReviewInviteRun> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true, considered: 0, sent: 0, failed: 0 };
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
    return { ok: false, considered: 0, sent: 0, failed: 0, error: error.message };
  }

  const orders = (data ?? []) as EligibleOrder[];
  let sent = 0;
  let failed = 0;
  for (const o of orders) {
    const reference = `BLG-${o.order_number}`;
    const okSent = await sendReviewRequestEmail({
      reference,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
    });
    if (!okSent) {
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

  return { ok: true, considered: orders.length, sent, failed };
}
