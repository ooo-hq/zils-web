'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { doomExamples, successes } from '@/lib/doom-examples';
import { oroExamples } from '@/lib/oro-examples';
import { DoomDemo, DoomStudyDetails } from './doom-examples';
import { ChessDemo, InboxDemo, PostDemo, type Example, type Position, type Reply } from './examples-demos';
import { Who } from './examples-shared';
import { OroDemo, OroStudyDetails } from './oro-examples';
import { DetailsRow } from './site/details-row';
import { ScoreBars } from './site/score-bars';
import s from './bitcast-examples.module.css';

type ExamplesData = {
  examples: Example[];
  scores: { name: string; note: string; matches: number; total: number }[];
  replies: Reply[];
  chess: { examples: Position[]; scores: { trained: number; shared: number; jev: number }; total: number };
};
type Demo = 'doom' | 'content' | 'chess' | 'inbox' | 'oro';
const demos = [
  { key: 'doom', name: 'Survive Doom', color: 'var(--zs-lane-billing)' },
  { key: 'content', name: 'Review a post', color: 'var(--zs-lane-spam)' },
  { key: 'chess', name: 'Find the mate', color: 'var(--zs-lane-account)' },
  { key: 'inbox', name: 'Sort an inbox', color: 'var(--zs-lane-tech)' },
  { key: 'oro', name: 'Referee a shopping AI', color: 'var(--zs-lane-review)' },
] as const;

const demoFromHash = (): Demo => { const key = window.location.hash.slice(1); return demos.some(row => row.key === key) ? key as Demo : 'doom'; };
const subscribeToHash = (onChange: () => void) => { window.addEventListener('hashchange', onChange); return () => window.removeEventListener('hashchange', onChange); };

const inboxTotal = 100;
const inboxScores = [{ name: 'Zils', note: 'After task training', matches: 93, total: inboxTotal }, { name: 'TypeSafe JEV', note: 'Supplied results', matches: 96, total: inboxTotal }, { name: 'Luna 6', note: 'Supplied results', matches: 89, total: inboxTotal }, { name: 'Zils before training', note: 'Without task training', matches: 86, total: inboxTotal }];

/** Every figure on the page comes from recorded data; the picker differences are computed from these. */
function resultFor(demo: Demo, data: ExamplesData) {
  const row = (name: string) => data.scores.find(r => r.name === name)!;
  switch (demo) {
    case 'doom': return { zils: successes(doomExamples.outcomes.zils), jev: successes(doomExamples.outcomes.jev), before: successes(doomExamples.outcomes.base), total: doomExamples.total, unit: 'games', caveat: 'Correct means it collected the armor and reached the exit. 100 held-out starts on one map, every replay audited. One selected game is shown above.', scores: [{ name: 'Zils', note: 'Trained H2O Lightning 4B adapter', matches: successes(doomExamples.outcomes.zils), total: doomExamples.total }, { name: 'TypeSafe JEV', note: `Live API run · ${doomExamples.jevModel}`, matches: successes(doomExamples.outcomes.jev), total: doomExamples.total }, { name: 'Zils before training', note: 'Untrained H2O base', matches: successes(doomExamples.outcomes.base), total: doomExamples.total }, { name: 'Scripted reference', note: 'The program Zils learned from', matches: successes(doomExamples.outcomes.reference), total: doomExamples.total }] };
    case 'content': return { zils: row('Zils').matches, jev: row('TypeSafe JEV').matches, before: row('Zils before training').matches, total: row('Zils').total, unit: 'posts', caveat: 'Correct means it matched Bitcast’s automated label. Reused development posts.', scores: data.scores };
    case 'chess': return { zils: data.chess.scores.trained, jev: data.chess.scores.jev, before: data.chess.scores.shared, total: data.chess.total, unit: 'positions', caveat: 'Correct means it picked a checkmate among the legal checks. A narrow puzzle task, not full-game strength.', scores: [{ name: 'Zils', note: 'Chess adapter from October 7', matches: data.chess.scores.trained, total: data.chess.total }, { name: 'TypeSafe JEV', note: 'Recorded study results', matches: data.chess.scores.jev, total: data.chess.total }, { name: 'Zils before training', note: 'Without chess training', matches: data.chess.scores.shared, total: data.chess.total }] };
    case 'inbox': return { zils: inboxScores[0].matches, jev: inboxScores[1].matches, before: inboxScores[3].matches, total: inboxTotal, unit: 'replies', caveat: 'Correct means it matched the supplied intent label. Reused synthetic test; all 15 opt-outs recognized, one false opt-out.', scores: inboxScores };
    case 'oro': return { zils: oroExamples.scores.zils, jev: oroExamples.scores.jev, before: null, total: oroExamples.total, unit: 'decisions', caveat: 'Correct means it matched the pilot’s label. 60 message/rule pairs with three correlated decisions each; no shopping sessions were run.', scores: [{ name: 'Zils', note: 'Trained H2O Lightning 4B adapter', matches: oroExamples.scores.zils, total: oroExamples.total }, { name: 'TypeSafe JEV', note: 'Live API run · jev-1.13.0', matches: oroExamples.scores.jev, total: oroExamples.total }] };
  }
}
const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;

export function BitcastExamples({ data }: { data: ExamplesData }) {
  // The chosen demo lives in the URL hash so each one can be linked directly: /examples#oro, #content, #inbox, #chess, #doom.
  const demo = useSyncExternalStore(subscribeToHash, demoFromHash, () => 'doom' as Demo);
  const choose = (key: Demo) => { history.replaceState(null, '', `#${key}`); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  const result = resultFor(demo, data);
  const lead = result.zils >= result.jev ? 'zils' : 'jev';
  return <div className={s.exBottom}>
    <div className={s.exIntro}>
      <h1>See what Zils decides.</h1>
      <p>Zils beside <b>TypeSafe JEV</b> in every demo. Same inputs, real recorded answers.</p>
    </div>
    <nav className={s.exPicker} aria-label="Choose a demo">
      {demos.map(({ key, name, color }) => {
        const r = resultFor(key, data);
        return <button type="button" key={key} data-pick={key} aria-pressed={demo === key} aria-controls="decision-demo" style={{ '--c': color } as React.CSSProperties} className={s.exPick} onClick={() => choose(key)}>
          <span className={s.exPickT}><span className={s.exSq} aria-hidden="true" />{name}</span><span className={s.exPickD} data-diff>{signed(r.zils - r.jev)}</span>
        </button>;
      })}
    </nav>
    <section id="decision-demo" aria-label={`${demos.find(row => row.key === demo)!.name} example`} className={s.exDemo} key={demo}>
      {demo === 'doom' ? <DoomDemo /> : demo === 'oro' ? <OroDemo /> : demo === 'content' ? <PostDemo examples={data.examples} /> : demo === 'inbox' ? <InboxDemo replies={data.replies} /> : <ChessDemo positions={data.chess.examples} />}
    </section>
    <section className={s.exScore} aria-label="Score across the full test">
      <div className={s.exScoreBars}>
        <ScoreBars key={demo} rows={[
          { label: <Who model="zils" />, value: result.zils, max: result.total, display: `${result.zils}/${result.total}`, kind: 'zils' },
          { label: <Who model="jev" />, value: result.jev, max: result.total, display: `${result.jev}/${result.total}`, kind: 'jev' },
        ]} />
      </div>
      <div className={s.exScoreDelta}>
        <span className={s.exDelta} data-delta data-lead={lead}>+{Math.abs(result.zils - result.jev)}</span>
        <span className={s.exDeltaCap}>more {result.unit} for {lead === 'zils' ? 'Zils' : 'JEV'}</span>
      </div>
    </section>
    <DetailsRow summary="Full test details" key={`${demo}-full`}>
      <div className={s.exFull}>
        <p>{result.caveat}</p>
        <p>{result.before === null ? <>Zils was trained on {oroExamples.training} synthetic disclosure decisions. An untrained baseline was not measured.</> : <>Training improved Zils from {result.before}/{result.total} to {result.zils}/{result.total} on this test.</>}</p>
        <div className={s.exTableWrap}><table className={s.exTable}><caption>All {result.total} {result.unit} in this test</caption><thead><tr><th scope="col">Model</th><th scope="col">Correct</th><th scope="col">Score</th></tr></thead><tbody>{result.scores.map(row => <tr key={row.name}><th scope="row">{row.name}<span>{row.note}</span></th><td>{row.matches}/{row.total}</td><td>{(100 * row.matches / row.total).toFixed(1)}%</td></tr>)}</tbody></table></div>
        {demo === 'doom' ? <DoomStudyDetails /> : demo === 'oro' ? <OroStudyDetails /> : demo === 'content' ? <p>486 training posts, 159 calibration posts and 155 development posts, with campaign groups kept separate. Reference labels came from Qwen3-32B and can be wrong. This pilot used an 80% campaign-relevance rule; the development set had been used before. Private holdout testing and human review remain needed. Zils minus JEV: +4.52 percentage points, descriptive 95% interval +0.72 to +8.97. JEV verdicts were supplied, with no exact model version or fresh API run.</p> : demo === 'inbox' ? <p>294 authored training examples, 60 separate calibration cases, and 100 synthetic reserve replies. This set had been evaluated before. Zils scored 93/100 on all three passes. JEV and Luna results were supplied; JEV scored three cases higher. Zils’s seven errors all had high confidence. The dataset’s labels have not been independently reviewed.</p> : <p>2,048 training positions and 512 test positions from separate source games. One chess adapter, one training seed. All legal checking moves were offered; any immediate mate received credit. Full-game strength was not tested. An exact chess-rules engine solves 100% of these positions.</p>}
        <p>Each example uses its task-specific Zils adapter. These studies do not establish production reliability. The research adapters shown here have not been deployed.</p>
        <div className={s.exLinks}><Link className={s.exLink} href="/model">Explore the research</Link></div>
      </div>
    </DetailsRow>
  </div>;
}
