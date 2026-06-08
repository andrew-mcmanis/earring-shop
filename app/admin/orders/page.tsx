import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { adminGetOrders } from './queries';
import { OrderStatusControl } from './OrderStatusControl';
import type { OrderStatus } from '../../data/types';

export const metadata = { title: 'Orders · Admin · BLG Creations' };

const STATUS_STYLES: Record<OrderStatus, { label: string; dot: string; chip: string }> = {
  new: { label: 'New', dot: 'bg-kraft', chip: 'bg-kraft/10 text-kraft-dark border-kraft-light' },
  made: { label: 'Made', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  posted: { label: 'Posted', dot: 'bg-green-600', chip: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', dot: 'bg-ink-light', chip: 'bg-cream-dark text-ink-light border-kraft-light' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminOrdersPage() {
  const orders = await adminGetOrders();

  return (
    <div className="min-h-dvh bg-cream">
      <AdminHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/admin"
          className="font-body text-sm text-ink-light hover:text-kraft transition-colors duration-150 inline-flex items-center gap-1.5 mb-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>
        <h1 className="font-heading text-4xl font-bold text-ink mb-6">Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white border border-cream-dark rounded-lg flex flex-col items-center text-center gap-3 py-16 px-6">
            <h2 className="font-heading text-2xl font-bold text-kraft-light">No orders yet</h2>
            <p className="font-body text-sm text-ink-light max-w-xs">
              When a customer checks out, their order will appear here for you to make and post.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((o) => {
              const s = STATUS_STYLES[o.status] ?? STATUS_STYLES.new;
              return (
                <li key={o.id} className="bg-white border border-cream-dark rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="font-heading text-2xl font-bold text-ink leading-none">
                        Order #BLG-{o.orderNumber}
                      </h2>
                      <p className="font-body text-xs text-ink-light mt-1">{formatDate(o.createdAt)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${s.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                      {s.label}
                    </span>
                  </div>

                  {/* Items */}
                  <ul className="mt-4 flex flex-col gap-1.5 border-t border-cream-dark pt-3">
                    {o.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 font-body text-sm">
                        <span className="text-ink">
                          <span className="text-ink-light tabular-nums">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="text-ink tabular-nums">
                          £{(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 font-body text-sm font-semibold border-t border-cream-dark pt-2 mt-1">
                      <span className="text-ink">Total</span>
                      <span className="text-ink tabular-nums">£{o.subtotal.toFixed(2)}</span>
                    </li>
                  </ul>

                  {/* Customer + delivery */}
                  <div className="mt-4 border-t border-cream-dark pt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 font-body text-sm">
                    <p className="text-ink font-medium">{o.customerName}</p>
                    <p className="text-ink-light sm:text-right">
                      <a href={`mailto:${o.customerEmail}`} className="hover:text-kraft underline underline-offset-2">
                        {o.customerEmail}
                      </a>
                    </p>
                    {o.customerPhone && <p className="text-ink-light">{o.customerPhone}</p>}
                    <p className="text-ink-light sm:col-span-2">
                      {[o.address, o.city, o.postcode, o.country].filter(Boolean).join(', ')}
                    </p>
                    {o.notes && (
                      <p className="text-ink-light sm:col-span-2 mt-1">
                        <span className="font-medium text-ink">Notes:</span> {o.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-cream-dark pt-3 flex justify-end">
                    <OrderStatusControl id={o.id} status={o.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
