import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-cream-dark py-10 px-4 text-center">
      <p className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</p>
      <p className="font-body text-[10px] sm:text-xs font-medium tracking-[0.2em] uppercase text-ink-light mt-1.5">
        Handmade Jewellery &amp; Gifts
      </p>
      <p className="font-body text-xs text-ink-light mt-5">
        © {new Date().getFullYear()} BLG Creations · All rights reserved
        <span aria-hidden="true"> · </span>
        <Link
          href="/admin/login"
          className="text-ink-light hover:text-kraft underline underline-offset-2 transition-colors duration-150"
        >
          Sign in
        </Link>
      </p>
    </footer>
  );
}
