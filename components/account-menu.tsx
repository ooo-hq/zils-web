'use client';

import Link from 'next/link';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuthSession } from '@/components/auth-session';
import css from '@/components/account-menu.module.css';

export function AccountMenu() {
  const { client, session, error: sessionError } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const button = css.btn;
  if (session === undefined) return <button className={button} disabled aria-busy="true">Early access</button>;
  if (!session) return <div className={css.wrap}><Link href="/sign-in" className={css.signin}>Sign in</Link><Link href="/early-access" className={button} title={sessionError || undefined}>Early access</Link>{error && <p role="alert" className={css.alert}>{error}</p>}</div>;
  async function signOut() {
    if (!client || busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setOpen(false);
    } catch {
      const current = await client.auth.getSession().catch(() => null);
      setError(!current || current.error ? 'Sign-out could not be confirmed. Please refresh and try again.' : current.data.session ? 'Sign-out failed. Please try again.' : 'Signed out on this device. Server sign-out could not be confirmed.');
    }
    finally { setBusy(false); }
  }
  return <div ref={container} className={css.wrap} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={button} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <UserRound size={14} aria-hidden="true" />Account<ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && <div id={panelId} role="group" aria-label="Your account" className={css.panel}>
      <div className={css.who}><p>Signed in as</p><p>{session.user.email || 'Your account'}</p></div>
      <Link href="/dashboard" className={css.item} onClick={() => setOpen(false)}>Your workspace</Link>
      <Link href="/billing" className={css.item} onClick={() => setOpen(false)}>Billing</Link>
      <button type="button" className={css.item} disabled={busy} onClick={signOut}><LogOut size={14} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
      {error && <p role="alert" className={css.err}>{error}</p>}
    </div>}
  </div>;
}
