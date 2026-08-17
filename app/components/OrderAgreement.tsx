import Link from 'next/link';

/**
 * Fine-print agreement shown next to the order / pay button. Its job is to
 * *incorporate* the policies into the sale (so the Terms and Returns actually
 * bind the customer) and to evidence that the cooling-off / returns info was
 * put in front of them before payment.
 *
 * The policy links open in a NEW TAB on purpose: the checkout must never be
 * navigated away mid-purchase. The Stripe step holds a PaymentIntent client
 * secret in memory, so a same-tab navigation would discard the payment in
 * progress and lose the customer's typed details.
 */
function PolicyLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // text-ink (not kraft) at rest so the link clears 4.5:1 on cream; the
      // underline carries the affordance so meaning never rests on colour alone.
      // inline-block + py-1 give a comfortable tap target within the fine print.
      className="inline-block py-1 text-ink underline underline-offset-2 rounded-sm transition-colors duration-150 hover:text-kraft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

export function OrderAgreement({ className = '' }: { className?: string }) {
  return (
    <p className={`font-body text-xs text-ink-light leading-relaxed ${className}`}>
      By placing your order, you agree to our{' '}
      <PolicyLink href="/terms" label="Terms" />,{' '}
      <PolicyLink href="/privacy" label="Privacy Policy" /> and{' '}
      <PolicyLink href="/returns" label="Returns Policy" />.
    </p>
  );
}
