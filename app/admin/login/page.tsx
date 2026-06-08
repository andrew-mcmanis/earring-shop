'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '../../lib/supabase-browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-heading text-5xl font-bold text-ink">BLG Creations</h1>
          <p className="font-body text-sm text-ink-light mt-1">Shop admin — please sign in</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-cream-dark rounded-lg p-6 flex flex-col gap-4"
        >
          {error && (
            <p
              role="alert"
              className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-body text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="font-body text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-5 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center gap-3 text-ink-light">
            <span className="h-px flex-1 bg-cream-dark" />
            <span className="font-body text-xs">or</span>
            <span className="h-px flex-1 bg-cream-dark" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="cursor-pointer flex items-center justify-center gap-2 bg-white border border-kraft-light text-ink font-body text-sm font-medium px-5 py-2.5 rounded hover:border-kraft transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            Sign in with Google
          </button>
        </form>

        <p className="text-center mt-4">
          <Link href="/" className="font-body text-xs text-ink-light hover:text-kraft underline underline-offset-2">
            ← Back to shop
          </Link>
        </p>
      </div>
    </main>
  );
}
