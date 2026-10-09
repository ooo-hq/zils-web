'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { trainingAuthStorageKey } from '@/lib/training-auth';

type AuthConfig = { url: string; key: string };
let browserClient: SupabaseClient | null = null;

function authClient(config?: AuthConfig) {
  if (typeof window === 'undefined') return null;
  if (browserClient) return browserClient;
  const url = config?.url || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = config?.key || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith('sb_secret_')) return null;
  try {
    browserClient = createClient(url, key, { auth: { storageKey: trainingAuthStorageKey(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return browserClient;
  } catch { return null; }
}

// The header and workspace share one client, refresh lock, and sign-out event.
export function useAuthSession(config?: AuthConfig) {
  const [client] = useState(() => authClient(config));
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const subscription = client?.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); if (next) setError(''); }
    });
    const pending = client?.auth.initialize().then(async ({ error: callbackError }) => {
      const current = await client.auth.getSession();
      // getSession reads stored credentials; OAuth callback failures are reported by initialize.
      return { ...current, error: current.error || (!current.data.session && callbackError ? { message: "Sign-in wasn't completed. Workspace access is by invitation; use your invited email or join the early-access list." } : null) };
    }) ?? Promise.resolve({ data: { session: null }, error: null });
    pending.then(({ data, error }) => {
      if (active) { setSession(data.session); if (error) setError(error.message); }
    }).catch(() => {
      if (active) { setSession(null); setError('Your session could not be checked. Please refresh and try again.'); }
    });
    return () => { active = false; subscription?.data.subscription.unsubscribe(); };
  }, [client]);
  return { client, session, error };
}
