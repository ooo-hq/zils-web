import type { SupabaseClient } from '@supabase/supabase-js';

type AuthStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;

export function signInWithGoogle(client: SupabaseClient, origin: string) {
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('/train', origin).href },
  });
}

/** Preserve active sessions and PKCE flows; use the Zils key for new sessions. */
export function trainingAuthStorageKey(storage?: AuthStorage): string {
  const current = 'zils-training-auth';
  const legacy = 'fez-training-auth';
  try {
    const source = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    if (!source || source.getItem(current) !== null) return current;
    for (let index = 0; index < source.length; index++) {
      const key = source.key(index);
      if (key === legacy || key === `${legacy}-code-verifier` || (key?.startsWith(`${legacy}-flow-`) && key.endsWith('-code-verifier')) || key === `${legacy}-flows-code-verifier`) return legacy;
    }
  } catch { /* Supabase handles unavailable browser storage with its memory fallback. */ }
  return current;
}
