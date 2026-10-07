'use client';

import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { workspaceAccess, type AuthConfig, type AccessVerdict } from '@/lib/early-access';
import styles from '@/app/(home)/train/train.module.css';

export function AccessSession({ config, children }: { config: AuthConfig; children: (client: SupabaseClient, session: Session) => ReactNode }) {
  const { client, session, error: sessionError } = useAuthSession(config);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const email = String(new FormData(event.currentTarget).get('email') || '').trim(); setBusy(true); setError('');
    if (!client) { setError('Sign-in is unavailable. Please refresh and try again.'); setBusy(false); return; }
    try {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin/access` } });
      if (error) throw error;
      setNotice('Check your email for a sign-in link. Only approved administrators can open this page.');
    } catch { setError('The sign-in link could not be sent. Please try again shortly.'); }
    finally { setBusy(false); }
  }
  if (session === undefined) return <p role="status">Checking your session…</p>;
  return <>
    {(error || sessionError) && <p role="alert" className={styles.error}>{error || sessionError}</p>}
    {session && client ? <div key={session.user.id}>{children(client, session)}</div> : <section className={`${styles.panel} ${styles.signIn}`}><h2>Administrator sign-in</h2><p>Use your designated admin email to review applications.</p><form onSubmit={signIn}><label htmlFor="admin-email">Email address</label><input id="admin-email" name="email" type="email" autoComplete="email" required disabled={busy} /><button className={styles.button} disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>{notice && <p role="status" className={styles.notice}>{notice}</p>}</section>}
  </>;
}

export function TrainingAccessGate({ owner, token, children }: { owner: string; token: string; children: ReactNode }) {
  const [state, setState] = useState<AccessVerdict | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/access/session', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Access could not be checked.'); return data; })
      .then(data => { if (!controller.signal.aborted) setState({ owner, token, status: data.status }); })
      .catch(error => { if (!controller.signal.aborted) setState({ owner, token, error: error instanceof Error ? error.message : 'Access could not be checked.' }); });
    return () => controller.abort();
  }, [owner, token, attempt]);
  const access = workspaceAccess(state, owner, token);
  if (access === 'active') return children;
  if (access === 'checking' || !state) return <p role="status">Checking your early access…</p>;
  const description = state.status === 'paused' ? 'Your early access is paused. Contact us if you need help.' : state.status === 'expired' ? 'Your invitation has expired. Contact us to request another spot.' : 'Your account needs an invitation before you can train Zils or create API keys.';
  return <section className={styles.panel}><h1>{state.error ? 'Access check unavailable' : 'Early access'}</h1><p role={state.error ? 'alert' : undefined}>{state.error || description}</p><div className={styles.actions}><Link href={state.status === 'paused' || state.status === 'expired' ? '/contact' : '/early-access'} className={styles.button}>{state.status === 'paused' || state.status === 'expired' ? 'Contact us' : 'Request early access'}</Link><button className={styles.secondary} onClick={() => { setState(null); setAttempt(n => n + 1); }}>Check again</button></div></section>;
}
