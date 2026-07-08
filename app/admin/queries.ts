import { createServerSupabase } from '../lib/supabase-server';

export interface DashboardOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  subtotal: number;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  productCount: number | null;
  soldOutCount: number | null;
  newOrderCount: number | null;
  categoryCount: number | null;
  colourCount: number | null;
  latestOrders: DashboardOrder[];
}

const EMPTY: DashboardStats = {
  productCount: null,
  soldOutCount: null,
  newOrderCount: null,
  categoryCount: null,
  colourCount: null,
  latestOrders: [],
};

// Glanceable numbers for /admin. Runs on the signed-in session (RLS), and any
// failure degrades to null counts — the dashboard renders placeholders rather
// than crashing.
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = await createServerSupabase();
    const head = { count: 'exact' as const, head: true };
    const [products, soldOut, newOrders, categories, colours, latest] = await Promise.all([
      supabase.from('products').select('*', head),
      supabase.from('products').select('*', head).eq('sold_out', true),
      supabase.from('orders').select('*', head).eq('status', 'new'),
      supabase.from('categories').select('*', head),
      supabase.from('colours').select('*', head),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, subtotal, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    return {
      productCount: products.count ?? null,
      soldOutCount: soldOut.count ?? null,
      newOrderCount: newOrders.count ?? null,
      categoryCount: categories.count ?? null,
      colourCount: colours.count ?? null,
      latestOrders: (latest.data ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        subtotal: Number(o.subtotal),
        status: o.status,
        createdAt: o.created_at,
      })),
    };
  } catch {
    return EMPTY;
  }
}
