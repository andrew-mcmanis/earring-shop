import { createServerSupabase } from '../../lib/supabase-server';
import type { Order, OrderStatus } from '../../data/types';

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
  country: string;
  notes: string | null;
  subtotal: number | string;
  shipping: number | string;
  fulfilment_method: string;
  status: string;
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
    country: r.country,
    notes: r.notes,
    subtotal: Number(r.subtotal),
    shipping: Number(r.shipping ?? 0),
    fulfilmentMethod: r.fulfilment_method === 'pickup' ? 'pickup' : 'delivery',
    status: r.status as OrderStatus,
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
