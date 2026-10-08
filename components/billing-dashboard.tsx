'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowUpRight, FlaskConical, RefreshCw } from 'lucide-react';
import { useAuthSession } from '@/components/auth-session';
import { billingApi, BillingError, TOPUP_AMOUNTS_CENTS, formatCredit, checkoutIntent, pendingCheckout, attachCheckout, settleCheckout, clearCheckout, type BillingSummary, type CheckoutIntent } from '@/lib/billing';
import styles from '@/app/(home)/billing/billing.module.css';

type Config = { url: string; key: string; apiUrl: string };
type Props = { config: Config; testPreview: boolean; checkoutReturn: 'success' | 'cancelled' | null };
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const labels = { topup: 'Credit added', inference: 'Model usage', training: 'Training run', refund: 'Refund' };

export function BillingDashboard(props: Props) {
  const { client, session, error } = useAuthSession(props.config);
  if (session === undefined) return <p className={styles.loading} role="status">Checking your session…</p>;
  if (!session || !client) return <section className={styles.empty}>
    <h2>Sign in to view billing</h2><p>Check your credit, manage top-ups, and view receipts for your account.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <Link href="/train" className={styles.button}>Sign in to Zils</Link>
  </section>;
  return <AccountBilling key={session.user.id} {...props} client={client} owner={session.user.id} />;
}

function AccountBilling({ config, client, owner, testPreview, checkoutReturn }: Props & { client: SupabaseClient; owner: string }) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [pending, setPending] = useState<CheckoutIntent | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expired, setExpired] = useState(false);
  const [stale, setStale] = useState(false);
  const life = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const api = useMemo(() => billingApi(config.apiUrl, async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user.id === owner ? data.session.access_token : '';
  }), [config.apiUrl, client, owner]);
  const scopeFor = useCallback((mode: string) => `${config.apiUrl}:${owner}:${mode}`, [config.apiUrl, owner]);
  const handleError = useCallback((error: unknown) => {
    setError(error instanceof BillingError ? error.message : 'Billing could not be loaded. Please refresh and try again.');
    setExpired(error instanceof BillingError && error.status === 401 && error.code !== 'billing_unavailable');
  }, []);
  const load = useCallback((signal: AbortSignal) => api.summary(signal)
    .then(result => {
      if (signal.aborted) return;
      setSummary(result); setStale(false); setExpired(false);
      const scope = scopeFor(result.mode);
      settleCheckout(window.localStorage, scope, result.payments);
      setPending(pendingCheckout(window.localStorage, scope));
    }).catch(error => {
      if (!signal.aborted) { setStale(true); handleError(error); }
    }).finally(() => { if (!signal.aborted) setRefreshing(false); }), [api, handleError, scopeFor]);
  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function refresh() {
    if (refreshing || busy || !life.current) return;
    setRefreshing(true); setError(''); void load(life.current.signal);
  }
  const canCheckout = summary?.mode === (testPreview ? 'test' : 'live') && !stale && !expired;
  async function topUp(amountCents: number) {
    const signal = life.current?.signal;
    if (!canCheckout || !summary || !signal || signal.aborted || mutation.current || refreshing) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    const scope = scopeFor(summary.mode);
    try {
      const intent = checkoutIntent(window.localStorage, scope, amountCents);
      setPending(intent);
      const checkout = await api.checkout(intent.amount_cents, intent.idempotency_key, signal);
      if (signal.aborted) return;
      attachCheckout(window.localStorage, scope, checkout.purchase_id);
      window.location.assign(checkout.url);
    } catch (error) {
      if (!signal.aborted) {
        if (error instanceof BillingError && (error.status === 410 || error.code === 'checkout_paid')) {
          try { clearCheckout(window.localStorage, scope); setPending(null); }
          catch (storageError) { handleError(storageError); return; }
          if (error.code === 'checkout_paid') {
            setNotice('Payment already confirmed.'); setRefreshing(true);
            await load(signal);
            return;
          }
        }
        handleError(error);
      }
    } finally { mutation.current = false; if (!signal.aborted) setBusy(false); }
  }

  return <>
    {(summary?.mode === 'test' || (!summary && testPreview)) && <section className={styles.testNotice} aria-labelledby="test-mode-heading"><FlaskConical size={20} aria-hidden="true" /><div><h2 id="test-mode-heading">Test mode</h2><p>Use Stripe test payments only. This credit is for testing and is separate from real money. Real paid access is not open.</p></div></section>}
    {checkoutReturn && <p className={styles.returnNotice} role="status">{checkoutReturn === 'success'
      ? 'You returned from checkout. Credit is added only after payment is confirmed. Refresh to check your latest balance and payment status.'
      : 'Checkout was cancelled. Refresh to check your latest balance. You can continue an unfinished checkout when you’re ready.'}</p>}
    {error && <p className={styles.error} role="alert">{error}{expired && <> <Link href="/train">Sign in again</Link>.</>}</p>}
    {notice && <p className={styles.returnNotice} role="status">{notice}</p>}
    <div className={styles.refreshRow}><span>{refreshing ? 'Updating billing…' : stale ? 'Billing details could not be refreshed.' : 'All amounts in USD.'}</span><button type="button" className={styles.textButton} onClick={refresh} disabled={refreshing || busy}><RefreshCw size={14} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    {!summary || expired ? <p className={styles.loading} role="status">{expired ? 'Sign in again to view your account.' : refreshing ? 'Loading your billing details…' : 'Your billing details are unavailable. Refresh to try again.'}</p> : <>
      <div className={styles.overview}>
        <section className={styles.credit} aria-labelledby="credit-heading">
          <h2 id="credit-heading">Available credit</h2>
          <p className={styles.amount}>{formatCredit(summary.available_nanos)}</p>
          <p className={styles.balanceNote}>Credit shared across your account.</p>
          <dl className={styles.balances}><div><dt>Total balance</dt><dd>{formatCredit(summary.balance_nanos)}</dd></div><div><dt>Reserved for work in progress</dt><dd>{formatCredit(summary.reserved_nanos)}</dd></div></dl>
          <div className={styles.allowance}><h3>Included training</h3><p>{summary.free_training_runs === 1 ? '1 standard run available' : `${summary.free_training_runs} standard runs available`}</p><span>Your first completed top-up includes one standard run without using your credit. Additional standard runs use $2 each.</span></div>
          {summary.mode !== 'off' && BigInt(summary.available_nanos) < 2_000_000_000n && <div className={styles.lowBalance}><strong>{BigInt(summary.available_nanos) <= 0n ? 'No available credit' : 'Low credit'}</strong><p>{BigInt(summary.available_nanos) <= 0n ? 'Add credit to cover new usage. Any included training allowance is shown above.' : 'Less than $2 is available. Add credit before your next paid training run.'}</p></div>}
        </section>
        <section className={styles.topUp} aria-labelledby="topup-heading">
          <h2 id="topup-heading">Add credit</h2><p>Choose a one-time top-up. No subscription or automatic recharge.</p>
          {!canCheckout && <p className={styles.unavailable}>{summary.mode === 'off' ? 'Payments are currently disabled.' : 'Top-ups are unavailable in this environment.'}</p>}
          <div className={styles.amounts}>{TOPUP_AMOUNTS_CENTS.map(amount => <button type="button" key={amount} onClick={() => void topUp(amount)} disabled={!canCheckout || busy || refreshing || !summary.topup_amounts_cents.includes(amount) || Boolean(pending)} aria-label={`Add $${amount / 100}`}><span>${amount / 100}</span><span>credit</span></button>)}</div>
          {pending && <div className={styles.pending}><p>An unfinished ${pending.amount_cents / 100} checkout is saved. Continue it to avoid starting the same purchase twice.</p><button type="button" className={styles.button} onClick={() => void topUp(pending.amount_cents)} disabled={!canCheckout || busy || refreshing}>{busy ? 'Opening checkout…' : `Continue $${pending.amount_cents / 100} checkout`}</button></div>}
          <p className={styles.checkoutNote}>{busy ? 'Opening secure checkout…' : 'Checkout opens securely on Stripe.'} Credit appears after payment is confirmed.</p>
          <Link href="/pricing" className={styles.pricingLink}>View pricing<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section>
      </div>
      <section className={styles.history} aria-labelledby="payments-heading"><h2 id="payments-heading">Payments & receipts</h2>
        {!summary.payments.length ? <p className={styles.emptyHistory}>No payments yet. Your completed top-ups and receipts will appear here.</p> : <ul className={styles.rows}>{summary.payments.map(payment => <li key={payment.id}><div><strong>${(payment.amount_cents / 100).toFixed(2)} top-up</strong><time dateTime={payment.created_at}>{date(payment.created_at)}</time></div><span className={styles.paymentStatus}>{payment.status === 'paid' ? 'Paid' : payment.status === 'refunded' ? 'Refunded' : payment.status === 'expired' ? 'Expired' : 'Pending'}</span>{payment.receipt_url ? <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" aria-label="Receipt">Receipt<ArrowUpRight size={13} aria-hidden="true" /></a> : <span className={styles.noReceipt}>{payment.status === 'pending' ? 'Awaiting payment' : 'No receipt'}</span>}</li>)}</ul>}
      </section>
      <section className={styles.history} aria-labelledby="activity-heading"><h2 id="activity-heading">Credit activity</h2>
        {!summary.transactions.length ? <p className={styles.emptyHistory}>No credit activity yet. Top-ups, usage, training, and refunds will appear here.</p> : <ul className={`${styles.rows} ${styles.activity}`}>{summary.transactions.map(transaction => <li key={transaction.id}><div><strong>{labels[transaction.kind]}</strong><time dateTime={transaction.created_at}>{date(transaction.created_at)}</time></div><span className={styles.transactionAmount}>{formatCredit(transaction.amount_nanos)}</span></li>)}</ul>}
      </section>
    </>}
  </>;
}
