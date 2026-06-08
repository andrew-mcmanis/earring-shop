'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../lib/supabase-server';
import type { OrderStatus } from '../../data/types';

const VALID: OrderStatus[] = ['new', 'made', 'posted', 'cancelled'];

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  if (!VALID.includes(status)) return;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  await supabase.from('orders').update({ status }).eq('id', id);
  revalidatePath('/admin/orders');
}
