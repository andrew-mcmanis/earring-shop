import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True once the Supabase env vars are present (see SETUP.md / .env.local). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * Read-only client for public storefront queries. Uses the publishable
 * (anon) key, so Row Level Security still governs what it can see. No session
 * is persisted — these run server-side per request.
 */
export function createReadClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured — NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing.');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Privileged server-only client (service-role key). Bypasses RLS — use ONLY in
 * server code (Server Actions / Route Handlers), e.g. for Storage uploads.
 * Never import this into a Client Component.
 */
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role is not configured.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
