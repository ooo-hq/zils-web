'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuthSession } from '@/components/auth-session';
import { ThemeToggle } from '@/components/theme';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { sendSignInLink, signInWithGoogle } from '@/lib/training-auth';
import form from './form-page.module.css';
import css from './sign-in-panel.module.css';

const TAGS = [
  { label: 'Billing', color: 'var(--zs-lane-billing)', left: '6%', top: 18 },
  { label: 'Account changes', color: 'var(--zs-lane-account)', left: '30%', top: 72 },
  { label: 'Technical support', color: 'var(--zs-lane-tech)', left: '62%', top: 18 },
  { label: 'Needs review', color: 'var(--zs-lane-review)', left: '72%', top: 126 },
];
const BARS = [55, 40, 70, 60, 85, 100, 70, 90, 60, 35];
const CUT = [2, 6];
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED === 'true';

export function SignInPanel() {
  const router = useRouter();
  const { client, session, error: sessionError } = useAuthSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [lit, setLit] = useState(1);

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
    <div className={`zs ${css.auth}`}>
      <div className={css.art}>
        <div className={css.artTop}>
          <Link href="/" aria-label="Zils home" className={css.mark}><ZilsWordmark /></Link>
          <span className={css.label}>System 01</span>
        </div>
        <div className={css.say}>
          <p>Specialized models.<br />Decisions that are yours.</p>
          <span className={css.label}>Your workspace · training, models, usage</span>
        </div>
        <div className={css.tags} aria-hidden="true">
          {TAGS.map((t, i) => (
            <span key={t.label} className={`${css.tag} ${i === lit ? css.lit : ''}`} style={{ left: t.left, top: t.top, '--c': t.color } as CSSProperties}><i />{t.label}</span>
          ))}
        </div>
        <div className={css.bars} aria-hidden="true">
          {BARS.map((h, i) => <i key={i} className={CUT.includes(i) ? css.cut : ''} style={{ '--h': `${h}%`, '--i': i, backgroundPosition: `${Math.round(i * 100 / 9)}% 0` } as CSSProperties} />)}
        </div>
      </div>
      <div className={css.formHalf}>
        <div className={css.formTop}><ThemeToggle className={css.theme} /></div>
        <main id="main-content" tabIndex={-1} className={css.box}>
          {sent ? (
            <div role="status" className={css.done}>
              <h1>Check your email.</h1>
              <p>If that address has a workspace, a sign-in link is on its way.</p>
            </div>
          ) : (
            <form onSubmit={emailLink} aria-label="Sign in to Zils">
              <h1>Sign in.</h1>
              <p className={css.sub}>Open your Zils workspace.</p>
              {(error || sessionError) && <p role="alert" className={form.fpError} style={{ marginTop: 20 }}>{error || sessionError}</p>}
              {GOOGLE_ENABLED && <>
                <button type="button" className={css.google} disabled={busy !== null} onClick={google}>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
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
            </form>
          )}
          <p className={css.legal}>By signing in you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.</p>
        </main>
      </div>
    </div>
  );
}
