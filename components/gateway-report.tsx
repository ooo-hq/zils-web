'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useAuthSession } from '@/components/auth-session';
import { HighlightedCode } from '@/components/highlighted-code';
import { WorkspaceLoading } from '@/components/workspace-loading';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { gatewayTools, type GatewayTool } from '@/lib/gateway-tools';
import { relayAddress, relayReportApi, RelayReportError, shadowRows, type RelayQuestion, type RelayReport, type RelayStatus } from '@/lib/relay-report';
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

/** One tool's setup: numbered steps, each a highlighted block with its own copy button. */
function ToolSteps({ tool }: { tool: GatewayTool }) {
  const [copied, setCopied] = useState<{ step: number; ok: boolean } | null>(null);
  const copy = (step: number) => navigator.clipboard.writeText(tool.steps[step].code).then(() => setCopied({ step, ok: true }), () => setCopied({ step, ok: false }));
  return <div id={`gateway-tool-${tool.id}`} role="region" aria-label={`${tool.name} setup`} className={styles.panel}>
    <ol className={styles.steps}>{tool.steps.map((step, index) => <li key={step.title}>
      <p className={styles.stepTitle}><span>{index + 1}</span>{step.title}</p>
      <div className={styles.block}>
        <div className={styles.blockHead}><span>{step.label}</span><button aria-label={`Copy step ${index + 1}`} onClick={() => void copy(index)}>{copied?.step === index && copied.ok ? 'Copied' : 'Copy'}</button></div>
        <pre tabIndex={0} className={styles.snippet}><code><HighlightedCode code={step.code} language={step.language} /></code></pre>
      </div>
    </li>)}</ol>
    <p role="status" className={workspacePage.fine}>{copied && !copied.ok ? 'Copy was blocked. Select the text and copy it manually.' : ''}</p>
    {tool.note && <p className={styles.note}>{tool.note}</p>}
    <p className={workspacePage.fine}>Your provider key stays in your app’s environment, as it is today. Checked with {tool.checked}.</p>
  </div>;
}

type Collect = (on: boolean, termsVersion?: string) => Promise<void>;

/** The address to point an OpenAI client at, and the account's own switch for saving what passes through. */
function Setup({ status, address, collect }: { status: RelayStatus; address: string; collect: Collect }) {
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');
  const change = (on: boolean) => { setBusy(true); void collect(on, on ? status.terms_version : undefined).finally(() => { setBusy(false); setConfirming(false); setAgreed(false); }); };
  return <section aria-labelledby="gateway-setup">
    <Section label="Setup" id="gateway-setup" />
    <div className={workspacePage.split}>
      <div>
        <p className={workspacePage.label}>Your gateway address</p>
        <code className={styles.address}>{address}</code>
        <p className={workspacePage.sub}>Set it as the base URL of your OpenAI client. Your app keeps its own provider key and always gets your provider’s answer.</p>
        <p className={`${workspacePage.label} ${styles.requests}`}>Requests</p>
        <p className={workspacePage.sub}>{status.requests === 0 ? 'No request has come through this address yet.' : `${status.requests.toLocaleString()} ${status.requests === 1 ? 'request has' : 'requests have'} passed through.`}{status.requests > 0 && status.last_request_at && ` Last one around ${when(status.last_request_at)}.`}</p>
        {status.requests === 0 && <p className={workspacePage.fine}>Send any request from your app, wait a few seconds, then refresh. Only requests your provider answered are counted.</p>}
        <p className={workspacePage.fine}>Treat the address as private: anyone who has it can send requests that are saved to this account.</p>
      </div>
      <div>
        <p className={workspacePage.label}>Collection</p>
        {status.collecting_since ? <>
          <p className={workspacePage.sub}>Collecting since {when(status.collecting_since)}.</p>
          {confirming ? <div role="group" aria-label="Confirm stopping collection">
            <p className={workspacePage.sub}>Stopping deletes every saved message and comparison for this account now. Models already trained are kept. This can’t be undone.</p>
            <div className={styles.actions}><button className={training.secondary} disabled={busy} onClick={() => setConfirming(false)}>Keep collecting</button><button className={training.button} disabled={busy} onClick={() => change(false)}>{busy ? 'Stopping…' : 'Stop and delete'}</button></div>
          </div> : <div className={styles.actions}><button className={training.secondary} onClick={() => setConfirming(true)}>Stop collecting</button></div>}
        </> : <>
          <p className={workspacePage.sub}>Collection is off. Requests pass through and only their number is kept.</p>
          <ul className={styles.terms}>
            <li>When collection is on, Zils saves each request that asks for an answer from a fixed list, together with your provider’s answer. Other requests are not saved.</li>
            <li>Your provider key is used to pass the request on and is never saved.</li>
            <li>Saved messages are used to train and measure models for this account only.</li>
            <li>A saved message is deleted 90 days after it was last sent. Stopping collection deletes all of them at once.</li>
          </ul>
          <label className={styles.agree}><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>I agree to this, and I have the right to share these messages and answers with Zils.</span></label>
          <div className={styles.actions}><button className={training.button} disabled={!agreed || busy} onClick={() => change(true)}>{busy ? 'Starting…' : 'Start collecting'}</button></div>
        </>}
      </div>
    </div>
    <div className={styles.connect}>
      <p className={workspacePage.label}>Connect your app</p>
      <p className={workspacePage.sub}>Choose what your app uses to call OpenAI. Each one shows where the address goes and how to ask for an answer from a fixed list, which is what the gateway collects.</p>
      {gatewayTools(address).map(group => {
        const shown = group.tools.find(tool => tool.id === open);
        return <div key={group.label} className={styles.group}>
          <div className={styles.groupHead}><h3>{group.label}</h3><p>{group.intro}</p></div>
          <div className={styles.cards}>{group.tools.map(tool => <button key={tool.id} className={styles.card} aria-expanded={tool.id === open} aria-controls={`gateway-tool-${tool.id}`} onClick={() => setOpen(tool.id === open ? '' : tool.id)}>
            <span className={styles.cardName}>{tool.name}<span className={styles.tag}>{tool.tag}</span></span>
            <span className={styles.blurb}>{tool.blurb}</span>
          </button>)}</div>
          {shown && <ToolSteps key={shown.id} tool={shown} />}
        </div>;
      })}
    </div>
  </section>;
}

function Report({ client, apiUrl, relayUrl, onExpired }: { client: SupabaseClient; apiUrl: string; relayUrl: string; onExpired: () => Promise<void> }) {
  const [report, setReport] = useState<RelayReport | null>(null);
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const api = useMemo(() => relayReportApi(apiUrl, async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || '';
  }), [apiUrl, client]);
  // A service from before the setup routes answers 404 for the status: the report still shows.
  const load = useCallback((signal: AbortSignal) => Promise.all([api.get(signal), api.status(signal).catch(error => { if (error instanceof RelayReportError && error.status === 404) return null; throw error; })])
    .then(([result, relay]) => { if (!signal.aborted) { setReport(result); setStatus(relay); setError(''); } })
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
  const collect: Collect = (on, termsVersion) => api.collect(on, termsVersion)
    .then(async relay => { setStatus(relay); setError(''); await load(new AbortController().signal); })
    .catch(error => {
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setError(error instanceof RelayReportError ? error.message : 'Collection could not be changed. Please try again.');
      if (error instanceof RelayReportError && error.status === 409) return load(new AbortController().signal);
    });
  const refresh = <button disabled={loading} onClick={() => { setLoading(true); void load(new AbortController().signal); }}>{loading ? 'Refreshing…' : 'Refresh'}</button>;

  return <div>
    <PageHero title="Gateway" intro={INTRO} />
    {error && <p className={workspacePage.notice} role="alert">{error}</p>}
    {status?.relay_id && <Setup status={status} address={relayAddress(relayUrl, status.relay_id)} collect={collect} />}
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

/** The /gateway page: the relay's address and collection switch, what it has saved and how its shadow models compare. */
export function GatewayReportPage({ auth, apiUrl, relayUrl }: { auth: { url: string; key: string }; apiUrl: string; relayUrl: string }) {
  const { client, session } = useAuthSession(auth);
  if (session === undefined) return <WorkspaceLoading label="Loading your report" />;
  if (!session || !client) return <PageHero title="Gateway" intro="Sign in to see what your app has sent through the Zils gateway." action={<Link href="/train" className={training.button}>Sign in to Zils</Link>} />;
  return <Report key={session.user.id} client={client} apiUrl={apiUrl} relayUrl={relayUrl} onExpired={async () => { await client.auth.signOut({ scope: 'local' }); }} />;
}
