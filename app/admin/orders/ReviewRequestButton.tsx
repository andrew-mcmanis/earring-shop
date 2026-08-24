'use client';

import { useState, useTransition } from 'react';
import { sendReviewInvite } from './actions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Request a review for one order on demand. Shows a send button until an invite
// has gone out, then the sent date + a guarded "Send again".
export function ReviewRequestButton({ orderId, sentAt }: { orderId: string; sentAt: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(sentAt);

  function send(confirmFirst: boolean) {
    if (confirmFirst && !confirm('A review request was already sent for this order. Send it again?')) return;
    startTransition(async () => {
      setError(null);
      const res = await sendReviewInvite(orderId);
      if (res?.error) setError(res.error);
      else setSent(new Date().toISOString());
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      {sent ? (
        <span className="inline-flex items-center gap-2 font-body text-xs text-ink-light">
          <span className="text-green-700">&#10003; Review requested {formatDate(sent)}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => send(true)}
            className="cursor-pointer text-kraft-dark hover:text-kraft underline underline-offset-2 disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send again'}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => send(false)}
          className="cursor-pointer inline-flex items-center gap-1.5 font-body text-xs font-medium px-2.5 py-1 rounded border border-kraft-light text-ink-light hover:border-kraft transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
        >
          {isPending ? 'Sending…' : 'Send review request'}
        </button>
      )}
      {error && (
        <span role="alert" className="font-body text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
