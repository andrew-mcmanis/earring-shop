import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { getCategories } from '../../data/products';
import { getPickupDetails } from './queries';
import { DeliveryManager } from './DeliveryManager';

export const metadata = { title: 'Delivery · Admin' };

export default async function DeliveryPage() {
  const [categories, pickup] = await Promise.all([getCategories(), getPickupDetails()]);

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
        <h1 className="font-heading text-4xl font-bold text-ink">Delivery</h1>
        <p className="font-body text-sm text-ink-light mt-1 mb-8 max-w-prose">
          Set a delivery charge for each category, and the collection details customers see once
          they order a pickup.
        </p>
        <DeliveryManager categories={categories} pickup={pickup} />
      </main>
    </div>
  );
}
