'use client';

import { useState } from 'react';
import { disclosureAction, oroExamples, oroJudgment } from '@/lib/oro-examples';
import { DetailsRow } from './site/details-row';
import { StageHead, Verdicts } from './examples-shared';
import base from './bitcast-examples.module.css';
import s from './oro-examples.module.css';

const decisions = [
  { key: 'facet:need', label: 'Asks about the preference?' },
  { key: 'all', label: 'Asks several things at once?' },
  { key: 'asks', label: 'Asks the shopper anything?' },
] as const;
const answers = { no_disclosure: 'Wait', reveal: 'Answer', one_at_a_time: 'One at a time' };

export function OroDemo() {
  const [index, setIndex] = useState(0);
  const example = oroExamples.cases[index];
  const expected = disclosureAction({ 'facet:need': Number(example.expected['facet:need']), all: Number(example.expected.all), asks: Number(example.expected.asks) });
  const zils = disclosureAction(example.zils), jev = disclosureAction(example.jev);
  return <>
    <StageHead title="Did the assistant actually ask?" />
    <div className={s.oro}>
      <div className={s.chat}>
        <p className={`${s.msg} ${s.assistant}`} data-oro-message><span className={s.who}>Shopping assistant</span>{example.message}</p>
        <p className={`${s.msg} ${s.shopper}`}><span className={s.who}>Shopper, holding its answer</span>“I want stripes.”</p>
        {index < oroExamples.cases.length - 1 && <button type="button" className={`${base.exBtn} ${s.next}`} onClick={() => setIndex(index + 1)}>Next situation →</button>}
      </div>
      <Verdicts rows={{ zils: { answer: answers[zils], right: zils === expected }, jev: { answer: answers[jev], right: jev === expected } }} note={example.explanation.split('. ')[0] + '.'} />
    </div>
    <DetailsRow summary="Behind this decision" key={example.id}>
      <div className={base.exBehind}>
        <p>Each model evaluated the same message and three ORO questions. The table shows recorded probabilities of “yes”; the action above follows ORO’s disclosure rule.</p>
        <div className={base.exTableWrap}><table className={base.exTable}><caption>Recorded decisions · {example.id}</caption><thead><tr><th scope="col">Decision</th><th scope="col">Zils</th><th scope="col">JEV</th></tr></thead><tbody>{decisions.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th>{(['zils', 'jev'] as const).map(model => <td key={model}>{oroJudgment(example[model][key])} · {(example[model][key] * 100).toFixed(1)}% yes</td>)}</tr>)}</tbody></table></div>
        <p>70% or higher means “yes”; 30% or lower means “no”; between those means “unsure.” Asking several things at once takes precedence over sharing a preference. The general question detector also affects ORO’s question count.</p>
        <p>Zils probabilities use calibration on a separate set. The shopper wording and striped preference are illustrations, not model-generated replies or a recorded shopping session.</p>
        <details><summary>Exact questions sent to both models</summary>{decisions.map(({ key }) => <p key={key}>{oroExamples.questions[key]}</p>)}</details>
      </div>
    </DetailsRow>
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
