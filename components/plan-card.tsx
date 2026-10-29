'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { canChooseFree, termsOutdated, tierErrorAction, TERMS_PATH, type TierState, type tierApi } from '@/lib/account-tier';
import styles from '@/app/(home)/billing/billing.module.css';

type Api = ReturnType<typeof tierApi>;

export function PlanCard({ api }: { api: Api }) {
  const [state, setState] = useState<TierState | null>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [announce, setAnnounce] = useState('');
  const load = useCallback((signal?: AbortSignal) => {
    return api.get(signal).then(setState).catch(error => {
      if (signal?.aborted) return;
      setLoadFailed(true); setMessage(error instanceof Error ? error.message : 'Your plan could not be loaded.');
    });
  }, [api]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function choose(tier: 'free' | 'paid') {
    if (!state || busy) return;
    setBusy(true); setMessage(''); setAnnounce('');
    try {
      setState(await api.set(tier, tier === 'free' && consented, state.free.terms_version));
      setConsented(false);
      setAnnounce(tier === 'free' ? 'Plan changed to Free' : 'Plan changed to Paid');
    } catch (error) {
      const action = tierErrorAction(error);
      const text = error instanceof Error ? error.message : 'The plan could not be changed. Please try again.';
      if (action !== 'other') { setConsented(false); await api.get().then(setState).catch(() => {}); }
      setMessage(text);
    } finally { setBusy(false); }
  }

  if (!state) return <section className={styles.plan} aria-labelledby="plan-heading"><h2 id="plan-heading">Plan</h2>
    {loadFailed ? <><p role="alert" className={styles.error}>{message || 'Your plan could not be loaded.'}</p><button type="button" className={styles.button} onClick={() => { setLoadFailed(false); setMessage(''); load(); }}>Retry</button></> : <p role="status">Loading your plan…</p>}
  </section>;
  const free = state.tier === 'free';
  const outdated = termsOutdated(state);
  return <section className={styles.plan} aria-labelledby="plan-heading">
    <h2 id="plan-heading">Plan</h2>
    <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
    <p className={styles.planCurrent}>Current plan: <strong>{free ? 'Free' : 'Paid'}</strong></p>
    {outdated && <p role="alert" className={styles.error}>The free tier terms changed. Read them and agree again.</p>}
    <div className={styles.planChoices}>
      <div>
        <h3>Free</h3>
        <p>Served by the Zils network; requests and answers may be used to train models; {state.free.requests_per_minute} requests/min, {state.free.tokens_per_day / 1000}k tokens/day; base models only.</p>
        {!state.free.open && <p className={styles.planClosed}>Free tier is not open yet.</p>}
        <label className={styles.consent}>
          <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} disabled={!state.free.open || (free && !outdated)} />
          <span>I agree to the <Link href={TERMS_PATH} target="_blank">free tier terms<span className={styles.srOnly}> (opens in a new tab)</span></Link> (draft).</span>
        </label>
        <button type="button" className={styles.button} disabled={(free && !outdated) || busy || !canChooseFree(state, consented)} onClick={() => choose('free')}>{outdated ? 'Keep Free' : free ? 'Current plan' : 'Choose Free'}</button>
      </div>
      <div>
        <h3>Paid</h3>
        <p>Your prepaid credit pays for requests. Only Free tier requests may be used for training.</p>
        <button type="button" className={styles.button} disabled={!free || busy} onClick={() => choose('paid')}>{free ? 'Switch to Paid' : 'Current plan'}</button>
      </div>
    </div>
    {message && <p role="alert" className={styles.error}>{message}</p>}
  </section>;
}
