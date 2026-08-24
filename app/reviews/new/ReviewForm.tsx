'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { submitReview, type ReviewFormState } from '../../lib/reviews';

const initialState: ReviewFormState = { status: 'idle' };

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-7 w-7 ${filled ? 'text-kraft' : 'text-kraft-light'}`} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.94L12 2.5z" />
    </svg>
  );
}

function StarPicker({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-body text-sm font-medium text-ink">
        Your rating<span className="text-kraft-dark"> *</span>
      </span>
      <input type="hidden" name="rating" value={value || ''} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
          >
            <Star filled={n <= active} />
          </button>
        ))}
      </div>
      {error && <p className="font-body text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function ReviewForm({ orderReference }: { orderReference: string | null }) {
  const [state, formAction, isPending] = useActionState(submitReview, initialState);
  const [rating, setRating] = useState(0);

  if (state.status === 'success') {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <h2 className="font-heading text-3xl font-bold text-ink">Thank you!</h2>
        <p className="font-body text-sm text-ink-light max-w-sm">
          Your review has been received — we really appreciate you taking the time to share it.
        </p>
        <Link
          href="/"
          className="mt-2 bg-kraft text-cream font-body text-sm font-medium px-5 py-2.5 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2"
        >
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {orderReference && <input type="hidden" name="ref" value={orderReference} />}

      {state.status === 'error' && state.message && (
        <div role="alert" className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">
          {state.message}
        </div>
      )}

      <StarPicker value={rating} onChange={setRating} error={state.fieldErrors?.rating} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reviewer_name" className="font-body text-sm font-medium text-ink">
          Your name<span className="text-kraft-dark"> *</span>
        </label>
        <input
          id="reviewer_name"
          name="reviewer_name"
          type="text"
          maxLength={80}
          autoComplete="name"
          aria-invalid={state.fieldErrors?.reviewer_name ? true : undefined}
          className={`font-body text-sm text-ink bg-white border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft ${
            state.fieldErrors?.reviewer_name ? 'border-red-500' : 'border-kraft-light focus:border-kraft'
          }`}
        />
        {state.fieldErrors?.reviewer_name && (
          <p className="font-body text-xs text-red-600" role="alert">{state.fieldErrors.reviewer_name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="font-body text-sm font-medium text-ink">
          Your review<span className="text-kraft-dark"> *</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={1000}
          placeholder="What did you love? How was it packaged? Would you buy again?"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className={`font-body text-sm text-ink bg-white border rounded px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-kraft ${
            state.fieldErrors?.body ? 'border-red-500' : 'border-kraft-light focus:border-kraft'
          }`}
        />
        {state.fieldErrors?.body && (
          <p className="font-body text-xs text-red-600" role="alert">{state.fieldErrors.body}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-kraft text-cream font-body text-sm font-semibold px-6 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Submit review'}
      </button>
    </form>
  );
}
