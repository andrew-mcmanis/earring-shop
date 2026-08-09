import { revalidatePath } from 'next/cache';
import { createServiceClient } from './supabase';

/**
 * Flip one-of-a-kind products to sold-out after a successful sale, and
 * revalidate the surfaces that show availability. Used by the payment webhook
 * (the normal path) and by the no-Stripe fallback in createOrderAndIntent.
 *
 * Deliberately NOT in a 'use server' file: it must never be a client-callable
 * RPC. Best-effort — callers wrap it so a failure never undoes a paid order.
 */
export async function flipProductsSoldOut(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return;
  const svc = createServiceClient();
  const { error } = await svc.from('products').update({ sold_out: true }).in('id', ids);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/admin/products');
  for (const id of ids) revalidatePath(`/product/${id}`);
}
