'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChartLine, FlaskConical, House, KeyRound, LogOut, SquareArrowOutUpRight } from 'lucide-react';
import { useAuthSession } from '@/components/auth-session';
import { ThemeToggle } from '@/components/theme';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { billingApi, formatCredit } from '@/lib/billing';
import { docsUrl } from '@/lib/shared';
import styles from './console-shell.module.css';

const LINKS = [
  { href: '/train', label: 'Home', icon: House },
  { href: '/playground', label: 'Playground', icon: FlaskConical },
  { href: '/billing', label: 'Usage', icon: ChartLine },
  { href: '/keys', label: 'API keys', icon: KeyRound },
] as const;

export function ConsoleNav({ auth, billingUrl }: { auth?: { url: string; key: string }; billingUrl: string | null }) {
  const path = usePathname();
  const { client, session } = useAuthSession(auth);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const owner = session?.user.id;
  const api = useMemo(() => client && billingUrl && owner ? billingApi(billingUrl, async () => {
    const { data } = await client.auth.getSession();
    return data.session?.user.id === owner ? data.session.access_token : '';
  }) : null, [client, billingUrl, owner]);
  useEffect(() => {
    if (!api) return;
    const controller = new AbortController();
    // The balance is a convenience; the billing page reports failures.
    api.summary(controller.signal).then(summary => setBalance(formatCredit(summary.available_nanos))).catch(() => {});
    return () => controller.abort();
  }, [api]);
  async function signOut() {
    if (!client || busy) return;
    setBusy(true); setSignOutError('');
    const { error } = await client.auth.signOut({ scope: 'local' }).catch(error => ({ error }));
    // Like the header menu: local sign-out still happens when the server call fails.
    if (error) setSignOutError('Signed out on this device. Server sign-out could not be confirmed.');
    setBusy(false);
  }
  const email = session?.user.email || 'Your account';
  return <aside className={styles.sidebar} aria-label="Workspace">
    <Link href="/" aria-label="Zils home" className={styles.brand}><ZilsWordmark className="text-[30px]" /></Link>
    <nav aria-label="Workspace navigation" className={styles.nav}>
      {LINKS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={styles.link} aria-current={path === href || path.startsWith(`${href}/`) ? 'page' : undefined}>
        <Icon size={15} aria-hidden="true" />{label}
      </Link>)}
      <a href={docsUrl} className={styles.link} target="_blank" rel="noreferrer"><BookOpen size={15} aria-hidden="true" />Documentation<SquareArrowOutUpRight size={12} aria-hidden="true" className={styles.external} /></a>
    </nav>
    <div className={styles.bottom}>
      {session && <Link href="/billing" className={styles.balance}><span>Balance</span><strong>{balance ?? '—'}</strong></Link>}
      <div className={styles.account}>
        {session ? <>
          <span className={styles.avatar} aria-hidden="true">{email[0].toUpperCase()}</span>
          <span className={styles.email} title={email}>{email}</span>
          <button type="button" className={styles.iconButton} onClick={signOut} disabled={busy} aria-label="Sign out" title="Sign out"><LogOut size={15} aria-hidden="true" /></button>
        </> : <span className={styles.email}>Not signed in</span>}
        <ThemeToggle />
      </div>
      {signOutError && <p role="alert" className={styles.alert}>{signOutError}</p>}
    </div>
  </aside>;
}
