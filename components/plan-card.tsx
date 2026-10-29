'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BETA_PRICING } from '@/lib/pricing';
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

  const heading = <div className={styles.sectionRow}><h2 id="plan-heading" className={styles.sectionHeading}>Plan</h2></div>;
  if (!state) return <section className={styles.tier} aria-labelledby="plan-heading">{heading}
    <div className={styles.tierState}>
      {loadFailed
        ? <><p role="alert">{message || 'Your plan could not be loaded.'}</p><button type="button" className={styles.button} onClick={() => { setLoadFailed(false); setMessage(''); load(); }}>Try again</button></>
        : <p role="status">Loading your plan…</p>}
    </div>
  </section>;
  const free = state.tier === 'free';
  const outdated = termsOutdated(state);
  const current = <span className={styles.tierCurrent}><span className={styles.lamp} data-on aria-hidden="true" />Current plan</span>;
  const facts = (rows: [string, string][]) => <dl className={styles.tierFacts}>{rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>;
  const consentBox = <label className={styles.consent}>
    <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} />
    <span>I agree to the <Link href={TERMS_PATH} target="_blank">free tier terms<span className={styles.srOnly}> (opens in a new tab)</span></Link>.</span>
  </label>;
  return <section className={styles.tier} aria-labelledby="plan-heading">
    {heading}
    <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
    {outdated && <p className={styles.tierNotice} data-tone="info">The free tier terms changed. Agree to the new terms to keep Free.</p>}
    {message && <p role="alert" className={styles.tierNotice}>{message}</p>}
    <div className={styles.tierGrid}>
      <div className={styles.tierOption} data-current={free || undefined}>
        <div className={styles.tierTop}><h3 className={styles.tierName}>Free</h3>{free && current}</div>
        <p className={styles.tierPrice} data-free><strong>$0</strong></p>
        <p className={styles.tierLead}>Answered by the Zils network. Requests and answers may be used to train models.</p>
        {facts([
          ['Requests', `${state.free.requests_per_minute} a minute`],
          ['Input tokens', `${state.free.tokens_per_day.toLocaleString('en-US')} a day`],
          ['Models', 'Base models'],
          ['Training', 'May be used'],
        ])}
        <div className={styles.tierAction}>
          {free && !outdated ? null
            : !state.free.open ? <p>The free tier is not open yet.</p>
            : <>{consentBox}<button type="button" className={styles.button} disabled={busy || !canChooseFree(state, consented)} onClick={() => choose('free')}>{outdated ? 'Keep Free' : 'Switch to Free'}</button></>}
        </div>
      </div>
      <div className={styles.tierOption} data-current={!free || undefined}>
        <div className={styles.tierTop}><h3 className={styles.tierName}>Paid</h3>{!free && current}</div>
        <p className={styles.tierPrice}><strong>${BETA_PRICING.millionInputTokens.toFixed(2)}</strong><span>per million input tokens</span></p>
        <p className={styles.tierLead}>Answered by our own runtime and paid from your prepaid credit.</p>
        {facts([
          ['Requests', 'Account limit'],
          ['Input tokens', 'Your credit'],
          ['Models', 'All, including yours'],
          ['Training', 'Never used'],
        ])}
        <div className={styles.tierAction}>
          {free && <button type="button" className={styles.button} disabled={busy} onClick={() => choose('paid')}>Switch to Paid</button>}
        </div>
      </div>
    </div>
  </section>;
}
