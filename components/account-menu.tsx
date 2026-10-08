'use client';

import Link from 'next/link';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuthSession } from '@/components/auth-session';

export function AccountMenu({ tone }: { tone: 'light' | 'dark' }) {
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
  const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${tone === 'light' ? 'bg-action text-on-action hover:bg-action-hover' : 'bg-white text-black hover:bg-neutral-200'}`;
  if (session === undefined) return <button className={button} disabled aria-busy="true">Sign in</button>;
  if (!session) return <div className="relative"><Link href="/train" className={button} title={sessionError || undefined}>Sign in</Link>{error && <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-edge bg-page p-4 text-sm text-ink shadow-lg">{error}</p>}</div>;
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
  return <div ref={container} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={button} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <UserRound size={16} aria-hidden="true" />Account<ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div id={panelId} role="group" aria-label="Your account" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-edge bg-page p-2 text-sm text-ink shadow-lg">
      <div className="border-b border-edge px-3 py-3"><p className="text-xs text-muted">Signed in as</p><p className="mt-1 break-all font-medium">{session.user.email || 'Your account'}</p></div>
      <Link href="/train" className="mt-1 flex min-h-11 items-center rounded-md px-3 hover:bg-surface" onClick={() => setOpen(false)}>Your workspace</Link>
      <Link href="/billing" className="flex min-h-11 items-center rounded-md px-3 hover:bg-surface" onClick={() => setOpen(false)}>Billing</Link>
      <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left hover:bg-surface disabled:opacity-60" disabled={busy} onClick={signOut}><LogOut size={16} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
      {error && <p role="alert" className="px-3 py-2 text-danger">{error}</p>}
    </div>}
  </div>;
}
