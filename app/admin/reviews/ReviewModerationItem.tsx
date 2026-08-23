'use client';

import { useState, useTransition } from 'react';
import type { Review } from '../../data/types';
import { setReviewApproved, updateReview, deleteReview } from './actions';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`h-4 w-4 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

export function ReviewModerationItem({ review }: { review: Review }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(review.reviewerName);
  const [body, setBody] = useState(review.body);
  const [rating, setRating] = useState(review.rating);

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  }

  return (
    <li className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <Stars rating={review.rating} />
          <p className="font-body text-sm font-medium text-ink">
            {review.reviewerName}
            {review.orderReference ? (
              <span className="text-ink-light font-normal"> · {review.orderReference}</span>
            ) : (
              <span className="text-amber-600 font-normal"> · no order ref</span>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border ${
            review.approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${review.approved ? 'bg-green-600' : 'bg-amber-500'}`} aria-hidden="true" />
          {review.approved ? 'Approved' : 'Pending'}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className="cursor-pointer p-0.5">
                <svg viewBox="0 0 24 24" className={`h-6 w-6 ${n <= rating ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
                  <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
                </svg>
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="Reviewer name"
            className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kraft"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-label="Review text"
            className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-kraft"
          />
        </div>
      ) : (
        <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-line">{review.body}</p>
      )}

      {error && <p role="alert" className="font-body text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-cream-dark pt-3">
        {editing ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => updateReview(review.id, { rating, reviewerName: name, body }))}
              className="cursor-pointer font-body text-xs font-semibold text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setEditing(false);
                setName(review.reviewerName);
                setBody(review.body);
                setRating(review.rating);
              }}
              className="cursor-pointer font-body text-xs text-ink-light hover:text-kraft"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => setReviewApproved(review.id, !review.approved))}
              className="cursor-pointer font-body text-xs font-medium text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60"
            >
              {review.approved ? 'Hide' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setEditing(true)}
              className="cursor-pointer font-body text-xs text-ink-light hover:text-kraft disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (confirm('Delete this review permanently?')) run(() => deleteReview(review.id));
              }}
              className="cursor-pointer font-body text-xs text-red-600 hover:text-red-700 disabled:opacity-60 ml-auto"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
