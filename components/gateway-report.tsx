'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useAuthSession } from '@/components/auth-session';
import { HighlightedCode } from '@/components/highlighted-code';
import { LinkLoading, WorkspaceLoading } from '@/components/workspace-loading';
import { PageHero, Section, workspacePage } from '@/components/workspace-page';
import { gatewayProviders, gatewayTools, type GatewayTool } from '@/lib/gateway-tools';
import { ANSWER_FROM_COMPARED, agreement, relayAddress, relayReportApi, RelayReportError, shadowRows, type RelayQuestion, type RelayShadow, type RelayReport, type RelayStatus, outcomeRows, TRAIN_FROM_ROWS } from '@/lib/relay-report';
import training from '@/app/(home)/train/train.module.css';
import styles from './gateway-report.module.css';

const INTRO = 'Your app keeps calling its own provider through Zils. This is what passed through, and how closely your Zils model matches your provider’s answers.';
const when = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
const answers = (name: string, values: (string | boolean)[]) => `${name}: ${values.every(value => typeof value === 'boolean') ? 'yes or no' : `${values.length} answers`}`;

type Compare = (jobId: string) => Promise<void>;
type SetAnswering = (question: string, field: string, promise: number | null) => Promise<void>;
const whole = (share: number) => `${Math.round(share * 100)}%`;

/** A compared model answering in the provider's place: what it answers and how its checks went while it does, else the promises the comparison supports. Nothing for a service from before answering. */
function Answering({ question, shadow, set }: { question: string; shadow: RelayShadow; set: SetAnswering }) {
  const [chosen, setChosen] = useState<number | null>(null), [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false);
  const change = (promise: number | null) => { setBusy(true); void set(question, shadow.field, promise).finally(() => { setBusy(false); setConfirming(false); setChosen(null); }); };
  const on = shadow.answering;
  if (on) return <div className={styles.answering} role="group" aria-label="Answering what it is sure of">
    <p className={workspacePage.label}>Answering what it is sure of</p>
    <span className={workspacePage.amount}>{on.answered.toLocaleString()}</span>
    <p className={workspacePage.sub}>calls answered by this model since {when(on.since)}.</p>
    <p className={workspacePage.sub}>Answers calls itself when it is {whole(on.confidence_at_least)} or more confident, to match your provider on at least {whole(on.promise)} of them. Every other call goes to your provider as before.</p>
    <p className={workspacePage.sub}>{on.checked ? `${on.check_agreed.toLocaleString()} of ${on.checked.toLocaleString()} checked answers matched your provider (${agreement(on.check_agreed, on.checked)}).` : 'No answers checked yet.'}</p>
    <p className={workspacePage.fine}>One in twenty of the calls it is sure of still goes to your provider as a check. It stops by itself if the checks fall well below {whole(on.promise)}. Its answers carry the header X-Zils-Answered, and every call it is asked is charged to your Zils balance.</p>
    <div className={styles.actions}><button className={training.secondary} disabled={busy} onClick={() => change(null)}>{busy ? 'Stopping…' : 'Stop answering'}</button></div>
  </div>;
  if (!shadow.offers.length && !shadow.stopped) return null;
  const supported = shadow.offers.filter(offer => offer.cutoff);
  const offer = shadow.offers.find(found => found.promise === chosen && found.cutoff);
  return <div className={styles.answering} role="group" aria-label="Let this model answer what it is sure of">
    <p className={workspacePage.label}>Let this model answer what it is sure of</p>
    <p className={workspacePage.sub}>Your app receives your provider’s answer on every call today. Switched on, this model answers the calls it is sure of, faster and for less, and every other call still goes to your provider.</p>
    {shadow.stopped && <p className={workspacePage.sub} role="status">It stopped answering by itself on {when(shadow.stopped.at)}: {shadow.stopped.differed.toLocaleString()} of {shadow.stopped.checked.toLocaleString()} checked answers differed from your provider, too many for {whole(shadow.stopped.promise)}.</p>}
    {shadow.asked < ANSWER_FROM_COMPARED ? <p className={workspacePage.fine}>Available after {ANSWER_FROM_COMPARED.toLocaleString()} compared answers. So far: {shadow.asked.toLocaleString()}.</p>
      : !supported.length ? <p className={workspacePage.fine}>The comparison so far does not support answering: the model does not match your provider closely enough at any confidence.</p>
      : confirming && offer?.cutoff ? <div role="group" aria-label="Confirm answering">
        <p className={workspacePage.sub}>Your app will receive this model’s answer, not your provider’s, on calls it is at least {whole(offer.cutoff.confidence_at_least)} confident about. So far it matched your provider on {offer.cutoff.agreed.toLocaleString()} of {offer.cutoff.asked.toLocaleString()} such answers; some of its answers will differ. Those calls are not sent to your provider and are charged to your Zils balance.</p>
        <div className={styles.actions}><button className={training.secondary} disabled={busy} onClick={() => setConfirming(false)}>Not now</button><button className={training.button} disabled={busy} onClick={() => change(offer.promise)}>{busy ? 'Starting…' : 'Start answering'}</button></div>
      </div> : <>
        <fieldset className={styles.promises}>
          <legend className={workspacePage.fine}>Match your provider on at least</legend>
          {shadow.offers.map(found => <label key={found.promise} className={styles.promise}>
            <input type="radio" name={`promise-${question}-${shadow.field}`} disabled={!found.cutoff} checked={chosen === found.promise} onChange={() => setChosen(found.promise)} />
            <span><strong>{whole(found.promise)}</strong> <span className={workspacePage.fine}>{found.cutoff ? `Answers when it is ${whole(found.cutoff.confidence_at_least)} or more confident. So far it matched your provider on ${found.cutoff.agreed.toLocaleString()} of ${found.cutoff.asked.toLocaleString()} such answers.` : 'Not supported by the comparison yet.'}</span></span>
          </label>)}
        </fieldset>
        <div className={styles.actions}><button className={training.button} disabled={!offer} onClick={() => setConfirming(true)}>Start answering</button></div>
      </>}
  </div>;
}

/** The runs trained from a question. Where comparison is open to the account, a ready one can become the model compared on its field; replacing another model is confirmed first. */
function Runs({ question, compare }: { question: RelayQuestion; compare: Compare | null }) {
  const [confirming, setConfirming] = useState(''), [busy, setBusy] = useState('');
  if (!question.trainings.length) return null;
  const start = (jobId: string) => { setBusy(jobId); void compare?.(jobId).finally(() => { setBusy(''); setConfirming(''); }); };
  return <>
    <p className={`${workspacePage.label} ${styles.requests}`}>Models trained from this question</p>
    <ul className={styles.runs} aria-label="Models trained from this question">{question.trainings.map(run => {
      const current = question.shadows.find(shadow => shadow.field === run.field);
      const compared = run.state === 'ready' && current?.model === run.model;
      return <li key={run.job_id}>
        <span className={styles.run}><Link href={run.state === 'ready' ? `/models/${run.job_id}` : `/train?run=${run.job_id}`}>{run.name}</Link><span className={workspacePage.status} data-tone={run.state === 'training' ? 'busy' : undefined}>{compared ? 'Being compared' : run.state === 'ready' ? 'Ready' : run.state === 'training' ? 'Training' : 'Did not pass'}</span></span>
        {run.evaluation && <p className={workspacePage.fine}>Gave your provider’s answer on {percent(run.evaluation.accuracy)} of the test examples held back from training. The model it started from: {percent(run.evaluation.baseline_accuracy)}.</p>}
        {compare && run.state === 'ready' && !compared && (confirming === run.job_id && current ? <div role="group" aria-label="Confirm replacing the compared model">
          <p className={workspacePage.fine}>This replaces {current.model} on “{run.field}” and starts its counts again.</p>
          <div className={styles.actions}><button className={training.secondary} disabled={Boolean(busy)} onClick={() => setConfirming('')}>Keep it</button><button className={training.button} disabled={Boolean(busy)} onClick={() => start(run.job_id)}>{busy === run.job_id ? 'Replacing…' : 'Replace it'}</button></div>
        </div> : <div className={styles.actions}><button className={training.secondary} disabled={Boolean(busy)} onClick={() => current ? setConfirming(run.job_id) : start(run.job_id)}>{busy === run.job_id ? 'Starting…' : 'Compare this model'}</button></div>)}
      </li>;
    })}</ul>
  </>;
}

function Question({ question, number, compare, setAnswering }: { question: RelayQuestion; number: number; compare: Compare | null; setAnswering: SetAnswering }) {
  const id = `gateway-question-${number}`;
  // The newest finished run that was scored: what the account has to go on before any comparison.
  const scored = question.trainings.find(run => run.evaluation)?.evaluation;
  return <section aria-labelledby={id}>
    <Section label={`Question ${number}`} id={id} />
    <div className={workspacePage.split}>
      <div>
        <p className={workspacePage.label}>Saved messages</p>
        <span className={workspacePage.amount}>{question.rows.toLocaleString()}</span>
        <p className={styles.quote}>“{question.instructions || Object.keys(question.fields).join(', ')}”</p>
        <p className={workspacePage.fine}>{Object.entries(question.fields).map(([name, values]) => answers(name, values)).join(' · ')}</p>
        {question.last_at && <p className={workspacePage.fine}>Last saved {when(question.last_at)}</p>}
        {(question.shadows.length > 0 || scored) && question.rows >= TRAIN_FROM_ROWS && <div className={styles.actions}><Link className={training.button} href={`/train/new?gateway=${question.id}`}>Train a model from these answers</Link></div>}
        <Runs question={question} compare={compare} />
      </div>
      <div>
        {question.shadows.length === 0 ? (scored ? <>
          <p className={styles.offer}>Your model gave your provider’s answer on {percent(scored.accuracy)} of test examples.</p>
          <p className={workspacePage.sub}>The model it started from gave it on {percent(scored.baseline_accuracy)}. Both were measured on examples held back from training.</p>
        </> : question.rows >= TRAIN_FROM_ROWS ? <>
          <p className={styles.offer}>Train a Zils model on these {question.rows.toLocaleString()} answers.</p>
          <p className={workspacePage.sub}>It learns to give your provider’s answer to this question.</p>
          <div className={styles.actions}><Link className={training.button} href={`/train/new?gateway=${question.id}`}>Train a model from these answers</Link></div>
        </> : <>
          <p className={workspacePage.sub}>No Zils model is being compared on this question yet.</p>
          <p className={workspacePage.fine}>Training opens at {TRAIN_FROM_ROWS} saved messages.</p>
        </>) : question.shadows.map(shadow => <div key={shadow.field} className={styles.shadow}>
          <p className={workspacePage.label}>Zils model on “{shadow.field}”</p>
          <code className={styles.model}>{shadow.model}</code>
          <div className={styles.tableWrap} role="region" aria-label={`Comparison for ${shadow.field}`} tabIndex={0}><table className={styles.table}>
            <thead><tr><th scope="col">Model’s confidence</th><th scope="col">Calls</th><th scope="col">Share</th><th scope="col">Matched your provider</th></tr></thead>
            <tbody>{shadowRows(shadow).map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.asked.toLocaleString()}</td><td>{row.share}</td><td>{`${row.agreed.toLocaleString()} (${row.agreement})`}</td></tr>)}</tbody>
          </table></div>
          <p className={workspacePage.fine}>Compared since {when(shadow.since)}.{!shadow.answering && !shadow.stopped && ' Your app always received your provider’s answer.'}{shadow.failed > 0 && ` ${shadow.failed.toLocaleString()} ${shadow.failed === 1 ? 'call' : 'calls'} got no answer from the model.`}</p>
          <Answering question={question.id} shadow={shadow} set={setAnswering} />
        </div>)}
      </div>
    </div>
  </section>;
}

/** One tool's setup: numbered steps, each a highlighted block with its own copy button. */
const MONOGRAM = { python: 'Py', javascript: 'TS', bash: 'sh' } as const;

function ToolSteps({ tool, address }: { tool: GatewayTool; address: string }) {
  const [copied, setCopied] = useState<{ step: number; ok: boolean } | null>(null);
  const copy = (step: number) => navigator.clipboard.writeText(tool.steps[step].code).then(() => setCopied({ step, ok: true }), () => setCopied({ step, ok: false }));
  return <div id={`gateway-tool-${tool.id}`} role="region" aria-label={`${tool.name} setup`} className={styles.panel}>
    <ol className={styles.steps}>{tool.steps.map((step, index) => <li key={step.title}>
      <p className={styles.stepTitle}><span aria-hidden="true">{index + 1}</span>{step.title}</p>
      <div className={styles.block} data-lang={step.language}>
        <div className={styles.blockHead}><span>{step.label}</span><button aria-label={`Copy step ${index + 1}`} onClick={() => void copy(index)}>{copied?.step === index && copied.ok ? 'Copied' : 'Copy'}</button></div>
        <pre tabIndex={0} className={styles.snippet}><code><HighlightedCode code={step.code} language={step.language} mark={address} /></code></pre>
      </div>
    </li>)}</ol>
    <p role="status" className={workspacePage.fine}>{copied && !copied.ok ? 'Copy was blocked. Select the text and copy it manually.' : ''}</p>
    {tool.note && <p className={styles.note}>{tool.note}</p>}
    <p className={workspacePage.fine}>Your provider key stays in your app’s environment, as it is today. Checked with {tool.checked}.</p>
  </div>;
}

type Collect = (on: boolean, termsVersion?: string) => Promise<void>;
type Choose = (provider: 'openai' | 'anthropic') => Promise<void>;

const BACK = <Link href="/train" className={training.textButton}>Back to Train<LinkLoading /></Link>;

/** Setup in the order it has to happen: the provider, then the address in the app, then collecting. The provider comes first
    because the address and every saved answer follow from it; it is locked while collecting, and unlocking means stopping, which deletes. */
function Setup({ status, address, collect, choose }: { status: RelayStatus; address: string; collect: Collect; choose: Choose }) {
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');
  const [switching, setSwitching] = useState(false);
  const provider = gatewayProviders.find(known => known.id === status.provider) ?? gatewayProviders[0];
  const jev = provider.id === 'jev', locked = !!status.collecting_since;
  const outcomes = status.collecting_since ? outcomeRows(status.outcomes) : [];
  const counted = outcomes.reduce((sum, row) => sum + row.count, 0);
  const change = (on: boolean) => { setBusy(true); void collect(on, on ? status.terms_version : undefined).finally(() => { setBusy(false); setConfirming(false); setAgreed(false); }); };
  return <section aria-labelledby="gateway-setup">
    <Section label="Setup" id="gateway-setup" />
    <ol className={styles.flow} aria-label="Setup steps">
      <li data-state={locked ? 'locked' : 'done'}>
        <div className={styles.flowHead}><span className={styles.flowNumber} aria-hidden="true">1</span><h3>Choose your provider</h3><p>{provider.name}{locked && ', locked'}</p></div>
        {/* An account chooses OpenAI or Claude itself, while it is not collecting: saved answers are one provider's. Jev is set by us. */}
        <div role="group" aria-label="Provider" className={styles.providers}>{gatewayProviders.filter(known => jev ? known.id !== 'anthropic' : known.id !== 'jev').map(known => {
          const other = known.id !== provider.id;
          return <button key={known.id} className={styles.provider} aria-pressed={!other} disabled={!other || jev || locked || switching} onClick={() => { if (known.id === 'jev') return; setSwitching(true); setOpen(''); void choose(known.id).finally(() => setSwitching(false)); }}>{known.name}{jev && other && <span className={styles.tag}>On request</span>}</button>;
        })}</div>
        {jev ? <p className={workspacePage.sub}>Your address sends requests to Jev. Ask us if it should go to another provider.</p>
          : locked ? <p role="note" className={styles.lock}><strong>Locked while you collect.</strong> Every saved answer is {provider.name}’s. To change provider, stop collecting, which deletes every saved message.</p>
          : <p className={workspacePage.sub}>Your address sends requests to {provider.name}. You can change it until you start collecting.</p>}
      </li>
      <li data-state={status.requests > 0 ? 'done' : 'open'}>
        <div className={styles.flowHead}><span className={styles.flowNumber} aria-hidden="true">2</span><h3>Point your app at your address</h3><p>{status.requests === 0 ? 'No requests yet' : `${status.requests.toLocaleString()} ${status.requests === 1 ? 'request' : 'requests'}`}</p></div>
        <code className={styles.address}>{address}</code>
        <p className={workspacePage.sub}>Set it as the base URL of your {provider.name} client. Your app keeps its own provider key and always gets your provider’s answer.</p>
        <p className={workspacePage.sub}>{status.requests === 0 ? 'No request has come through this address yet.' : `${status.requests.toLocaleString()} ${status.requests === 1 ? 'request has' : 'requests have'} passed through.`}{status.requests > 0 && status.last_request_at && ` Last one around ${when(status.last_request_at)}.`}</p>
        {status.requests === 0 && <p className={workspacePage.fine}>Send any request from your app, wait a few seconds, then refresh. Only requests your provider answered are counted.</p>}
        <p className={workspacePage.fine}>Treat the address as private: anyone who has it can send requests that are saved to this account.</p>
        <div className={styles.connect}>
          <p className={workspacePage.sub}>Choose what your app uses to call {provider.name}. {jev ? 'Each one shows where the address goes. A Jev question already has fixed answers, so every yes/no and choice question is collected.' : 'Each one shows where the address goes and how to ask for an answer from a fixed list, which is what the gateway collects.'}</p>
          {gatewayTools(address, provider.id).map(group => {
            const shown = group.tools.find(tool => tool.id === open);
            return <div key={group.label} className={styles.group}>
              <div className={styles.groupHead}><h4>{group.label}</h4><p>{group.intro}</p></div>
              <div className={styles.cards}>{group.tools.map(tool => <button key={tool.id} className={styles.card} aria-expanded={tool.id === open} aria-controls={`gateway-tool-${tool.id}`} onClick={() => setOpen(tool.id === open ? '' : tool.id)}>
                <span className={styles.monogram} data-lang={tool.steps[1].language} aria-hidden="true">{MONOGRAM[tool.steps[1].language]}</span>
                <span className={styles.cardText}>
                  <span className={styles.cardName}>{tool.name}<span className={styles.tag}>{tool.tag}</span></span>
                  <span className={styles.blurb}>{tool.blurb}</span>
                </span>
              </button>)}</div>
              {shown && <ToolSteps key={shown.id} tool={shown} address={address} />}
            </div>;
          })}
        </div>
      </li>
      <li data-state={locked ? 'done' : 'open'}>
        <div className={styles.flowHead}><span className={styles.flowNumber} aria-hidden="true">3</span><h3>Collect your provider’s answers</h3><p>{locked ? 'On' : 'Off'}</p></div>
        {status.collecting_since ? <>
          <p className={workspacePage.sub}>Collecting since {when(status.collecting_since)}. Every answer saved is {provider.name}’s.</p>
          {confirming ? <div role="group" aria-label="Confirm stopping collection">
            <p className={workspacePage.sub}>Stopping deletes every saved message and comparison for this account now. Models already trained are kept. This can’t be undone. You can change your provider afterwards.</p>
            <div className={styles.actions}><button className={training.secondary} disabled={busy} onClick={() => setConfirming(false)}>Keep collecting</button><button className={training.button} disabled={busy} onClick={() => change(false)}>{busy ? 'Stopping…' : 'Stop and delete'}</button></div>
          </div> : <div className={styles.actions}><button className={training.secondary} onClick={() => setConfirming(true)}>Stop collecting</button></div>}
        </> : <>
          <p className={workspacePage.sub}>Collection is off. Requests pass through and only their number is kept.</p>
          <ul className={styles.terms}>
            <li>{jev ? 'When collection is on, Zils saves each yes/no and choice question your app asks, with the content it was asked about, your provider’s answer and how sure your provider was of each answer. Score and box questions and requests with images are not saved.' : 'When collection is on, Zils saves each request that asks for an answer from a fixed list, together with your provider’s answer. Other requests are not saved.'}</li>
            <li>Your provider key is used to pass the request on and is never saved.</li>
            <li>Saved messages are used to train and measure models for this account only.</li>
            <li>A saved message is deleted 90 days after it was last sent. Stopping collection deletes all of them at once.</li>
          </ul>
          {!jev && <p className={workspacePage.sub}>Starting locks your provider to {provider.name} until you stop.</p>}
          <label className={styles.agree}><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>I agree to this, and I have the right to share these messages and answers with Zils.</span></label>
          <div className={styles.actions}><button className={training.button} disabled={!agreed || busy} onClick={() => change(true)}>{busy ? 'Starting…' : 'Start collecting'}</button></div>
        </>}
      </li>
    </ol>
    {outcomes.length > 0 && <div className={styles.outcomes} role="region" aria-label="What happened to your requests">
      <p className={workspacePage.label}>What happened to your requests</p>
      <p className={styles.tally}>{`${outcomes[0].count.toLocaleString()} of ${counted.toLocaleString()} ${counted === 1 ? 'request' : 'requests'} saved`}</p>
      <div className={styles.strip} aria-hidden="true">{outcomes.filter(row => row.count > 0).map(row => <span key={row.id} data-outcome={row.id} style={{ flexGrow: row.count }} />)}</div>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.outcomeTable}`}>
        <thead><tr><th scope="col">Share</th><th scope="col">Requests</th><th scope="col">What happened</th></tr></thead>
        <tbody>{outcomes.map(row => <tr key={row.id} data-outcome={row.id}><td>{row.share}</td><td>{row.count.toLocaleString()}</td><th scope="row"><span className={styles.what}><span>{row.label}</span>{row.hint && <span className={styles.why}>{row.hint}</span>}</span></th></tr>)}</tbody>
      </table></div>
      <p className={workspacePage.fine}>{`${counted === 1 ? 'The request' : 'Requests'} that asked a model for a reply since ${when(status.outcomes_since ?? status.collecting_since ?? '')}. The gateway saves the ones that ask for an answer from a fixed list.`}</p>
    </div>}
  </section>;
}

function Report({ client, apiUrl, relayUrl, onExpired }: { client: SupabaseClient; apiUrl: string; relayUrl: string; onExpired: () => Promise<void> }) {
  const [report, setReport] = useState<RelayReport | null>(null);
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false), [fresh, setFresh] = useState(false);
  const [switched, setSwitched] = useState('');
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
  const compare: Compare = jobId => api.compare(jobId)
    .then(async () => { setError(''); await load(new AbortController().signal); })
    .catch(error => {
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setError(error instanceof RelayReportError ? error.message : 'The model could not be compared. Please try again.');
    });
  const setAnswering: SetAnswering = (question, field, promise) => api.answering(question, field, promise)
    .then(async () => { setError(''); await load(new AbortController().signal); })
    .catch(error => {
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setError(error instanceof RelayReportError ? error.message : 'Answering could not be changed. Please try again.');
    });
  const setup = () => {
    setSettingUp(true);
    void api.setup()
      .then(async relay => { setStatus(relay); setFresh(true); setError(''); await load(new AbortController().signal); })
      .catch(error => {
        if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
        setError(error instanceof RelayReportError ? error.message : 'The gateway could not be set up. Please try again.');
      })
      .finally(() => setSettingUp(false));
  };
  const collect: Collect = (on, termsVersion) => api.collect(on, termsVersion)
    .then(async relay => { setStatus(relay); setError(''); await load(new AbortController().signal); })
    .catch(error => {
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setError(error instanceof RelayReportError ? error.message : 'Collection could not be changed. Please try again.');
      if (error instanceof RelayReportError && error.status === 409) return load(new AbortController().signal);
    });
  const choose: Choose = provider => api.provider(provider)
    .then(relay => { setStatus(relay); setError(''); setFresh(false); setSwitched(gatewayProviders.find(known => known.id === relay.provider)?.name ?? ''); })
    .catch(error => {
      if (error instanceof RelayReportError && error.status === 401) { void onExpired(); return; }
      setSwitched('');
      setError(error instanceof RelayReportError && error.status !== 404 ? error.message : 'The provider could not be changed. Please try again.');
      if (error instanceof RelayReportError && error.status === 409) return load(new AbortController().signal);
    });
  const refresh = <button disabled={loading} onClick={() => { setLoading(true); void load(new AbortController().signal); }}>{loading ? 'Refreshing…' : 'Refresh'}</button>;

  return <div>
    <PageHero title="Learning gateway" intro={INTRO} back={BACK} />
    {error && <p className={workspacePage.notice} role="alert">{error}</p>}
    {fresh && status?.relay_id && <p className={workspacePage.notice} role="status">Your gateway address is ready. It starts working within a minute.</p>}
    {switched && status?.relay_id && <p className={workspacePage.notice} role="status">Your address now goes to {switched}. The address below is the one a {switched} client needs. The switch applies within a minute.</p>}
    {status?.relay_id && <Setup status={status} address={relayAddress(relayUrl, status.relay_id, status.provider)} collect={collect} choose={choose} />}
    {!report ? <><Section label="Report" action={!loading && refresh} /><p className={styles.message} role="status">{loading ? 'Loading your report…' : 'Refresh to try again.'}</p></>
      : !report.relay ? <><Section label="Not set up" /><div className={styles.message}>
        <p>The gateway gives you an address to use in place of your provider’s. Your app keeps its own provider key and gets the same answers.</p>
        <p>Nothing is saved unless you switch collection on.</p>
        <div className={styles.actions}><button className={training.button} disabled={settingUp} onClick={setup}>{settingUp ? 'Setting up…' : 'Set up the gateway'}</button></div>
      </div></>
      : report.questions.length === 0 ? <><Section label="Questions" action={refresh} /><p className={styles.message}>No questions yet. {report.saving_since
        ? 'A question appears here once your app sends a request through the gateway that asks for an answer from a fixed list.'
        : 'Saving is off for this account, so nothing that passes through the gateway is kept.'}</p></>
      : <>
        <Section label={`${report.questions_total.toLocaleString()} ${report.questions_total === 1 ? 'question' : 'questions'}`} action={refresh} />
        {report.questions_total > report.questions.length && <p className={workspacePage.notice}>Showing the {report.questions.length} questions with the most recent saved messages.</p>}
        {report.questions.map((question, index) => <Question key={question.id} question={question} number={index + 1} compare={report.compare ? compare : null} setAnswering={setAnswering} />)}
      </>}
  </div>;
}

/** The /gateway page: the relay's address and collection switch, what it has saved and how its shadow models compare. */
export function GatewayReportPage({ auth, apiUrl, relayUrl }: { auth: { url: string; key: string }; apiUrl: string; relayUrl: string }) {
  const { client, session } = useAuthSession(auth);
  if (session === undefined) return <WorkspaceLoading label="Loading your report" />;
  if (!session || !client) return <PageHero title="Learning gateway" intro="Sign in to see what your app has sent through the Zils gateway." action={<Link href="/train" className={training.button}>Sign in to Zils</Link>} />;
  return <Report key={session.user.id} client={client} apiUrl={apiUrl} relayUrl={relayUrl} onExpired={async () => { await client.auth.signOut({ scope: 'local' }); }} />;
}
