import type { Review } from '../data/types';

// Display a reviewer as first name + last initial for privacy ("Jane D.").
function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`h-4 w-4 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

export function Testimonials({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section aria-label="Customer reviews" className="bg-cream-dark border-t border-kraft-light/50">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col items-center text-center gap-2 mb-8">
          <h2 className="font-heading text-4xl font-bold text-ink">Loved by customers</h2>
          <p className="font-body text-sm text-ink-light inline-flex items-center gap-2">
            <Stars rating={Math.round(avg)} />
            <span className="tabular-nums">
              {avg.toFixed(1)} from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </span>
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-3">
              <Stars rating={r.rating} />
              <p className="font-body text-sm text-ink leading-relaxed flex-1 whitespace-pre-line">{r.body}</p>
              <p className="font-body text-xs font-medium text-ink-light">
                {displayName(r.reviewerName)}
                {r.productName ? <span className="text-ink-light"> · {r.productName}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
