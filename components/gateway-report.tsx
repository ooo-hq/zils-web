'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useAuthSession } from '@/components/auth-session';
import { WorkspaceLoading } from '@/components/workspace-loading';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { relayReportApi, RelayReportError, shadowRows, type RelayQuestion, type RelayReport } from '@/lib/relay-report';
import training from '@/app/(home)/train/train.module.css';
import styles from './gateway-report.module.css';

const INTRO = 'Your app keeps calling its own provider through Zils. This is what passed through, and how closely your Zils model matches your provider’s answers.';
const when = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const answers = (name: string, values: (string | boolean)[]) => `${name}: ${values.every(value => typeof value === 'boolean') ? 'yes or no' : `${values.length} answers`}`;

function Question({ question, number }: { question: RelayQuestion; number: number }) {
  const id = `gateway-question-${number}`;
  return <section aria-labelledby={id}>
    <Section label={`Question ${number}`} id={id} />
    <div className={workspacePage.split}>
      <div>
        <p className={workspacePage.label}>Saved messages</p>
        <span className={workspacePage.amount}>{question.rows.toLocaleString()}</span>
        <p className={styles.quote}>“{question.instructions}”</p>
        <p className={workspacePage.fine}>{Object.entries(question.fields).map(([name, values]) => answers(name, values)).join(' · ')}</p>
        {question.last_at && <p className={workspacePage.fine}>Last saved {when(question.last_at)}</p>}
      </div>
      <div>
        {question.shadows.length === 0 ? <p className={workspacePage.sub}>No Zils model is being compared on this question yet.</p> : question.shadows.map(shadow => <div key={shadow.field} className={styles.shadow}>
          <p className={workspacePage.label}>Zils model on “{shadow.field}”</p>
          <code className={styles.model}>{shadow.model}</code>
          <div className={styles.tableWrap} role="region" aria-label={`Comparison for ${shadow.field}`} tabIndex={0}><table className={styles.table}>
            <thead><tr><th scope="col">Model’s confidence</th><th scope="col">Calls</th><th scope="col">Share</th><th scope="col">Matched your provider</th></tr></thead>
            <tbody>{shadowRows(shadow).map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.asked.toLocaleString()}</td><td>{row.share}</td><td>{`${row.agreed.toLocaleString()} (${row.agreement})`}</td></tr>)}</tbody>
          </table></div>
          <p className={workspacePage.fine}>Compared since {when(shadow.since)}. Your app always received your provider’s answer.{shadow.failed > 0 && ` ${shadow.failed.toLocaleString()} ${shadow.failed === 1 ? 'call' : 'calls'} got no answer from the model.`}</p>
        </div>)}
      </div>
    </div>
  </section>;
}

function Report({ client, apiUrl, onExpired }: { client: SupabaseClient; apiUrl: string; onExpired: () => Promise<void> }) {
  const [report, setReport] = useState<RelayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const api = useMemo(() => relayReportApi(apiUrl, async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || '';
  }), [apiUrl, client]);
  const load = useCallback((signal: AbortSignal) => api.get(signal)
    .then(result => { if (!signal.aborted) { setReport(result); setError(''); } })
    .catch(error => {
      if (signal.aborted) return;
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setError(error instanceof RelayReportError ? error.message : 'The report could not be loaded. Please try again.');
    })
    .finally(() => { if (!signal.aborted) setLoading(false); }), [api, onExpired]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const refresh = <button disabled={loading} onClick={() => { setLoading(true); void load(new AbortController().signal); }}>{loading ? 'Refreshing…' : 'Refresh'}</button>;

  return <div>
    <PageHero title="Gateway" intro={INTRO} />
    {error && <p className={workspacePage.notice} role="alert">{error}</p>}
    {!report ? <><Section label="Report" action={!loading && refresh} /><p className={styles.message} role="status">{loading ? 'Loading your report…' : 'Refresh to try again.'}</p></>
      : !report.relay ? <><Section label="Not set up" /><p className={styles.message}>The gateway is not set up for this account yet.</p></>
      : report.questions.length === 0 ? <><Section label="Questions" action={refresh} /><p className={styles.message}>No questions yet. {report.saving_since
        ? 'A question appears here once your app sends a request through the gateway that asks for an answer from a fixed list.'
        : 'Saving is off for this account, so nothing that passes through the gateway is kept.'}</p></>
      : <>
        <Section label={`${report.questions_total.toLocaleString()} ${report.questions_total === 1 ? 'question' : 'questions'}`} action={refresh} />
        {report.questions_total > report.questions.length && <p className={workspacePage.notice}>Showing the {report.questions.length} questions with the most recent saved messages.</p>}
        {report.questions.map((question, index) => <Question key={question.id} question={question} number={index + 1} />)}
      </>}
  </div>;
}

/** The /gateway page: what the account's relay has saved and how its shadow models compare. */
export function GatewayReportPage({ auth, apiUrl }: { auth: { url: string; key: string }; apiUrl: string }) {
  const { client, session } = useAuthSession(auth);
  if (session === undefined) return <WorkspaceLoading label="Loading your report" />;
  if (!session || !client) return <PageHero title="Gateway" intro="Sign in to see what your app has sent through the Zils gateway." action={<Link href="/train" className={training.button}>Sign in to Zils</Link>} />;
  return <Report key={session.user.id} client={client} apiUrl={apiUrl} onExpired={async () => { await client.auth.signOut({ scope: 'local' }); }} />;
}
