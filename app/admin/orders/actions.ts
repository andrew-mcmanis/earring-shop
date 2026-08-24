'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../lib/supabase-server';
import { sendReviewRequestEmail } from '../../lib/email';
import type { OrderStatus } from '../../data/types';

const VALID: OrderStatus[] = ['new', 'made', 'posted', 'cancelled'];

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ error?: string }> {
  if (!VALID.includes(status)) return { error: 'Invalid status.' };
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/admin/orders');
  return {};
}

// Send a review-request email for one order on demand (admin button). Works on
// any paid, non-cancelled order — including the pre-launch backlog. Stamps
// review_invite_sent_at on success so the automatic job won't also send it.
export async function sendReviewInvite(id: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: order, error } = await supabase
    .from('orders')
    .select('order_number, customer_name, customer_email, payment_status, status')
    .eq('id', id)
    .maybeSingle();
  if (error || !order) return { error: 'Could not load the order.' };
  if (order.payment_status !== 'paid' || order.status === 'cancelled') {
    return { error: 'Review requests are only for paid, active orders.' };
  }

  const ok = await sendReviewRequestEmail({
    reference: `BLG-${order.order_number}`,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
  });
  if (!ok) return { error: 'The email could not be sent — check the email settings and try again.' };

  const { error: stampError } = await supabase
    .from('orders')
    .update({ review_invite_sent_at: new Date().toISOString() })
    .eq('id', id);
  if (stampError) return { error: `Sent, but failed to record it: ${stampError.message}` };

  revalidatePath('/admin/orders');
  return {};
}
