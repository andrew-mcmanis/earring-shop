import Link from 'next/link';

const footerLinks = [
  { href: '/returns', label: 'Returns' },
  { href: '/jewellery-care', label: 'Jewellery Care' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-cream-dark py-10 px-4 text-center">
      <p className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</p>
      <p className="font-body text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-ink-light mt-1.5">
        Handmade Jewellery &amp; Gifts
      </p>

      <nav
        aria-label="Footer"
        className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-body text-xs"
      >
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="py-1 text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="font-body text-xs text-ink-light mt-5">
        © {new Date().getFullYear()} BLG Creations · All rights reserved
        <span aria-hidden="true"> · </span>
        <Link
          href="/admin/login"
          className="inline-block py-1 -my-1 text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150"
        >
          Sign in
        </Link>
      </p>
    </footer>
  );
}
