'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './bases.module.css';

type Kind = 'base' | 'lost' | 'next' | 'feature';
type Detail = { tag: string; name: string; body: string; facts: [string, string][]; link?: [string, string] };

// Sources: output/base-promotion-rehearsal-2026-10-17, base-round-2-2026-10-18, base-round-3-2026-10-18,
// box-mvp-2026-10-19 and d3-lite-box-2026-10-20 reports. Box scores are research runs, not track results.
const DETAILS: Record<string, Detail> = {
  'mini-v1': { tag: 'Base · stable', name: 'd3-mini 4.5B · v1', body: 'The vendor checkpoint, chosen as the first base for its video, multi-image and extra question types.',
    facts: [['Elected', '17 Oct'], ['Channel', 'stable']] },
  r1: { tag: 'Candidate · tied', name: 'Round 1', body: 'Tied v1 on the sealed exams, so it was not eligible. The regression suite passed.',
    facts: [['Exam Brier', '0.1782 vs 0.1790'], ['Date', '17–18 Oct']] },
  r2: { tag: 'Candidate · vetoed', name: 'Round 2', body: 'Beat v1 on two sealed exams, but customer adapters retrained on it got worse. The regression suite vetoed it.',
    facts: [['Exam Brier', '0.1326 vs 0.1790'], ['Second exam', '0.0725 vs 0.1303'], ['Date', '18 Oct']] },
  r3: { tag: 'Candidate · vetoed', name: 'Round 3', body: 'Stopped by the regression suite.', facts: [['Date', '18 Oct']] },
  r4: { tag: 'Candidate · vetoed', name: 'Round 4', body: 'Half of the round 3 change merged into v1. Still failed the regression suite on individual seeds.', facts: [['Date', '19 Oct']] },
  r5: { tag: 'Base · latest', name: 'd3-mini 4.5B · r5', body: 'A quarter merge of the round 3 change. Passed the exams twice and the suite on the mean across seeds. Its miner was the first king paid, and customer models have started moving onto it.',
    facts: [['Crowned', '19 Oct'], ['Channel', 'latest']] },
  'mini-next': { tag: 'Next revision', name: 'Mini, next', body: 'Whatever beats r5 next. If the boxes track has a king by then, the skill can graduate into this release, and the box exam guards every base after it.',
    facts: [['Status', 'Open']], link: ['/miners', 'Compete for a base'] },
  'mini-box': { tag: 'Feature track · planned', name: 'Bounding boxes on mini', body: 'Each box is four multiple-choice questions, one per edge. A research adapter beat Jev 1.14’s box mode on our test set. It trained on v1; the track itself would be pinned to r5.',
    facts: [['Adapter IoU', '0.582'], ['Jev 1.14', '0.479'], ['Stock mini', '0.075']], link: ['/miners/tracks/box', 'Box track'] },
  'lite-v1': { tag: 'Base · stock', name: 'd3-lite 0.8B · v1', body: 'A smaller base, about twice as fast as mini at a quarter of the memory. It has its own competition and its own kings; lite and mini never compete against each other.',
    facts: [['Added', '20 Oct']] },
  'lite-box': { tag: 'Feature track · planned', name: 'Bounding boxes on lite', body: 'Training helps a lot, but lite stays far behind mini on real defects: 3 of 122 defect images reach IoU 0.5, against 42 on mini.',
    facts: [['Stock lite', '0.032'], ['Adapter IoU', '0.251'], ['Time per box', '0.6 s (mini 3.3 s)']] },
  'lite-next': { tag: 'Next revision', name: 'Lite, next', body: 'The first lite candidate to beat v1 on the lite exams.', facts: [['Status', 'Open']], link: ['/miners', 'Compete for a base'] },
};

type NodeProps = { id: string; x: number; y: number; kind?: Kind; label?: string; sub?: string; above?: boolean; left?: boolean };

function Tag({ x, y, children }: { x: number; y: number; children: string }) {
  const w = children.length * 7 + 16;
  return <g className={s.tag}><rect x={x - w / 2} y={y} width={w} height={18} /><text x={x} y={y + 13} textAnchor="middle">{children}</text></g>;
}

// `left` puts the label beside the node, for nodes whose feature track drops straight down from them.
function Node({ id, x, y, kind = 'base', label, sub, above, left, selected, onPick }: NodeProps & { selected: string; onPick: (id: string) => void }) {
  const r = kind === 'lost' || kind === 'feature' ? 7 : 10;
  const ty = above ? y - 22 : left ? y + 26 : y + 30;
  const tx = left ? x - 12 : x;
  const anchor = left ? 'end' : 'middle';
  const pick = () => onPick(id);
  return <g className={s.node} data-kind={kind} role="button" tabIndex={0} aria-pressed={selected === id} aria-label={DETAILS[id].name}
    onClick={pick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}>
    <circle className={s.hit} cx={x} cy={y} r={20} />
    <circle className={s.ring} cx={x} cy={y} r={r + 5} />
    <circle className={s.dot} cx={x} cy={y} r={r} />
    {kind === 'lost' && <path d={`M${x - 3.5} ${y - 3.5} l7 7 M${x + 3.5} ${y - 3.5} l-7 7`} />}
    {label && <text x={tx} y={ty} textAnchor={anchor} className={s.label}>{label}</text>}
    {sub && <text x={tx} y={above ? ty - 14 : ty + 15} textAnchor={anchor} className={s.sub}>{sub}</text>}
  </g>;
}

export function Lineage() {
  const [selected, setSelected] = useState('r5');
  const detail = DETAILS[selected];

  return <div className={s.lineage}>
    <div className={s.scroll} tabIndex={0} role="region" aria-label="Base lineage map">
      <svg className={s.map} viewBox="0 0 960 520" role="group" aria-labelledby="map-title map-desc">
        <title id="map-title">Base lineage</title>
        <desc id="map-desc">d3-mini runs from v1 to r5, with rounds 1 to 4 branching off as candidates that lost. d3-lite starts at v1 on 20 October. A bounding-box feature track hangs below each base and graduates into that base’s next revision. Select a point for its details.</desc>
        {([[80, '17 OCT'], [300, '18 OCT'], [500, '19 OCT'], [700, '20 OCT'], [890, 'NEXT']] as const).map(([x, d]) => <g key={d}>
          <line className={s.grid} x1={x} y1={40} x2={x} y2={505} />
          <text className={s.axis} x={x} y={24} textAnchor="middle">{d}</text>
        </g>)}

        <text className={s.lane} x={16} y={64}>d3-mini 4.5B</text>
        <path className={s.rail} d="M80 160 H560" />
        <path className={s.future} d="M560 160 H890" />
        {([[190, 'tied'], [300, 'vetoed'], [390, 'vetoed'], [470, 'vetoed']] as const).map(([x, sub], i) => <g key={x}>
          <line className={s.stem} x1={x} y1={160} x2={x} y2={106} />
          <Node selected={selected} onPick={setSelected} id={`r${i + 1}`} x={x} y={98} kind={sub === 'tied' ? 'next' : 'lost'} label={`R${i + 1}`} sub={sub} above />
        </g>)}
        <Tag x={80} y={114}>stable</Tag>
        <Node selected={selected} onPick={setSelected} id="mini-v1" x={80} y={160} label="v1" sub="stock" />
        <Tag x={560} y={114}>latest</Tag>
        <Node selected={selected} onPick={setSelected} id="r5" x={560} y={160} label="r5" sub="crowned 19 Oct" left />

        <path className={s.feature} d="M560 170 V262 H800" />
        <text className={s.featureLabel} x={580} y={252}>Bounding boxes</text>
        <text className={s.score} x={580} y={284}>IoU 0.582 · Jev 1.14 0.479</text>
        <path className={s.graduate} d="M807 256 C 860 240, 890 210, 890 172" />
        <Node selected={selected} onPick={setSelected} id="mini-box" x={800} y={262} kind="feature" />
        <Node selected={selected} onPick={setSelected} id="mini-next" x={890} y={160} kind="next" label="next" above />

        <text className={s.lane} x={16} y={354}>d3-lite 0.8B</text>
        <path className={s.future} d="M700 410 H890" />
        <Node selected={selected} onPick={setSelected} id="lite-v1" x={700} y={410} label="v1" sub="stock" left />
        <path className={s.feature} d="M700 420 V478 H800" />
        <text className={s.featureLabel} x={716} y={468}>Boxes</text>
        <text className={s.score} x={608} y={500}>IoU 0.032 → 0.251</text>
        <path className={s.graduate} d="M807 472 C 860 458, 890 440, 890 422" />
        <Node selected={selected} onPick={setSelected} id="lite-box" x={800} y={478} kind="feature" />
        <Node selected={selected} onPick={setSelected} id="lite-next" x={890} y={410} kind="next" label="next" above />
      </svg>
    </div>

    <aside className={s.card} aria-live="polite">
      <span className={s.cardTag} data-tone={detail.tag.split(' ·')[0]}>{detail.tag}</span>
      <h3>{detail.name}</h3>
      <p>{detail.body}</p>
      <dl>{detail.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {detail.link && <Link href={detail.link[0]} className={s.cardLink}>{detail.link[1]}</Link>}
      <span className={s.hint}>Select any point on the map.</span>
    </aside>
  </div>;
}
