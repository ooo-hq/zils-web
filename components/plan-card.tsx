'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { canChooseFree, tierErrorAction, TERMS_PATH, type TierState } from '@/lib/account-tier';
import type { tierApi } from '@/lib/account-tier';
import styles from '@/app/(home)/billing/billing.module.css';

type Api = ReturnType<typeof tierApi>;

export function PlanCard({ api }: { api: Api }) {
  const [state, setState] = useState<TierState | null>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api.get(controller.signal).then(setState).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Your plan could not be loaded.'); });
    return () => controller.abort();
  }, [api]);

  async function choose(tier: 'free' | 'paid') {
    if (!state || busy) return;
    setBusy(true); setMessage('');
    try { setState(await api.set(tier, tier === 'free' && consented, state.free.terms_version)); }
    catch (error) {
      const action = tierErrorAction(error);
      if (action === 'ask_again') { setConsented(false); await api.get().then(setState).catch(() => {}); }
      setMessage(error instanceof Error ? error.message : 'The plan could not be changed. Please try again.');
    } finally { setBusy(false); }
  }

  if (!state) return <section className={styles.plan} aria-labelledby="plan-heading"><h2 id="plan-heading">Plan</h2><p role={message ? 'alert' : 'status'}>{message || 'Loading your plan…'}</p></section>;
  const free = state.tier === 'free';
  return <section className={styles.plan} aria-labelledby="plan-heading">
    <h2 id="plan-heading">Plan</h2>
    <p className={styles.planCurrent}>Current plan: <strong>{free ? 'Free' : 'Paid'}</strong></p>
    <div className={styles.planChoices}>
      <div>
        <h3>Free</h3>
        <p>Served by the Zils network; requests and answers may be used to train models; {state.free.requests_per_minute} requests/min, {state.free.tokens_per_day / 1000}k tokens/day; base models only.</p>
        {!state.free.open && <p className={styles.planClosed}>Free tier is not open yet.</p>}
        <label className={styles.consent}>
          <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} disabled={!state.free.open || free} />
          <span>I agree to the <Link href={TERMS_PATH} target="_blank">free tier terms</Link> (draft).</span>
        </label>
        <button type="button" className={styles.button} disabled={free || busy || !canChooseFree(state, consented)} onClick={() => choose('free')}>{free ? 'Current plan' : 'Choose Free'}</button>
      </div>
      <div>
        <h3>Paid</h3>
        <p>Your prepaid credit pays for requests. Nothing is used for training by default.</p>
        <button type="button" className={styles.button} disabled={!free || busy} onClick={() => choose('paid')}>{free ? 'Switch to Paid' : 'Current plan'}</button>
      </div>
    </div>
    {message && <p role="alert" className={styles.error}>{message}</p>}
  </section>;
}
