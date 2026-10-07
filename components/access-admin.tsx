'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AccessSession } from '@/components/access-session';
import type { AccessOverview, AuthConfig, Application } from '@/lib/early-access';
import styles from '@/app/(home)/admin/access/access.module.css';

export function AccessAdmin({ config }: { config: AuthConfig }) {
  return <AccessSession config={config}>{(client, session) => <AdminPanel client={client} session={session} />}</AccessSession>;
}

function AdminPanel({ client, session }: { client: SupabaseClient; session: Session }) {
  const [view, setView] = useState<AccessOverview | null>(null);
  const [filter, setFilter] = useState('waiting');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const pending = useRef(false);
  const revision = useRef(0);
  const api = useCallback(async (path: string, body?: object, signal?: AbortSignal) => {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('Your session expired. Sign in again.');
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: signal || AbortSignal.timeout(45_000), redirect: 'error' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }, [client]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const id = ++revision.current;
    await api(`/api/admin/access?status=${filter}&offset=${offset}`, undefined, signal).then(next => {
      if (!signal?.aborted && id === revision.current) { setView(next); setError(''); setLoading(false); }
    }, error => {
      if (!signal?.aborted && id === revision.current) { setView(null); setError(error instanceof Error ? error.message : 'Applications could not be loaded.'); setLoading(false); }
    });
  }, [api, filter, offset]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh, session.access_token]);
  async function act(email: string, action: 'approve' | 'resend' | 'pause') {
    if (pending.current) return;
    pending.current = true; setBusy(email); setError(''); setNotice('');
    try {
      const result = await api('/api/admin/access/invite', { email, action });
      setLoading(true); await refresh(); setNotice(result.message); if (action === 'approve') setInviteEmail('');
    } catch (error) { setError(error instanceof Error ? error.message : 'The request could not be completed.'); }
    finally { pending.current = false; setBusy(''); }
  }
  function directInvite(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void act(inviteEmail.trim(), 'approve'); }
  const formatted = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  function row(item: Application) {
    const status = item.display_status || item.status;
    return <article className={styles.card} key={item.id} aria-label={item.email}>
      <div className={styles.cardHeading}><div><h3>{item.email}</h3><p>Applied {formatted(item.created_at)}</p></div><span className={styles.badge}>{status}</span></div>
      <p className={styles.useCase}>{item.use_case || 'Invited directly.'}</p>
      {status === 'invited' && item.expires_at && <p className={styles.detail}>Spot reserved until {formatted(item.expires_at)}. {item.delivery_status === 'failed' ? 'Email delivery failed. Resend the invitation.' : item.delivery_status === 'pending' ? 'Email delivery has not been confirmed.' : 'Invitation email sent.'}</p>}
      <div className={styles.actions}>
        {['waiting', 'paused', 'expired'].includes(status) && <button className={styles.button} disabled={Boolean(busy)} onClick={() => void act(item.email, 'approve')}>{busy === item.email ? 'Updating…' : 'Approve & invite'}</button>}
        {status === 'invited' && <button className={styles.button} disabled={Boolean(busy)} onClick={() => void act(item.email, 'resend')}>{busy === item.email ? 'Updating…' : 'Resend invite'}</button>}
        {['active', 'invited'].includes(status) && <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => void act(item.email, 'pause')}>Pause access</button>}
      </div>
    </article>;
  }
  return <>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!view && !loading && <button className={styles.secondary} onClick={() => { setLoading(true); void refresh(); }}>Try again</button>}
    {view && <>
      <section className={styles.stats} aria-label="Early-access capacity"><div><strong>{view.allocated}<span> / {view.capacity}</span></strong><p>Spots allocated</p></div><div><strong>{view.waiting}</strong><p>Waiting for review</p></div><p>Active accounts and unexpired invitations use one spot each. A customer can have multiple Zils.</p></section>
      <section className={styles.direct}><div><h2>Invite someone directly</h2><p>Their spot is reserved for seven days.</p></div><form onSubmit={directInvite}><label className="sr-only" htmlFor="direct-invite-email">Email to invite</label><input id="direct-invite-email" type="email" autoComplete="email" maxLength={254} required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} disabled={Boolean(busy)} placeholder="you@company.com" /><button className={styles.button} disabled={Boolean(busy)}>Send invitation</button></form></section>
      <div className={styles.toolbar}><h2>Applications</h2><div><label htmlFor="access-filter">Show</label><select id="access-filter" value={filter} disabled={Boolean(busy)} onChange={event => { setLoading(true); setFilter(event.target.value); setOffset(0); }}><option value="waiting">Waiting</option><option value="invited">Invited</option><option value="active">Active</option><option value="expired">Expired</option><option value="paused">Paused</option><option value="all">Everyone</option></select><button className={styles.secondary} disabled={loading || Boolean(busy)} onClick={() => { setLoading(true); void refresh(); }}>Refresh</button></div></div>
      <div aria-busy={loading} className={styles.list}>{view.applications.map(row)}{!view.applications.length && !loading && <p className={styles.empty}>No {filter === 'all' ? '' : filter} applications yet.</p>}</div>
      <nav className={styles.pagination} aria-label="Application pages"><button className={styles.secondary} disabled={offset === 0 || loading || Boolean(busy)} onClick={() => { setLoading(true); setOffset(Math.max(0, offset - 50)); }}>Previous</button><span>{view.total ? `${offset + 1}–${Math.min(offset + 50, view.total)} of ${view.total}` : '0 applications'}</span><button className={styles.secondary} disabled={offset + 50 >= view.total || loading || Boolean(busy)} onClick={() => { setLoading(true); setOffset(offset + 50); }}>Next</button></nav>
    </>}
    {loading && <p role="status">Loading applications…</p>}
  </>;
}
