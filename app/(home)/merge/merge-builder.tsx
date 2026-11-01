'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { InstallCommand } from '@/components/site/install-command';
import { FAMILIES, MAX_MODELS, MAX_PORTION, downloadGB, mergeCommand, type MergeFamily, type MergeMethod, type MergeModel } from '@/lib/model-merge';
import s from './merge.module.css';

type Part = { id: string; parts: number };

const COLOURS = 5; // one colour per place in the mix: --m1 … --m5 in merge.module.css
const DOTS = 18;
const ROLE: Record<MergeModel['role'], string> = { house: 'House model', base: 'Base', market: 'Market' };
const METHODS: { id: MergeMethod; name: string; about: string }[] = [
  { id: 'linear', name: 'Linear', about: 'A straight weighted average of every weight.' },
  { id: 'slerp', name: 'SLERP', about: 'Follows the arc between two models. Exactly two.' },
];
const colour = (i: number) => `var(--m${(i % COLOURS) + 1})`;
const startingMix = (f: MergeFamily): Part[] => f.models.filter(m => m.role === 'house').map(m => ({ id: m.id, parts: 1 }));

/** Wires from the chosen models to the tile: straight for a linear average, arcs for SLERP. */
function wire(from: DOMRect, to: DOMRect, stage: DOMRect, method: MergeMethod) {
  const x1 = from.left + from.width / 2 - stage.left, y1 = from.bottom - stage.top;
  const x2 = to.left + to.width / 2 - stage.left, y2 = to.top - stage.top;
  return method === 'linear' ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} Q${x1} ${y2} ${x2} ${y2}`;
}

/** Particles drifting into the tile, each model's from its own arc, counted by its share. */
function particles(shares: number[]) {
  const dots: { key: string; slot: number; angle: number; phase: number }[] = [];
  let start = -90;
  shares.forEach((share, slot) => {
    const count = Math.max(1, Math.round(share * DOTS)), span = share * 360;
    for (let k = 0; k < count; k++) dots.push({ key: `${slot}-${k}`, slot, angle: start + ((k + 0.5) / count) * span, phase: k / count });
    start += span;
  });
  return dots;
}

export function MergeBuilder() {
  const [familyId, setFamilyId] = useState<MergeFamily['id']>('lite');
  const family = FAMILIES.find(f => f.id === familyId)!;
  const [mix, setMix] = useState<Part[]>(() => startingMix(family));
  const [specialty, setSpecialty] = useState('All');
  const [chosenMethod, setMethod] = useState<MergeMethod>('linear');
  const method: MergeMethod = mix.length === 2 ? chosenMethod : 'linear';
  const model = (id: string) => family.models.find(m => m.id === id)!;
  const total = mix.reduce((sum, p) => sum + p.parts, 0);
  const shares = mix.map(p => p.parts / total);
  const ids = mix.map(p => p.id);
  const key = ids.join(' ');
  const command = mergeCommand({ family: familyId, models: ids, method, portions: mix.map(p => p.parts) });
  const specialties = ['All', ...new Set(family.models.map(m => m.specialty))];

  const stage = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  const chips = useRef(new Map<string, HTMLElement>());
  const [wires, setWires] = useState<string[]>([]);
  useLayoutEffect(() => {
    const draw = () => {
      const box = stage.current?.getBoundingClientRect(), target = tile.current?.getBoundingClientRect();
      if (!box || !target) return;
      const rects = key.split(' ').map(id => chips.current.get(id)?.getBoundingClientRect());
      setWires(rects.filter((r): r is DOMRect => Boolean(r)).map(r => wire(r, target, box, method)));
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [key, method]);

  function pickFamily(next: MergeFamily) {
    setFamilyId(next.id);
    setMix(startingMix(next));
    setSpecialty('All');
  }
  const add = (id: string) => setMix(m => (m.length < MAX_MODELS ? [...m, { id, parts: 1 }] : m));
  const remove = (id: string) => setMix(m => (m.length > 2 ? m.filter(p => p.id !== id) : m));
  const portion = (id: string, change: number) => setMix(m => m.map(p => (p.id === id ? { ...p, parts: Math.min(MAX_PORTION, Math.max(1, p.parts + change)) } : p)));
  const first = (id: string) => setMix(m => [m.find(p => p.id === id)!, ...m.filter(p => p.id !== id)]);
  // Each model's colour holds the middle of its share of the tile and blends into its neighbours at the edges.
  const starts = shares.map((_, i) => shares.slice(0, i).reduce((sum, share) => sum + share, 0) * 100);
  const stops = shares.flatMap((share, i) => [
    `${colour(i)} ${starts[i] + share * 30}%`,
    `${colour(i)} ${starts[i] + share * 70}%`,
  ]);

  return <div className={s.builder}>
    <fieldset className={s.toggle}>
      <legend className={s.visuallyHidden}>Family</legend>
      {FAMILIES.map(f => <label key={f.id} className={s.option}>
        <input type="radio" name="family" checked={f.id === familyId} onChange={() => pickFamily(f)} />
        <span>{f.name}</span>
      </label>)}
    </fieldset>

    <div ref={stage} className={s.stage} data-merge-stage="" data-method={method}>
      <svg className={s.wires} aria-hidden="true">
        {wires.map((d, i) => <path key={`${ids[i]}-${method}`} d={d} style={{ stroke: colour(i) }} />)}
      </svg>

      <ol className={s.mix} aria-label="In the mix">
        {mix.map((p, i) => {
          const m = model(p.id);
          return <li key={p.id} ref={el => { if (el) chips.current.set(p.id, el); else chips.current.delete(p.id); }}
            className={s.chip} style={{ '--c': colour(i) } as React.CSSProperties}>
            <span className={s.chipName}><i aria-hidden="true" />{m.label}</span>
            <span className={s.chipRole}>{i === 0 ? 'First: its files are kept' : m.specialty}</span>
            <span className={s.chipControls}>
              <button type="button" onClick={() => portion(p.id, -1)} disabled={p.parts <= 1} aria-label={`Less ${m.label}`}>−</button>
              <span className={s.share}>{Math.round(shares[i] * 100)}%</span>
              <button type="button" onClick={() => portion(p.id, 1)} disabled={p.parts >= MAX_PORTION} aria-label={`More ${m.label}`}>+</button>
              {i > 0 && <button type="button" onClick={() => first(p.id)} aria-label={`Make ${m.label} first`} title="Make first">↑</button>}
              <button type="button" onClick={() => remove(p.id)} disabled={mix.length <= 2} aria-label={`Take ${m.label} out`} title="Take out">×</button>
            </span>
          </li>;
        })}
      </ol>

      <div className={s.orb} aria-hidden="true">
        {particles(shares).map(dot => <i key={dot.key} className={s.dot}
          style={{ '--angle': `${dot.angle}deg`, '--phase': dot.phase, background: colour(dot.slot) } as React.CSSProperties} />)}
        <div ref={tile} className={s.tile} style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }}>
          <span>{mix.map(p => p.parts).join(':')}</span>
        </div>
      </div>

      <fieldset className={s.toggle}>
        <legend className={s.visuallyHidden}>Method</legend>
        {METHODS.map(m => <label key={m.id} className={s.option} data-off={(m.id === 'slerp' && mix.length !== 2) || undefined}>
          <input type="radio" name="method" checked={m.id === method} disabled={m.id === 'slerp' && mix.length !== 2} onChange={() => setMethod(m.id)} />
          <span>{m.name}</span>
        </label>)}
      </fieldset>
      <p className={s.about}>{METHODS.find(m => m.id === method)!.about}</p>
    </div>

    <div className={s.run}>
      <InstallCommand command={command} label="Merge command" copiedText="Merge command copied." />
      <p className={s.fine}>Runs on your machine with Node.js 20+ and Python 3.11+. {mix.length} models, about {downloadGB(familyId, ids)} GB to download.</p>
    </div>

    <section className={s.market} aria-labelledby="market-heading">
      <div className={s.marketTop}>
        <h2 id="market-heading">The market</h2>
        <fieldset className={s.filters}>
          <legend className={s.visuallyHidden}>Specialty</legend>
          {specialties.map(name => <label key={name} className={s.option}>
            <input type="radio" name="specialty" checked={name === specialty} onChange={() => setSpecialty(name)} />
            <span>{name}</span>
          </label>)}
        </fieldset>
      </div>
      <div className={s.cards}>
        {family.models.filter(m => specialty === 'All' || m.specialty === specialty).map(m => {
          const place = ids.indexOf(m.id);
          return <article key={m.id} className={s.card} data-in={place >= 0 || undefined}
            style={{ '--c': place >= 0 ? colour(place) : undefined } as React.CSSProperties} aria-labelledby={`card-${m.id}`}>
            <div className={s.cardTop}>
              <span className={s.tag}>{m.specialty}</span>
              <span className={s.role} data-role={m.role}>{ROLE[m.role]}</span>
            </div>
            <h3 id={`card-${m.id}`}>{m.label}</h3>
            <p className={s.maker}>by {m.maker}</p>
            <p className={s.note}>{m.note}</p>
            <div className={s.cardFoot}>
              <span className={s.facts}>{m.sizeGB.toFixed(1)} GB · Apache-2.0</span>
              {place >= 0
                ? <button type="button" className={s.added} onClick={() => remove(m.id)} disabled={mix.length <= 2} aria-label={`Remove ${m.label} from the mix`}><i />In the mix</button>
                : <button type="button" className={s.add} onClick={() => add(m.id)} disabled={mix.length >= MAX_MODELS} aria-label={`Add ${m.label} to the mix`}>
                    {mix.length >= MAX_MODELS ? 'Mix is full' : 'Add'}
                  </button>}
            </div>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
