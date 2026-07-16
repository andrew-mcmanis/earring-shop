import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '../lib/supabase-server';
import { signOut } from './actions';
import { getDashboardStats } from './queries';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  const stats = await getDashboardStats();
  const n = (v: number | null) => (v === null ? '—' : String(v));

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-white border-b border-cream-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</h1>
            <p className="font-body text-xs text-ink-light mt-0.5">Shop admin</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-body text-xs text-ink-light hidden sm:inline">{user.email}</span>
            <Link
              href="/"
              className="font-body text-sm text-ink hover:text-kraft transition-colors duration-150"
            >
              View shop
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="cursor-pointer font-body text-sm font-medium text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark transition-colors duration-150"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <h2 className="font-heading text-4xl font-bold text-ink">Welcome back</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/admin/products"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Products</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">{n(stats.productCount)}</p>
            <p className="font-body text-sm text-ink-light">
              {stats.soldOutCount === null
                ? 'Stock status unavailable'
                : stats.soldOutCount > 0
                  ? `${stats.soldOutCount} sold out`
                  : 'All in stock'}
            </p>
          </Link>

          <Link
            href="/admin/orders"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">New orders</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">{n(stats.newOrderCount)}</p>
            <p className="font-body text-sm text-ink-light">
              {stats.newOrderCount ? 'Awaiting action' : 'Nothing waiting'}
            </p>
          </Link>

          <Link
            href="/admin/labels"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Labels</h3>
            <p className="font-body text-3xl font-semibold text-ink tabular-nums">
              {stats.categoryCount === null || stats.colourCount === null
                ? '—'
                : stats.categoryCount + stats.colourCount}
            </p>
            <p className="font-body text-sm text-ink-light">
              {stats.categoryCount === null || stats.colourCount === null
                ? 'Categories & colours'
                : `${stats.categoryCount} categories · ${stats.colourCount} colours`}
            </p>
          </Link>

          <Link
            href="/admin/delivery"
            className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-1 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <h3 className="font-heading text-2xl font-bold text-ink">Delivery</h3>
            <p className="font-body text-sm text-ink-light mt-1">Set delivery rates & collection.</p>
          </Link>
        </div>

        <section aria-label="Latest orders" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-2xl font-bold text-ink">Latest orders</h3>
            <Link
              href="/admin/orders"
              className="font-body text-sm text-kraft-dark hover:text-kraft transition-colors duration-150"
            >
              View all
            </Link>
          </div>
          {stats.latestOrders.length === 0 ? (
            <p className="font-body text-sm text-ink-light bg-white border border-cream-dark rounded-lg px-4 py-6 text-center">
              No orders yet — they&apos;ll appear here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.latestOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href="/admin/orders"
                    className="bg-white border border-cream-dark rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-kraft transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
                  >
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">BLG-{o.orderNumber}</span>
                    <span className="font-body text-sm text-ink flex-1 min-w-[8rem]">{o.customerName}</span>
                    <span className="font-body text-sm font-semibold text-ink tabular-nums">£{(o.subtotal + o.shipping).toFixed(2)}</span>
                    <span className="font-body text-xs font-medium capitalize bg-cream-dark border border-kraft-light text-ink-light px-2 py-0.5 rounded">
                      {o.status}
                    </span>
                    <span className="font-body text-xs text-ink-light">
                      {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
