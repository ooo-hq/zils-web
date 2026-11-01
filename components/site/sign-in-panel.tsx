'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { sendSignInLink, signInWithGoogle } from '@/lib/training-auth';
import { AuthFrame, GoogleMark } from './auth-frame';
import form from './form-page.module.css';
import css from './sign-in-panel.module.css';

const TAGS = [
  { label: 'Billing', color: 'var(--zs-lane-billing)', left: '6%', top: 18 },
  { label: 'Account changes', color: 'var(--zs-lane-account)', left: '30%', top: 72 },
  { label: 'Technical support', color: 'var(--zs-lane-tech)', left: '62%', top: 18 },
  { label: 'Needs review', color: 'var(--zs-lane-review)', left: '72%', top: 126 },
];
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED === 'true';

export function SignInPanel() {
  const router = useRouter();
  const { client, session, error: sessionError } = useAuthSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [lit, setLit] = useState(1);

  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sent) result.current?.focus(); }, [sent]);
  useEffect(() => { if (session) router.replace('/train'); }, [session, router]);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setLit(i => (i + 1) % TAGS.length), 1800);
    return () => clearInterval(id);
  }, []);

  async function emailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy('email'); setError('');
    if (!client) { setError('Sign-in is unavailable. Please refresh and try again.'); setBusy(null); return; }
    try {
      const { error } = await sendSignInLink(client, email, window.location.origin);
      if (error?.code === 'otp_disabled' || error?.code === 'signup_disabled') {
        setError('Workspaces are invite-only for now. Use the email address that was invited, or get early access below.');
        return;
      }
      if (error) throw error;
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); } finally { setBusy(null); }
  }
  async function google() {
    if (!client || busy) return;
    setBusy('google'); setError('');
    try {
      const { error } = await signInWithGoogle(client, window.location.origin, '/train');
      if (error) throw error;
    } catch { setError('Google sign-in could not start. Please try again or use email.'); } finally { setBusy(null); }
  }

  return (
    <AuthFrame label="System 01" art={<>
      <div className={css.say}>
        <p>Specialized models.<br />Decisions that are yours.</p>
        <span className={css.label}>Your workspace · training, models, usage</span>
      </div>
      <div className={css.tags} aria-hidden="true">
        {TAGS.map((t, i) => (
          <span key={t.label} className={`${css.tag} ${i === lit ? css.lit : ''}`} style={{ left: t.left, top: t.top, '--c': t.color } as CSSProperties}><i />{t.label}</span>
        ))}
      </div>
    </>}>
      {session !== null ? <div className={css.done} aria-busy="true"><p>Opening your workspace…</p></div> : <>
        <div role="status" ref={result} tabIndex={-1} className={css.done}>
          {sent && <><h1>Check your email.</h1><p>If that address has a workspace, a sign-in link is on its way.</p></>}
        </div>
        {!sent && <form onSubmit={emailLink} aria-label="Sign in to Zils">
          <h1>Sign in.</h1>
          <p className={css.sub}>Open your Zils workspace.</p>
          {(error || sessionError) && <p role="alert" className={form.fpError} style={{ marginTop: 20 }}>{error || sessionError}</p>}
          {GOOGLE_ENABLED && <>
            <button type="button" className={css.google} disabled={busy !== null} onClick={google}>
              <GoogleMark />
              Continue with Google
            </button>
            <div className={css.or}><span className={form.fpLabel}>or</span></div>
          </>}
          <div className={form.fpField} style={GOOGLE_ENABLED ? undefined : { marginTop: 32 }}>
            <div className={form.fpTop}><label htmlFor="sign-in-email" className={form.fpLabel}>Email</label></div>
            <input id="sign-in-email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy === 'email'} />
          </div>
          <button type="submit" className={`${form.fpBtn} ${css.submit}`} disabled={busy !== null}>{busy === 'email' ? 'Sending…' : 'Email me a sign-in link'}</button>
          <p className={css.fine}>Workspaces are invite-only for now. New here? <Link href="/early-access">Get early access</Link></p>
        </form>}
      </>}
    </AuthFrame>
  );
}
