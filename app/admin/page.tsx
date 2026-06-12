import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '../lib/supabase-server';
import { signOut } from './actions';

export const metadata = { title: 'Admin' };

const SECTIONS = [
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Add, edit and remove items. Set prices, categories and colours.',
    ready: true,
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'See incoming orders and mark them as made and posted.',
    ready: true,
  },
  {
    href: '/admin/labels',
    title: 'Labels',
    description: 'Manage categories, earring types and colours.',
    ready: true,
  },
];

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-white border-b border-cream-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-ink leading-none">BLG Creations</h1>
            <p className="font-body text-xs text-ink-light mt-0.5">Shop admin</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-body text-xs text-ink-light hidden sm:inline">{user.email}</span>
            <Link
              href="/"
              className="font-body text-sm text-ink hover:text-kraft transition-colors duration-150"
            >
              View shop
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="cursor-pointer font-body text-sm font-medium text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark transition-colors duration-150"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="font-heading text-4xl font-bold text-ink mb-6">Welcome back</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {SECTIONS.map((s) => {
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-2xl font-bold text-ink">{s.title}</h3>
                  {!s.ready && (
                    <span className="font-body text-[10px] uppercase tracking-wider text-ink-light bg-cream-dark px-2 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </div>
                <p className="font-body text-sm text-ink-light leading-relaxed">{s.description}</p>
              </>
            );
            return s.ready ? (
              <Link
                key={s.href}
                href={s.href}
                className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-2 hover:border-kraft hover:shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={s.href}
                className="bg-white border border-cream-dark rounded-lg p-5 flex flex-col gap-2 opacity-70"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
