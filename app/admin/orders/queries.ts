import { createServerSupabase } from '../../lib/supabase-server';
import type { Order, OrderStatus, PaymentStatus } from '../../data/types';

interface OrderItemRow {
  id: string;
  product_id: string | null;
  name: string;
  unit_price: number | string;
  quantity: number;
}

interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  recipient_name?: string | null;
  country: string;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  is_gift?: boolean;
  status: string;
  payment_status?: string | null;
  stripe_payment_intent?: string | null;
  paid_at?: string | null;
  refunded_amount?: number | string | null;
  refunded_at?: string | null;
  review_invite_sent_at?: string | null;
  created_at: string;
  order_items: OrderItemRow[];
}

function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    address: r.address,
    city: r.city,
    postcode: r.postcode,
    recipientName: r.recipient_name ?? null,
    country: r.country,
    notes: r.notes,
    subtotal: Number(r.subtotal),
    shipping: Number(r.shipping ?? 0),
    fulfilmentMethod: r.fulfilment_method === 'pickup' ? 'pickup' : 'delivery',
    isGift: r.is_gift ?? false,
    status: r.status as OrderStatus,
    paymentStatus: (r.payment_status as PaymentStatus | null) ?? 'unpaid',
    stripePaymentIntent: r.stripe_payment_intent ?? null,
    paidAt: r.paid_at ?? null,
    refundedAmount: r.refunded_amount == null ? null : Number(r.refunded_amount),
    refundedAt: r.refunded_at ?? null,
    reviewInviteSentAt: r.review_invite_sent_at ?? null,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
    })),
  };
}

export async function adminGetOrders(): Promise<Order[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as OrderRow[]).map(mapOrder);
}
