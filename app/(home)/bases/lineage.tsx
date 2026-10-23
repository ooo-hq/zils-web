'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from './bases.module.css';

type Kind = 'base' | 'lost' | 'next' | 'feature';
type Detail = { tag: string; name: string; body: string; facts: [string, string][]; link?: [string, string] };

// Sources: output/base-promotion-rehearsal-2026-10-17, base-round-2-2026-10-18, base-round-3-2026-10-18,
// box-mvp-2026-10-19 and d3-lite-box-2026-10-20 reports. Box scores are research runs, not track results.
const DETAILS: Record<string, Detail> = {
  'mini-v1': { tag: 'Base · stable and latest', name: 'z3-mini 4.5B · v1', body: 'The vendor checkpoint, chosen as the first base for its video, multi-image and extra question types. It is the base every customer model runs on.',
    facts: [['Adopted baseline', '17 Oct'], ['Channel', 'stable and latest']] },
  r1: { tag: 'Candidate · tied', name: 'Round 1', body: 'Tied v1 on the sealed exams, so it was not eligible. The regression suite passed.',
    facts: [['Exam Brier', '0.1782 vs 0.1790'], ['Date', '17–18 Oct']] },
  r2: { tag: 'Candidate · vetoed', name: 'Round 2', body: 'Beat v1 on two sealed exams, but customer adapters retrained on it got worse. The regression suite vetoed it.',
    facts: [['Exam Brier', '0.1326 vs 0.1790'], ['Second exam', '0.0725 vs 0.1303'], ['Date', '18 Oct']] },
  r3: { tag: 'Candidate · vetoed', name: 'Round 3', body: 'Stopped by the regression suite.', facts: [['Date', '18 Oct']] },
  r4: { tag: 'Candidate · vetoed', name: 'Round 4', body: 'Half of the round 3 change merged into v1. Still failed the regression suite on individual seeds.', facts: [['Date', '19 Oct']] },
  r5: { tag: 'Candidate · withdrawn', name: 'Round 5', body: 'A quarter merge of the round 3 change. It passed the exams twice and was briefly crowned as a test, but a broad outside benchmark found it no better than v1, so it was withdrawn and v1 stays the base.',
    facts: [['Crowned', '19 Oct'], ['Withdrawn', '21 Oct']] },
  'mini-next': { tag: 'Next revision', name: 'Mini, next', body: 'Whatever beats v1 next. A box crown does not enter this release automatically: graduation requires real-image qualification, the full base regression suite and a separate review. No box skill has graduated.',
    facts: [['Status', 'Open']], link: ['/miners', 'Compete for a base'] },
  'mini-box': { tag: 'Feature track · testnet', name: 'Bounding boxes on mini', body: 'A synthetic-only pilot on the exact mini v1 parent, using four edge questions plus target presence. No qualified king yet. The historical scores below came from v1 research, not a pilot exam.',
    facts: [['Research adapter IoU', '0.582'], ['Jev 1.14 · research', '0.479'], ['Stock v1 · research', '0.075']], link: ['/miners/tracks/box', 'Box track'] },
  'lite-v1': { tag: 'Base · stock', name: 'd3-lite 0.8B · v1', body: 'A smaller base, about twice as fast as mini at a quarter of the memory. It has its own competition and its own kings; lite and mini never compete against each other.',
    facts: [['Added', '20 Oct']] },
  'lite-box': { tag: 'Feature track · testnet', name: 'Bounding boxes on lite', body: 'A separate synthetic-only pilot on lite v1, with no qualified king yet. Historical research reached IoU 0.5 on only 3 of 122 real-defect images, versus mini’s 42. It does not establish real-image quality; the timings below are from separate runs.',
    facts: [['Stock lite · research', '0.032'], ['Research adapter IoU', '0.251'], ['Research time per box', '0.6 s (mini 3.3 s)']], link: ['/miners/tracks/box', 'Box track'] },
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
  const [selected, setSelected] = useState('mini-v1');
  const detail = DETAILS[selected];

  return <div className={s.lineage}>
    <div className={s.scroll} tabIndex={0} role="region" aria-label="Base lineage map">
      <svg className={s.map} viewBox="0 0 960 520" role="group" aria-labelledby="map-title map-desc">
        <title id="map-title">Base lineage</title>
        <desc id="map-desc">z3-mini uses the original d3-mini v1 baseline, with rounds 1 to 5 branching off as candidates that lost or were withdrawn. d3-lite starts at v1 on 20 October. Separate synthetic-only box tracks hang below mini v1 and lite v1. Neither has a qualified king. Base graduation requires real-image qualification and a separate regression review. Select a point for its details.</desc>
        {([[80, '17 OCT'], [300, '18 OCT'], [500, '19 OCT'], [700, '20 OCT'], [890, 'NEXT']] as const).map(([x, d]) => <g key={d}>
          <line className={s.grid} x1={x} y1={40} x2={x} y2={505} />
          <text className={s.axis} x={x} y={24} textAnchor="middle">{d}</text>
        </g>)}

        <text className={s.lane} x={16} y={64}>z3-mini 4.5B</text>
        <path className={s.future} d="M80 160 H890" />
        {([[190, 'tied'], [300, 'vetoed'], [390, 'vetoed'], [470, 'vetoed'], [560, 'withdrawn']] as const).map(([x, sub], i) => <g key={x}>
          <line className={s.stem} x1={x} y1={160} x2={x} y2={106} />
          <Node selected={selected} onPick={setSelected} id={`r${i + 1}`} x={x} y={98} kind={sub === 'tied' ? 'next' : 'lost'} label={`R${i + 1}`} sub={sub} above />
        </g>)}
        <Tag x={80} y={114}>stable · latest</Tag>
        <Node selected={selected} onPick={setSelected} id="mini-v1" x={80} y={160} label="v1" sub="stock" />

        <path className={s.feature} d="M80 170 V262 H800" />
        <text className={s.featureLabel} x={100} y={252}>Bounding boxes</text>
        <text className={s.score} x={100} y={284}>v1 research IoU 0.582</text>
        <Node selected={selected} onPick={setSelected} id="mini-box" x={800} y={262} kind="feature" />
        <Node selected={selected} onPick={setSelected} id="mini-next" x={890} y={160} kind="next" label="next" above />

        <text className={s.lane} x={16} y={354}>d3-lite 0.8B</text>
        <path className={s.future} d="M700 410 H890" />
        <Node selected={selected} onPick={setSelected} id="lite-v1" x={700} y={410} label="v1" sub="stock" left />
        <path className={s.feature} d="M700 420 V478 H800" />
        <text className={s.featureLabel} x={716} y={468}>Boxes</text>
        <text className={s.score} x={608} y={500}>Research IoU 0.032 → 0.251</text>
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
