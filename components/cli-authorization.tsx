'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { authorizationDetails, authorizationReturnUrl, cliCallbackUrl, isAuthorizationId } from '@/lib/cli-authorization';
import { signInWithGoogle } from '@/lib/training-auth';
import styles from '@/app/(home)/train/train.module.css';

const restart = 'This sign-in request is invalid or expired. Start again with zils login in your terminal.';

export function CliAuthorization({ authorizationId }: { authorizationId: string | null }) {
  const { client, session, error } = useAuthSession();
  const clientId = process.env.NEXT_PUBLIC_ZILS_CLI_OAUTH_CLIENT_ID;
  if (!isAuthorizationId(authorizationId)) return <p role="alert" className={styles.error}>{restart}</p>;
  if (session === undefined) return <p role="status">Checking your Zils account…</p>;
  if (!isAuthorizationId(clientId) || !client) return <p role="alert" className={styles.error}>CLI sign-in is not configured here yet. Contact the Zils operator.</p>;
  return <>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {session ? <Consent key={`${session.user.id}:${authorizationId}`} client={client} clientId={clientId} userId={session.user.id} authorizationId={authorizationId} /> : <SignIn client={client} authorizationId={authorizationId} />}
  </>;
}

function SignIn({ client, authorizationId }: { client: SupabaseClient; authorizationId: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function signIn(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const returnUrl = authorizationReturnUrl(window.location.origin, authorizationId);
      const result = event
        ? await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: returnUrl } })
        : await signInWithGoogle(client, window.location.origin, new URL(returnUrl).pathname + new URL(returnUrl).search);
      if (result.error) throw result.error;
      if (event) setNotice('Check your email for a sign-in link. Open it on this computer to approve the CLI request. Keep the terminal open.');
    } catch {
      setError('Sign-in could not start. Workspace access is by invitation; use your invited email or join the early-access list.');
    } finally { setBusy(false); }
  }
  return <section className={`${styles.panel} ${styles.signIn}`}>
    <h2>Sign in to Zils</h2><p>Use your invited Zils account to connect the terminal on this computer.</p>
    <p><Link href="/early-access" className="underline underline-offset-4">Join the early-access list</Link>. Joining does not create an account.</p>
    {process.env.NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED === 'true' && <button type="button" className={styles.secondary} disabled={busy} onClick={() => signIn()}>Sign in with Google</button>}
    <form onSubmit={signIn}><label htmlFor="cli-email">Email address</label><input id="cli-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /><button className={styles.button} disabled={busy}>{busy ? 'Opening sign-in…' : 'Email me a sign-in link'}</button></form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </section>;
}

function Consent({ client, clientId, userId, authorizationId }: { client: SupabaseClient; clientId: string; userId: string; authorizationId: string }) {
  const [details, setDetails] = useState<ReturnType<typeof authorizationDetails> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let current = true;
    client.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!current) return;
      if (error || !data) throw new Error('Invalid request');
      if ('redirect_url' in data) window.location.assign(cliCallbackUrl(data.redirect_url));
      else setDetails(authorizationDetails(data, clientId, authorizationId, userId));
    }).catch(() => { if (current) setError(restart); });
    return () => { current = false; active.current = false; };
  }, [client, clientId, authorizationId, userId]);

  async function decide(approve: boolean) {
    if (!details || busy) return;
    setBusy(true);
    try {
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId || !active.current) throw new Error('Account changed');
      const result = approve
        ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data) throw new Error('Consent failed');
      if (active.current) window.location.assign(cliCallbackUrl(result.data.redirect_url));
    } catch { if (active.current) setError(restart); }
    finally { if (active.current) setBusy(false); }
  }
  if (error) return <p role="alert" className={styles.error}>{error}</p>;
  if (!details) return <p role="status">Checking the CLI request…</p>;
  return <section className={styles.panel} aria-labelledby="cli-consent-title">
    <h2 id="cli-consent-title">Allow the Zils CLI to use your account?</h2>
    <p>Signed in as <strong>{details.user.email}</strong>.</p>
    <p>The Zils CLI will save an account session on this computer to submit datasets, follow training, cancel runs, and download accepted models. Approve only if you started <code>zils login</code> in your own terminal.</p>
    <p>This grants account access under your existing permissions. It is not limited to training and does not create an inference API key. Sign-in alone does not submit a training run.</p>
    <div className={styles.actions}><button className={styles.button} onClick={() => decide(true)} disabled={busy}>Approve</button><button className={styles.secondary} onClick={() => decide(false)} disabled={busy}>Deny</button></div>
    {busy && <p role="status">Returning to your terminal…</p>}
  </section>;
}
