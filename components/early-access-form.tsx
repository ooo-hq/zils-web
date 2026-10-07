'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '@/app/(home)/contact/contact.module.css';

export function EarlyAccessForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sent) result.current?.focus(); }, [sent]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const form = new FormData(event.currentTarget);
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/access/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), useCase: form.get('useCase'), website: form.get('website') }),
        signal: AbortSignal.timeout(20_000), redirect: 'error',
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'Your request could not be saved. Please try again.');
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Your request could not be saved. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (sent) return <div ref={result} tabIndex={-1} role="status" className={styles.success}>
    <h2>You’re on the list.</h2><p>We’re inviting a small group to start. We’ll email you if a spot opens up for your project. Applying does not create an active account.</p><Link href="/playground" className={styles.button}>Try the playground</Link>
  </div>;
  return <form onSubmit={submit} className={styles.form} aria-label="Request early access">
    <div><label htmlFor="access-email">Email address</label><input id="access-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} placeholder="you@company.com" /></div>
    <div><label htmlFor="access-use-case">What would you like your Zils to decide?</label><p className={styles.hint} id="access-help">Tell us what you’re building and where a trained decision model would help.</p><textarea id="access-use-case" name="useCase" maxLength={2000} required rows={6} aria-describedby="access-help" disabled={busy} placeholder="For example: route support requests, choose a game action, or prioritize leads…" /></div>
    <input name="website" type="text" autoComplete="off" tabIndex={-1} aria-hidden="true" className={styles.honeypot} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.submitRow}><button className={styles.button} disabled={busy}>{busy ? 'Saving your request…' : 'Request early access'}</button></div>
    <p className={styles.note}>No payment or dataset needed. We’ll use your email for access updates. <Link href="/privacy">Privacy policy</Link>.</p>
  </form>;
}
