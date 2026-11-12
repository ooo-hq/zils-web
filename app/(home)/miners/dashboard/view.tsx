'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionRow } from '@/components/site/section-row';
import { InstallCommand } from '@/components/site/install-command';
import { DetailsRow } from '@/components/site/details-row';
import { serviceUrl } from '@/lib/training';
import { hfTree, poolTier } from '@/lib/soup-tiers';
import { soupBoard, type SoupBoard } from '@/lib/soup-board';
import { networkBodies, minerRows, withoutOffTiers, type MinerRow } from '@/lib/network-bodies';
import { minerDashboardSchema, STAGE, explain, bodyNumbers, weakestCategory, seatHistory, jobTotals, type MinerDashboard, type MinerJob, type ReportBody } from '@/lib/miner-dashboard';
import { STANDING } from '../chain';
import s from './dashboard.module.css';

const KEY = 'zils-miner-dashboard';
const DOCS = 'https://docs.zils.ai/operations/soup';
const short = (hotkey: string) => `${hotkey.slice(0, 6)}…${hotkey.slice(-4)}`;
const percent = (share: number) => share > 0 ? `${Number((share * 100).toFixed(2))}%` : '—';
const SEAT = { crown: 'Crown', seat: 'Paid seat', unpaid: 'In the soup, unpaid' } as const;

/** The link's token: read from the address once, kept for this tab, and taken out of the address bar. */
function linkToken() {
  const fromLink = window.location.hash.slice(1);
  try {
    if (fromLink) {
      window.sessionStorage.setItem(KEY, fromLink);
      window.history.replaceState(null, '', window.location.pathname);
    }
    return fromLink || window.sessionStorage.getItem(KEY);
  } catch { return fromLink || null; }
}
function forgetToken() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing was kept */ }
}

type State =
  | { view: 'loading' | 'none' | 'expired' | 'down' }
  | { view: 'ready'; data: MinerDashboard; soup: SoupBoard | null; rows: MinerRow[] | null };

async function load(token: string): Promise<State> {
  const raw = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL ?? process.env.NEXT_PUBLIC_FEZ_TRAINING_API_URL;
  if (!raw) return { view: 'down' };
  try {
    const [response, soup, chain] = await Promise.all([
      fetch(`${serviceUrl(raw)}/v1/network/miner/dashboard`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15_000) }),
      soupBoard(), networkBodies(),
    ]);
    if (response.status === 401) return { view: 'expired' };
    const parsed = response.ok ? minerDashboardSchema.safeParse(await response.json()) : null;
    if (!parsed?.success) return { view: 'down' };
    const rows = chain ? withoutOffTiers(minerRows(chain, soup)).filter(r => r.hotkey === parsed.data.hotkey) : null;
    return { view: 'ready', data: parsed.data, soup, rows };
  } catch { return { view: 'down' }; }
}

function GetLink({ title, lead }: { title: string; lead: string }) {
  return <header className={s.gate}>
    <h1>{title}</h1>
    <p>{lead}</p>
    <InstallCommand command="zils-miner dashboard" label="Dashboard command" copiedText="Command copied." />
    <p className={s.links}><a href={DOCS}>Soup guide</a><Link href="/miners">All miners</Link></p>
  </header>;
}

/** A score out of 100 as a number over a thin bar: yours in the spectrum, the soup's hatched. */
function Score({ value, kind }: { value: number; kind: 'yours' | 'soup' }) {
  return <span className={s.score}>
    <span>{value}</span>
    <i className={s.track} aria-hidden="true"><i data-kind={kind} style={{ width: `${Math.max(1, Math.min(100, value))}%`, '--score': Math.max(1, Math.min(100, value)) } as React.CSSProperties} /></i>
  </span>;
}

function Body({ body }: { body: ReportBody }) {
  const stage = STAGE[body.stage];
  const [what, next] = explain(body.reason);
  const numbers = bodyNumbers(body);
  const behind = weakestCategory(body.categories);
  const categories = Object.entries(body.categories ?? {});
  return <article className={s.body}>
    <div className={s.verdict}>
      <p className={s.tag} data-tone={stage.tone} data-stage={body.stage}><i aria-hidden="true" />{stage.label}</p>
      <h3>{what}</h3>
      {next && <p className={s.next}>Next: {next}</p>}
      <p className={s.codes}><code>{body.body_sha256 ? body.body_sha256.slice(0, 12) : 'unreadable commitment'}</code><span>{[body.stage, body.reason].filter(Boolean).join(' / ')}</span></p>
    </div>
    <div className={s.evidence}>
      {numbers.length > 0 && <table className={s.numbers}><tbody>
        {numbers.map(n => <tr key={n.label}><th scope="row">{n.label}</th><td>{n.value}</td><td>{n.bar}</td></tr>)}
      </tbody></table>}
      {categories.length > 0 && <table className={s.categories}>
        <thead><tr><th scope="col">Category</th><th scope="col">Yours</th><th scope="col">Soup</th></tr></thead>
        <tbody>{categories.map(([name, pair]) => <tr key={name} data-behind={name === behind || undefined}>
          <th scope="row">{name}{name === behind && <small>Furthest behind</small>}</th>
          <td><Score value={pair.score} kind="yours" /></td>
          <td><Score value={pair.soup} kind="soup" /></td>
        </tr>)}</tbody>
      </table>}
      {numbers.length === 0 && categories.length === 0 && <p className={s.quiet}>This body was not graded, so it has no scores.</p>}
    </div>
  </article>;
}

function jobResult(job: MinerJob) {
  if (job.selected) return 'Delivered to the customer';
  if (job.evaluated) return job.skill === null ? 'Graded, not delivered' : `Graded, skill ${job.skill}, not delivered`;
  if (job.state === 'failed') return 'Run failed';
  if (job.status === 'failed') return 'Job stopped';
  if (job.state === 'submitted') return 'Submitted, waiting for grading';
  return job.state === 'leased' ? 'Training now' : 'Assigned';
}

export function MinerDashboardView() {
  const [state, setState] = useState<State>({ view: 'loading' });
  useEffect(() => {
    let live = true;
    const token = linkToken();
    (token ? load(token) : Promise.resolve<State>({ view: 'none' })).then(next => {
      if (next.view === 'expired') forgetToken();
      if (live) setState(next);
    });
    return () => { live = false; };
  }, []);

  if (state.view === 'loading') return <p className={s.loading} role="status">Opening your dashboard…</p>;
  if (state.view === 'none') return <GetLink title="Open your miner dashboard" lead="This page is private to one hotkey. Run this on your mining machine to get your link." />;
  if (state.view === 'expired') return <GetLink title="This link has expired" lead="Links last 24 hours. Run this on your mining machine for a new one." />;
  if (state.view !== 'ready') return <header className={s.gate}>
    <h1>The dashboard is unavailable right now</h1>
    <p>Your link was not checked. Try again in a few minutes. <code>zils-miner report</code> prints the same round report in the terminal.</p>
  </header>;

  const { data, soup, rows } = state;
  const pools = Object.entries(data.report.pools).filter(([, pool]) => pool.bodies.length > 0);
  const history = seatHistory(soup, data.hotkey);
  const totals = jobTotals(data.jobs);
  const until = new Date(data.expires_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return <>
    <header className={s.hero}>
      <div>
        <h1>Your miner</h1>
        <p className={s.hotkey}><code title={data.hotkey}>{short(data.hotkey)}</code></p>
      </div>
      <div className={s.fresh}>
        <p>Private to this hotkey until {until}. For a fresh report, run this again.</p>
        <InstallCommand command="zils-miner dashboard" label="Dashboard command" copiedText="Command copied." />
      </div>
    </header>

    <SectionRow n="01" label="Right now" note="Live" />
    <section aria-label="Right now">
      {rows === null ? <p className={s.quiet}>The chain view is unavailable right now.</p>
        : rows.length === 0 ? <p className={s.quiet}>This hotkey has no body or serving endpoint on chain. <Link href="/soup">Bring a body to the soup</Link>.</p>
        : rows.map(r => <dl key={r.uid} className={s.now}>
          <div data-key><dt>Standing</dt><dd>{r.line ? `In line, #${r.line.position}${r.line.next ? '' : ', past the next round’s limit'}` : STANDING[r.standing]}</dd></div>
          <div><dt>Miner</dt><dd>UID {r.uid}</dd></div>
          <div><dt>Tier</dt><dd>{r.tier ?? '—'}</dd></div>
          <div><dt>Body</dt><dd>{r.body ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code>{r.body.revision.slice(0, 7)}</code></> : '—'}</dd></div>
          <div><dt>Serving</dt><dd>{r.serving ? 'Endpoint announced' : 'No endpoint'}</dd></div>
        </dl>)}
    </section>

    <SectionRow n="02" label="Latest round report" note="As of this link" />
    <section aria-label="Latest round report">
      {pools.length === 0 && <p className={s.quiet}>No body of this hotkey was in the newest round of any pool when the link was made.</p>}
      {pools.map(([pool, item]) => <div key={pool} className={s.pool}>
        <h2>{poolTier(pool) ?? pool}<span>round {item.round_id}</span></h2>
        {item.bodies.map((body, i) => <Body key={body.body_sha256 ?? i} body={body} />)}
      </div>)}
    </section>

    <SectionRow n="03" label="Seats and pay" note="Public feed" />
    <section aria-label="Seats and pay" className={s.split}>
      {soup === null ? <p className={s.quiet}>The soup feed is unavailable right now.</p>
        : history.rows.length === 0 ? <p className={s.quiet}>No body of this hotkey has sat in a soup in the rounds the public feed holds.</p>
        : <>
          <div className={s.lead}>
            <p className={s.figure}><b>{history.paid}</b> of {history.rounds} rounds paid</p>
          </div>
          <table className={s.table}>
            <thead><tr><th scope="col">Round</th><th scope="col">Tier</th><th scope="col">Body</th><th scope="col">Seat</th><th scope="col">Contribution</th><th scope="col">Share</th></tr></thead>
            <tbody>{history.rows.map(r => <tr key={`${r.round}:${r.body}`} data-paid={r.share > 0 || undefined}>
              <td data-label="Round">{r.day}</td><td data-label="Tier">{r.tier}</td><td data-label="Body"><code>{r.body.slice(0, 12)}</code></td>
              <td data-label="Seat"><span>{r.share > 0 && <i className={s.chip} aria-hidden="true" />}{SEAT[r.seat]}</span></td>
              <td data-label="Contribution">{r.contribution}</td><td data-label="Share">{percent(r.share)}</td>
            </tr>)}</tbody>
          </table>
        </>}
    </section>

    <SectionRow n="04" label="Customer jobs" note="Newest 50" />
    <section aria-label="Customer jobs" className={s.split}>
      {data.jobs.length === 0 ? <p className={s.quiet}>This hotkey has not been assigned a customer job.</p> : <>
        <div className={s.lead}>
          <p className={s.figure}><b>{totals.selected}</b> delivered of {totals.assigned} assigned</p>
          <dl className={s.counts}>
            <div><dt>Submitted</dt><dd>{totals.submitted}</dd></div>
            <div><dt>Graded</dt><dd>{totals.evaluated}</dd></div>
            <div><dt>Median skill</dt><dd>{totals.medianSkill === null ? '—' : Number(totals.medianSkill.toFixed(3))}</dd></div>
          </dl>
        </div>
        <table className={s.table}>
          <thead><tr><th scope="col">Date</th><th scope="col">Track</th><th scope="col">Result</th></tr></thead>
          <tbody>{data.jobs.map((job, i) => <tr key={i} data-paid={job.selected || undefined}>
            <td data-label="Date">{job.created_at ? job.created_at.slice(0, 10) : '—'}</td><td data-label="Track">{job.track}</td>
            <td data-label="Result"><span>{job.selected && <i className={s.chip} aria-hidden="true" />}{jobResult(job)}</span></td>
          </tr>)}</tbody>
        </table>
      </>}
    </section>

    <DetailsRow summary="How to read this page">
      <div className={s.notes}>
        <p><b>Right now</b> is live, from the chain and tonight’s public soup feed. Everyone can see it on <Link href="/miners">the miners page</Link>.</p>
        <p><b>The round report</b> comes from the validator, for your hotkey only, and is as it was when the link was made. It covers the newest finished round of each pool. Scores are rounded to half a point, and a score that missed its bar is always shown below the bar.</p>
        <p><b>Seats and pay</b> lists the rounds in the public feed where your body was in a soup. Contribution is what the soup loses without your body. Share is the part of that round’s emissions your seat carried, and the crown if you held it. An amount in TAO is not shown yet.</p>
        <p><b>Customer jobs</b> are listed without their customer or data. Skill is how far your adapter beat the job’s baseline on its held-out test set. Pay for customer jobs is not shown yet.</p>
        <p>Anyone who has the link can read this page until it expires. <a href={DOCS}>Soup guide</a></p>
      </div>
    </DetailsRow>
  </>;
}
