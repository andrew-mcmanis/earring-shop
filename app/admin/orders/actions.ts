'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../lib/supabase-server';
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
