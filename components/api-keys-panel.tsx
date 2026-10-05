'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { apiKeysApi, ApiKeyError, type ApiKey, type CreatedApiKey } from '@/lib/api-keys';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import training from '@/app/(home)/train/train.module.css';
import styles from './api-keys-panel.module.css';

type Props = { client: SupabaseClient; apiUrl: string | null; onExpired: () => Promise<void> };
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ApiKeysPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return <Sheet open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
    <SheetTrigger asChild><button className={training.secondary}><KeyRound size={16} aria-hidden="true" />API keys</button></SheetTrigger>
    <SheetContent className={`${training.page} ${training.trainingSheet}`} closeLabel="Close API keys" closeDisabled={pending}>
      <header className={training.sheetHeader}>
        <SheetTitle>API keys</SheetTitle>
        <SheetDescription>Connect your app to Zils.</SheetDescription>
      </header>
      {open && <KeyControls {...props} onPending={setPending} />}
    </SheetContent>
  </Sheet>;
}

function KeyControls({ client, apiUrl, onExpired, onPending }: Props & { onPending: (value: boolean) => void }) {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<CreatedApiKey | null>(null);
  const [busy, setBusy] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const life = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const secretInput = useRef<HTMLTextAreaElement>(null);
  const api = useMemo(() => apiUrl ? apiKeysApi(apiUrl, async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || '';
  }) : null, [apiUrl, client]);
  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiKeyError && error.status === 401) { void onExpired(); return; }
    setError(error instanceof ApiKeyError ? error.message : 'The key service could not complete this request.');
  }, [onExpired]);
  const load = useCallback((signal: AbortSignal) => {
    if (!api) return;
    return api.list(signal)
      .then(result => { if (!signal.aborted) setKeys(result.keys); })
      .catch(error => { if (!signal.aborted) handleError(error); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, [api, handleError]);
  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => { if (secret) secretInput.current?.focus(); }, [secret]);

  async function mutate(action: 'create' | 'revoke', id?: string) {
    const signal = life.current?.signal;
    if (!api || !signal || signal.aborted || mutation.current || loading) return;
    mutation.current = true; setBusy(id || 'create'); onPending(true); setError(''); setNotice('');
    try {
      if (action === 'create') {
        const result = await api.create(name, signal);
        if (signal.aborted) return;
        const { key: fullKey, ...item } = result;
        setKeys(previous => [item, ...(previous || [])]); setSecret({ ...item, key: fullKey }); setName(''); setCopied(false); setCopyError(false); setConfirmId('');
      } else if (id) {
        const result = await api.revoke(id, signal);
        if (signal.aborted) return;
        setKeys(previous => previous?.map(key => key.id === id ? result : key) || []);
        setConfirmId(''); setNotice(`“${result.name}” has been revoked. It can no longer make requests.`);
        nameInput.current?.focus();
      }
    } catch (error) {
      if (!signal.aborted) {
        handleError(error);
        if (!(error instanceof ApiKeyError && [400, 401, 403, 429].includes(error.status))) {
          setNotice(action === 'create'
            ? 'Creation was not confirmed. Check the refreshed list before trying again. Revoke any new key whose secret you did not receive.'
            : 'Revocation was not confirmed. Check the refreshed list before trying again.');
          setLoading(true); await load(signal);
        }
      }
    } finally {
      mutation.current = false;
      if (!signal.aborted) { setBusy(''); onPending(false); }
    }
  }
  function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void mutate('create'); }
  async function copy() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret.key); if (!life.current?.signal.aborted) { setCopied(true); setCopyError(false); } }
    catch { if (!life.current?.signal.aborted) { setCopyError(true); secretInput.current?.focus(); secretInput.current?.select(); } }
  }
  function dismissSecret() { setSecret(null); setCopied(false); setCopyError(false); requestAnimationFrame(() => nameInput.current?.focus()); }
  const active = keys?.filter(key => !key.revoked_at) || [];
  const revoked = keys?.filter(key => key.revoked_at) || [];

  if (!api) return <div className={training.sheetBody}><p className={training.error} role="alert">API keys are not configured in this environment.</p></div>;
  return <div className={`${training.sheetBody} ${styles.body}`}>
    <p className={styles.intro}>A key lets your app make predictions with models available to your account. Choose the model in each request.</p>
    {error && <p className={training.error} role="alert">{error}</p>}
    {notice && <p className={training.notice} role="status">{notice}</p>}
    {secret ? <section className={styles.secret} aria-labelledby="new-key-heading">
      <span className={styles.eyebrow}><Check size={14} aria-hidden="true" />Key created</span>
      <h3 id="new-key-heading">Save your key now.</h3>
      <p>This is the only time you can see the full key. Closing this panel hides it.</p>
      <label htmlFor="new-api-key">{secret.name}</label>
      <textarea id="new-api-key" ref={secretInput} readOnly rows={3} spellCheck={false} value={secret.key} onFocus={event => event.currentTarget.select()} aria-describedby="key-storage-note" />
      <div className={styles.secretActions}>
        <button className={training.button} onClick={copy}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy key'}</button>
        <button className={training.secondary} onClick={dismissSecret}>I’ve saved this key</button>
      </div>
      <p role="status" className={styles.copyStatus}>{copyError ? 'Copy was blocked. Select the key above and copy it manually.' : copied ? 'Key copied to your clipboard.' : ''}</p>
      <p id="key-storage-note" className={styles.storageNote}>Keep it in your app’s server settings. Don’t put it in browser code or share it publicly.</p>
    </section> : <form className={styles.create} onSubmit={create}>
      <h3>Create a key</h3>
      <label htmlFor="api-key-name">Key name</label>
      <p id="key-name-help" className={styles.hint}>A name to help you recognize where it’s used.</p>
      <div className={styles.createRow}>
        <input ref={nameInput} id="api-key-name" required maxLength={80} autoComplete="off" placeholder="e.g. Flight app — production" aria-describedby="key-name-help" value={name} onChange={event => setName(event.target.value)} disabled={Boolean(busy)} />
        <button className={training.button} disabled={Boolean(busy) || loading || keys === null || !name.trim()}><Plus size={16} aria-hidden="true" />{busy === 'create' ? 'Creating…' : 'Create key'}</button>
      </div>
    </form>}
    <section className={styles.keySection} aria-labelledby="active-keys-heading" aria-busy={loading}>
      <div className={styles.sectionHeading}><h3 id="active-keys-heading">Active keys{keys && <span>{active.length}</span>}</h3><button className={training.textButton} disabled={loading || Boolean(busy)} onClick={() => { setError(''); setLoading(true); if (life.current) void load(life.current.signal); }}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      {keys === null ? <p className={styles.empty} role="status">{loading ? 'Loading your keys…' : 'Your keys could not be loaded. Refresh to try again.'}</p> : active.length === 0 ? <div className={styles.empty}><KeyRound size={22} aria-hidden="true" /><p>No active keys yet.</p><span>Create one above to connect your app.</span></div> : <ul className={styles.keys}>{active.map(key => <li key={key.id}>
        <div className={styles.keyRow}><div><strong>{key.name}</strong><code>{key.prefix}…</code><span>Created {date(key.created_at)}</span></div><button className={training.textButton} aria-label={`Revoke ${key.name}`} disabled={Boolean(busy) || loading || Boolean(secret)} onClick={() => setConfirmId(key.id)}>Revoke</button></div>
        {confirmId === key.id && <div className={styles.confirm} role="group" aria-label={`Confirm revocation of ${key.name}`}><p>Revoke <strong>{key.name}</strong>?</p><p>Requests using this key will stop working. This can’t be undone.</p><div><button className={training.secondary} disabled={Boolean(busy)} onClick={() => setConfirmId('')}>Keep key</button><button className={styles.revoke} disabled={Boolean(busy) || loading} onClick={() => void mutate('revoke', key.id)}>{busy === key.id ? 'Revoking…' : 'Revoke key'}</button></div></div>}
      </li>)}</ul>}
    </section>
    {revoked.length > 0 && <details className={styles.revoked}><summary>Revoked keys <span>{revoked.length}</span></summary><ul className={styles.keys}>{revoked.map(key => <li key={key.id}><div className={styles.keyRow}><div><strong>{key.name}</strong><code>{key.prefix}…</code><span>Revoked {date(key.revoked_at!)}</span></div><span className={styles.inactive}>Inactive</span></div></li>)}</ul></details>}
    <footer className={styles.connection}><h3>Connect your app</h3><p>Use your key on your server to call the Zils API.</p><span>API base URL</span><code>{apiUrl}</code><a href="https://github.com/ooo-hq/zils/blob/main/docs/decision-api.md" target="_blank" rel="noreferrer">View API documentation <span aria-hidden="true">↗</span></a></footer>
  </div>;
}
