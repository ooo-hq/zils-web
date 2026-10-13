'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, MessageCircle, Play, RotateCcw, ShoppingBag, UnlockKeyhole, UserRound } from 'lucide-react';
import { disclosureAction, oroExamples, oroJudgment } from '@/lib/oro-examples';
import base from './bitcast-examples.module.css';
import s from './oro-examples.module.css';

const decisions = [
  { key: 'facet:need', label: 'Asks about the preference?' },
  { key: 'all', label: 'Asks several things at once?' },
  { key: 'asks', label: 'Asks the shopper anything?' },
] as const;
const actions = {
  no_disclosure: { title: 'Shopper keeps the answer hidden', reply: 'No answer about the pattern.', icon: LockKeyhole, expected: 'This is somebody else’s question inside a review. The assistant has not asked this shopper anything, so the shopper should wait.' },
  reveal: { title: 'Shopper shares the answer', reply: '“I want a striped pattern.”', icon: UnlockKeyhole, expected: 'The assistant is asking this shopper about the pattern. The shopper should answer: “I want stripes.”' },
  one_at_a_time: { title: 'Shopper asks for one question', reply: '“Could you ask me one thing at a time?”', icon: MessageCircle, expected: 'The assistant asks about pattern and budget together. This test requires one question at a time, so the shopper should ask it to slow down.' },
};

export function OroDemo() {
  const [index, setIndex] = useState(0);
  const compareButton = useRef<HTMLButtonElement>(null);
  const [replayed, setReplayed] = useState(false);
  const example = oroExamples.cases[index];
  const expected = disclosureAction({
    'facet:need': Number(example.expected['facet:need']),
    all: Number(example.expected.all), asks: Number(example.expected.asks),
  });
  function selectExample(next: number) {
    setIndex(next);
    setReplayed(false);
  }
  return <>
    <div className={base.appHeader}><div><ShoppingBag size={18} /><strong>Testing a shopping AI</strong><span>ORO example</span></div><span className={base.recorded}>Recorded synthetic examples</span></div>
    <div className={base.demoToolbar}>
      <div className={s.intro}><h2>Did the assistant actually ask?</h2><p>ORO tests shopping AIs with a simulated shopper. The AI must ask questions to learn what the shopper wants. <strong>Zils or JEV decides when the shopper can share its answer.</strong></p></div>
      <label className={base.picker}>Try a situation<select value={index} onChange={event => selectExample(Number(event.target.value))}>{oroExamples.cases.map((row, i) => <option key={row.id} value={i}>{row.title}</option>)}</select></label>
    </div>
    <div className={s.stage}>
      <h3 className={s.step}>1. The shopper knows something the assistant doesn’t.</h3>
      <div className={s.setup}>
        <div><span className={s.swatch} aria-hidden="true" /><p><span>Shopper’s answer</span><strong>“I want stripes.”</strong></p></div>
        <div><UserRound size={22} /><p><span>Shopping assistant</span><strong>Doesn’t know the pattern yet.</strong></p></div>
      </div>
      <h3 className={s.step}>2. Read what the assistant says.</h3>
      <div className={s.message}>
        <blockquote>{example.message}</blockquote>
      </div>
      <p className={s.expected}><strong>What should happen:</strong> {actions[expected].expected}</p>
      <h3 className={s.step}>3. Does each model let the shopper answer?</h3>
      <div className={s.controls}>
        <button ref={compareButton} className={replayed ? base.secondary : base.primary} type="button" onClick={() => setReplayed(!replayed)}>{replayed ? <><RotateCcw size={16} />Reset comparison</> : <><Play size={16} />Compare Zils and JEV</>}</button>
        <span>Recorded model decisions; shopper dialogue is illustrative.</span>
      </div>
      <div className={s.conversations} aria-live="polite" aria-atomic="true">
        {replayed && (['zils', 'jev'] as const).map(model => {
          const action = disclosureAction(example[model]);
          const { title, reply, icon: Icon } = actions[action];
          const matches = action === expected;
          const disclosed = action === 'reveal';
          return <section key={model} className={`${s.conversation} ${s.ready}`} aria-label={`${model === 'zils' ? 'Zils' : 'TypeSafe JEV'} shopper outcome`}>
            <header><span className={model === 'zils' ? s.zilsMark : s.jevMark}>{model === 'zils' ? 'Z' : 'J'}</span><h3>Using {model === 'zils' ? 'Zils' : 'TypeSafe JEV'}</h3><span className={matches ? base.match : base.caution}>{matches ? <Check size={14} /> : <span aria-hidden="true">!</span>}{matches ? 'Correct' : 'Incorrect'}</span></header>
            <div className={s.outcome}>
              <h4><Icon size={21} />{title}</h4><p>{reply}</p>
            </div>
            <div className={`${s.preference} ${disclosed ? s.disclosed : ''}`}>
              {disclosed ? <UnlockKeyhole size={17} /> : <LockKeyhole size={17} />}<span>What the assistant learns</span><strong>{disclosed ? 'Pattern: stripes' : 'Nothing yet'}</strong>
            </div>
          </section>;
        })}
      </div>
      {replayed && <div className={s.takeaway}><p><strong>{expected === 'no_disclosure' ? 'Why the difference matters' : 'What this shows'}</strong>{example.explanation}</p>{index < oroExamples.cases.length - 1 && <button type="button" className={base.primary} onClick={() => { selectExample(index + 1); compareButton.current?.focus(); }}>{index === 0 ? 'Try the quoted review' : 'Try two questions at once'}<ArrowRight size={16} /></button>}</div>}
    </div>
    <details className={base.exampleDetails} key={example.id}><summary>Behind this decision</summary><div>
      <p>Each model evaluated the same message and three ORO questions. The table shows recorded probabilities of “yes”; the action above follows ORO’s disclosure rule.</p>
      <table className={s.decisions}><caption>Recorded decisions · {example.id}</caption><thead><tr><th scope="col">Decision</th><th scope="col">Zils</th><th scope="col">JEV</th></tr></thead><tbody>{decisions.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th>{(['zils', 'jev'] as const).map(model => <td key={model}>{oroJudgment(example[model][key])}<span>{(example[model][key] * 100).toFixed(1)}% yes</span></td>)}</tr>)}</tbody></table>
      <p>70% or higher means “yes”; 30% or lower means “no”; between those means “unsure.” Asking several things at once takes precedence over sharing a preference. The general question detector also affects ORO’s question count.</p>
      <p>Zils probabilities use calibration on a separate set. The shopper wording and striped preference are illustrations, not model-generated replies or a recorded shopping session.</p>
      <details><summary>Exact questions sent to both models</summary>{decisions.map(({ key }) => <p key={key}>{oroExamples.questions[key]}</p>)}</details>
    </div></details>
  </>;
}

export function OroStudyDetails() {
  return <>
    <p>October 13, 2026 pilot: 720 authored training decisions (30 templates × 8 attribute types × 3 questions), 60 calibration decisions, and 180 held-out decisions. Training and test template strings and attribute types were separate; semantic categories were shared. Labels were AI-authored and agent-reviewed, not independently human-labeled.</p>
    <p>The test contains 60 message/rule pairs across 30 templates and two attributes: pattern and power rating. These are correlated decisions, not 180 independent shopping tasks. At a 50% decision threshold, Zils matched 180/180 labels and JEV 173/180. At ORO’s 70% disclosure threshold, derived actions matched 60/60 versus 58/60. JEV’s two false disclosures came from the same quoted-message template.</p>
    <p>Zils: H2O Lightning 4B v1.2.3 with one task adapter. JEV: a fresh call to TypeSafe’s direct API, version 1.13.0. ORO uses an OpenRouter route; exact serving equivalence was not established. No untrained H2O baseline was measured. The descriptive 95% interval for the accuracy difference includes zero (0 to +9.44 percentage points).</p>
    <p>This isolates the first-turn disclosure decision. We did not run full shopping sessions or Mistral shopper replies, measure shopping success, or establish a speed or cost advantage. <a href={oroExamples.source}>View the pinned ORO source</a>.</p>
  </>;
}
