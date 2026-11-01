'use client';

import { useState, type ReactNode } from 'react';
import { InstallCommand } from '@/components/site/install-command';
import { FAMILIES, MAX_MODELS, MAX_PORTION, downloadGB, mergeCommand, type MergeFamily, type MergeMethod, type MergeModel } from '@/lib/model-merge';
import { SoupBowl } from './soup-bowl';
import s from './merge.module.css';

type Part = { id: string; parts: number };

const COLOURS = 5; // one colour per place in the bowl: --m1 … --m5 in merge.module.css
const ROLE: Record<MergeModel['role'], string> = { house: 'House model', base: 'Base', market: 'Market' };
const LICENCE: Record<MergeModel['licence'], string> = { 'apache-2.0': 'Apache-2.0', mit: 'MIT' };
const METHODS: { id: MergeMethod; name: string; about: string }[] = [
  { id: 'linear', name: 'Linear', about: 'Stirred evenly: a weighted average of every weight.' },
  { id: 'slerp', name: 'SLERP', about: 'Folded along the arc between two models. Exactly two.' },
];
const colour = (i: number) => `var(--m${(i % COLOURS) + 1})`;
const startingMix = (f: MergeFamily): Part[] => f.models.filter(m => m.role === 'house').map(m => ({ id: m.id, parts: 1 }));

export function MergeBuilder({ children }: { children: ReactNode }) {
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
  const command = mergeCommand({ family: familyId, models: ids, method, portions: mix.map(p => p.parts) });
  const specialties = ['All', ...new Set(family.models.map(m => m.specialty))];

  function pickFamily(next: MergeFamily) {
    setFamilyId(next.id);
    setMix(startingMix(next));
    setSpecialty('All');
  }
  const add = (id: string) => setMix(m => (m.length < MAX_MODELS ? [...m, { id, parts: 1 }] : m));
  const remove = (id: string) => setMix(m => (m.length > 2 ? m.filter(p => p.id !== id) : m));
  const portion = (id: string, change: number) => setMix(m => m.map(p => (p.id === id ? { ...p, parts: Math.min(MAX_PORTION, Math.max(1, p.parts + change)) } : p)));
  const first = (id: string) => setMix(m => [m.find(p => p.id === id)!, ...m.filter(p => p.id !== id)]);

  return <div className={s.builder}>
    {/* The stall: the sign and the bowl's contents on the left, the bowl itself on the right. */}
    <section className={s.stall} aria-labelledby="merge-title">
      <div className={s.counter}>
        {children}
        <fieldset className={s.toggle}>
          <legend className={s.visuallyHidden}>Family</legend>
          {FAMILIES.map(f => <label key={f.id} className={s.option}>
            <input type="radio" name="family" checked={f.id === familyId} onChange={() => pickFamily(f)} />
            <span>{f.name}</span>
          </label>)}
        </fieldset>

        <ol className={s.mix} aria-label="In the bowl">
          {mix.map((p, i) => {
            const m = model(p.id);
            return <li key={p.id} className={s.chip} style={{ '--c': colour(i) } as React.CSSProperties}>
              <i className={s.swatch} aria-hidden="true" />
              <span className={s.chipText}>
                <span className={s.chipName}>{m.label}</span>
                <span className={s.chipRole}>{i === 0 ? 'First: its files are kept' : m.specialty}</span>
              </span>
              <span className={s.chipControls}>
                <button type="button" onClick={() => portion(p.id, -1)} disabled={p.parts <= 1} aria-label={`Less ${m.label}`}>−</button>
                <span className={s.share}>{Math.round(shares[i] * 100)}%</span>
                <button type="button" onClick={() => portion(p.id, 1)} disabled={p.parts >= MAX_PORTION} aria-label={`More ${m.label}`}>+</button>
                <button type="button" onClick={() => first(p.id)} disabled={i === 0} aria-label={`Make ${m.label} first`} title="Make first">↑</button>
                <button type="button" onClick={() => remove(p.id)} disabled={mix.length <= 2} aria-label={`Take ${m.label} out`} title="Take out">×</button>
              </span>
            </li>;
          })}
        </ol>
      </div>

      <div className={s.stage} data-merge-stage="" data-method={method}>
        <SoupBowl shares={shares} method={method} />
        <p className={s.ratio}>Ratio <b>{mix.map(p => p.parts).join(':')}</b></p>
        <fieldset className={s.toggle}>
          <legend className={s.visuallyHidden}>Method</legend>
          {METHODS.map(m => <label key={m.id} className={s.option} data-off={(m.id === 'slerp' && mix.length !== 2) || undefined}>
            <input type="radio" name="method" checked={m.id === method} disabled={m.id === 'slerp' && mix.length !== 2} onChange={() => setMethod(m.id)} />
            <span>{m.name}</span>
          </label>)}
        </fieldset>
        <p className={s.about}>{METHODS.find(m => m.id === method)!.about}</p>
      </div>
    </section>

    {/* The order ticket: the recipe, then the one command that cooks it. */}
    <section className={s.ticket} aria-labelledby="order-heading">
      <h2 id="order-heading">Your order</h2>
      <ul className={s.lines} aria-label="Your order">
        {mix.map((p, i) => <li key={p.id} style={{ '--c': colour(i) } as React.CSSProperties}>
          <span><i aria-hidden="true" />{model(p.id).label}</span>
          <b>{Math.round(shares[i] * 100)}%</b>
        </li>)}
      </ul>
      <p className={s.total}><span>{METHODS.find(m => m.id === method)!.name}, {family.name}</span><span>about {downloadGB(familyId, ids)} GB to download</span></p>
      <InstallCommand command={command} label="Merge command" copiedText="Merge command copied." />
      <p className={s.fine}>Cooks on your machine with Node.js 20+ and Python 3.11+.</p>
    </section>

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
              <span className={s.facts}>Net {m.sizeGB.toFixed(1)} GB · {LICENCE[m.licence]}</span>
              {place >= 0
                ? <button type="button" className={s.added} onClick={() => remove(m.id)} disabled={mix.length <= 2} aria-label={`Remove ${m.label} from the bowl`}><i />In the bowl</button>
                : <button type="button" className={s.add} onClick={() => add(m.id)} disabled={mix.length >= MAX_MODELS} aria-label={`Add ${m.label} to the bowl`}>
                    {mix.length >= MAX_MODELS ? 'Bowl is full' : 'Add'}
                  </button>}
            </div>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
