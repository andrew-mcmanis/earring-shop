import Link from 'next/link';
import { AdminHeader } from '../AdminHeader';
import { adminGetReviews } from './queries';
import { ReviewModerationItem } from './ReviewModerationItem';

export const metadata = { title: 'Reviews · Admin' };

export default async function AdminReviewsPage() {
  const reviews = await adminGetReviews();
  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

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
        <h1 className="font-heading text-4xl font-bold text-ink mb-6">Reviews</h1>

        {reviews.length === 0 ? (
          <div className="bg-white border border-cream-dark rounded-lg flex flex-col items-center text-center gap-3 py-16 px-6">
            <h2 className="font-heading text-2xl font-bold text-kraft-light">No reviews yet</h2>
            <p className="font-body text-sm text-ink-light max-w-xs">
              When a customer leaves a review, it&apos;ll appear here for you to approve.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-2xl font-bold text-ink">
                Pending{pending.length > 0 ? ` (${pending.length})` : ''}
              </h2>
              {pending.length === 0 ? (
                <p className="font-body text-sm text-ink-light">Nothing waiting — you&apos;re all caught up.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {pending.map((r) => (
                    <ReviewModerationItem key={r.id} review={r} />
                  ))}
                </ul>
              )}
            </section>

            {approved.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-heading text-2xl font-bold text-ink">Approved ({approved.length})</h2>
                <ul className="flex flex-col gap-4">
                  {approved.map((r) => (
                    <ReviewModerationItem key={r.id} review={r} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
