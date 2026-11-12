'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionRow } from '@/components/site/section-row';
import { InstallCommand } from '@/components/site/install-command';
import { serviceUrl } from '@/lib/training';
import { hfTree } from '@/lib/soup-tiers';
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
    <p className={s.fine}>The command signs a request with your hotkey and prints a private link that works for 24 hours. <a href={DOCS}>Soup guide</a> · <Link href="/miners">All miners</Link></p>
  </header>;
}

function Body({ body }: { body: ReportBody }) {
  const stage = STAGE[body.stage];
  const [what, next] = explain(body.reason);
  const numbers = bodyNumbers(body);
  const behind = weakestCategory(body.categories);
  return <article className={s.body} data-tone={stage.tone}>
    <h3><span className={s.stage}>{stage.label}</span><code>{body.body_sha256 ? body.body_sha256.slice(0, 12) : 'unreadable commitment'}</code></h3>
    <p>{what}</p>
    {next && <p className={s.next}>Next: {next}</p>}
    {numbers.length > 0 && <table className={s.numbers}><tbody>
      {numbers.map(n => <tr key={n.label}><th scope="row">{n.label}</th><td>{n.value}</td><td>{n.bar}</td></tr>)}
    </tbody></table>}
    {body.categories && Object.keys(body.categories).length > 0 && <table className={s.numbers}>
      <thead><tr><th scope="col">Category</th><th scope="col">Yours</th><th scope="col">Soup</th></tr></thead>
      <tbody>{Object.entries(body.categories).map(([name, pair]) => <tr key={name} data-behind={name === behind || undefined}>
        <th scope="row">{name}</th><td>{pair.score}</td><td>{pair.soup}{name === behind && <span className={s.behind}>Furthest behind</span>}</td>
      </tr>)}</tbody>
    </table>}
    <p className={s.codes}>Codes: {[body.stage, body.reason].filter(Boolean).join(' / ')}</p>
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
  if (state.view === 'none') return <GetLink title="Open your miner dashboard" lead="This page is private to one hotkey. Run this on your mining machine to get your link:" />;
  if (state.view === 'expired') return <GetLink title="This link has expired" lead="Dashboard links last 24 hours, and end early when the hosted API restarts. Run this again for a new one:" />;
  if (state.view !== 'ready') return <header className={s.gate}>
    <h1>The dashboard is unavailable right now</h1>
    <p>Your link was not checked. Try again in a few minutes; <code>zils-miner report</code> prints the same round report in the terminal.</p>
  </header>;

  const { data, soup, rows } = state;
  const pools = Object.entries(data.report.pools).filter(([, pool]) => pool.bodies.length > 0);
  const history = seatHistory(soup, data.hotkey);
  const totals = jobTotals(data.jobs);
  return <>
    <header className={s.hero}>
      <div>
        <h1>Your miner</h1>
        <p><code title={data.hotkey}>{short(data.hotkey)}</code></p>
      </div>
      <p className={s.fine}>Private to this hotkey. Anyone with the link can read this page until {new Date(data.expires_at).toLocaleString()}. The report is as of when the link was made; run <code>zils-miner dashboard</code> for a fresh one.</p>
    </header>

    <SectionRow n="01" label="Right now" />
    <section aria-label="Right now" className={s.section}>
      {rows === null ? <p className={s.quiet}>The chain view is unavailable right now.</p>
        : rows.length === 0 ? <p className={s.quiet}>This hotkey has no soup body or serving endpoint on chain. <Link href="/soup">Bring a body to the soup</Link>.</p>
        : rows.map(r => <dl key={r.uid} className={s.now}>
          <div><dt>Miner</dt><dd>UID {r.uid}</dd></div>
          <div><dt>Tier</dt><dd>{r.tier ?? '—'}</dd></div>
          <div><dt>Body</dt><dd>{r.body ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code>{r.body.revision.slice(0, 7)}</code></> : '—'}</dd></div>
          <div><dt>Standing</dt><dd>{r.line ? `In line, #${r.line.position}${r.line.next ? '' : ', past the next round’s limit'}` : STANDING[r.standing]}</dd></div>
          <div><dt>Serving</dt><dd>{r.serving ? 'Endpoint announced' : 'No endpoint'}</dd></div>
        </dl>)}
      <p className={s.fine}>Live, from the chain and tonight’s public soup feed. <Link href="/miners">See every miner</Link>.</p>
    </section>

    <SectionRow n="02" label="Latest round report" />
    <section aria-label="Latest round report" className={s.section}>
      {pools.length === 0 && <p className={s.quiet}>No body of this hotkey was in the newest round of any pool when the link was made.</p>}
      {pools.map(([pool, item]) => <div key={pool} className={s.pool}>
        <h2>{pool} <span>round {item.round_id}</span></h2>
        {item.bodies.map((body, i) => <Body key={body.body_sha256 ?? i} body={body} />)}
      </div>)}
      <p className={s.fine}>From the validator, for your hotkey only, as of when the link was made: run <code>zils-miner dashboard</code> again after the next round. Scores are rounded to half a point, and a score that missed its bar is always shown below the bar. It covers the newest finished round of each pool.</p>
    </section>

    <SectionRow n="03" label="Seats and pay" />
    <section aria-label="Seats and pay" className={s.section}>
      {soup === null ? <p className={s.quiet}>The soup feed is unavailable right now.</p>
        : history.rows.length === 0 ? <p className={s.quiet}>No body of this hotkey has sat in a soup in the rounds the public feed holds.</p>
        : <>
          <p className={s.total}>{history.paid} of {history.rounds} rounds paid</p>
          <div className={s.scroll}><table className={s.table}>
            <thead><tr><th scope="col">Round</th><th scope="col">Tier</th><th scope="col">Body</th><th scope="col">Seat</th><th scope="col">Contribution</th><th scope="col">Share of emissions</th></tr></thead>
            <tbody>{history.rows.map(r => <tr key={`${r.round}:${r.body}`} data-paid={r.share > 0 || undefined}>
              <td>{r.day}</td><td>{r.tier}</td><td><code>{r.body.slice(0, 12)}</code></td><td>{SEAT[r.seat]}</td><td>{r.contribution}</td><td>{percent(r.share)}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
      <p className={s.fine}>Rounds where your body was in a soup, from the public feed. Contribution is what the soup loses without your body. The share is the part of that round’s emissions the seat, and the crown if you held it, carried; an amount in TAO is not shown yet.</p>
    </section>

    <SectionRow n="04" label="Customer jobs" />
    <section aria-label="Customer jobs" className={s.section}>
      {data.jobs.length === 0 ? <p className={s.quiet}>This hotkey has not been assigned a customer job.</p> : <>
        <p className={s.total}>{totals.assigned} assigned · {totals.submitted} submitted · {totals.evaluated} graded · {totals.selected} delivered{totals.medianSkill !== null && <> · median skill {Number(totals.medianSkill.toFixed(3))}</>}</p>
        <div className={s.scroll}><table className={s.table}>
          <thead><tr><th scope="col">Date</th><th scope="col">Track</th><th scope="col">Result</th></tr></thead>
          <tbody>{data.jobs.map((job, i) => <tr key={i} data-paid={job.selected || undefined}>
            <td>{job.created_at ? job.created_at.slice(0, 10) : '—'}</td><td>{job.track}</td><td>{jobResult(job)}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
      <p className={s.fine}>Your newest 50 customer jobs. Skill is how far your adapter beat the job’s baseline on its held-out test set. Jobs are listed without their customer or data. Pay for customer jobs is not shown yet.</p>
    </section>
  </>;
}
