'use client';

import { useState } from 'react';
import { InstallCommand } from '@/components/site/install-command';
import { DEFAULT_WEIGHT, FAMILIES, mergeCommand, roundWeight, type MergeFamily, type MergeMethod } from '@/lib/model-merge';
import s from './merge.module.css';

const METHODS: { id: MergeMethod; name: string; about: string }[] = [
  { id: 'linear', name: 'Linear', about: 'A weighted average of every weight.' },
  { id: 'slerp', name: 'SLERP', about: 'Follows the arc between the two models instead of the straight line.' },
];

export function MergeBuilder() {
  const [familyId, setFamilyId] = useState<MergeFamily['id']>('lite');
  const family = FAMILIES.find(f => f.id === familyId) ?? FAMILIES[0];
  const [first, setFirst] = useState(family.models[0].id);
  const [second, setSecond] = useState(family.models[1].id);
  const [method, setMethod] = useState<MergeMethod>('linear');
  const [weight, setWeight] = useState(DEFAULT_WEIGHT);
  const label = (id: string) => family.models.find(m => m.id === id)?.label ?? id;
  const note = (id: string) => family.models.find(m => m.id === id)?.note ?? '';
  const share = roundWeight(weight);

  function pickFamily(next: MergeFamily) {
    setFamilyId(next.id);
    setFirst(next.models[0].id);
    setSecond(next.models[1].id);
  }
  function pickFirst(id: string) {
    setFirst(id);
    if (id === second) setSecond(family.models.find(m => m.id !== id)!.id);
  }

  return <div className={s.builder}>
    <fieldset className={s.group}>
      <legend className={s.legend}>Family</legend>
      <div className={s.choices}>
        {FAMILIES.map(f => <button key={f.id} type="button" className={s.choice} aria-pressed={f.id === familyId} onClick={() => pickFamily(f)}>
          <span>{f.name}</span><small>{f.base}</small>
        </button>)}
      </div>
      <p className={s.hint}>Both models share this base, so their weights line up. Download: {family.download}.</p>
    </fieldset>

    <div className={s.pair}>
      <label className={s.group}>
        <span className={s.legend}>First model · its files are kept</span>
        <select className={s.select} value={first} onChange={e => pickFirst(e.target.value)}>
          {family.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span className={s.hint}>{note(first)} · <code>{first}</code></span>
      </label>
      <label className={s.group}>
        <span className={s.legend}>Second model</span>
        <select className={s.select} value={second} onChange={e => setSecond(e.target.value)}>
          {family.models.filter(m => m.id !== first).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span className={s.hint}>{note(second)} · <code>{second}</code></span>
      </label>
    </div>

    <fieldset className={s.group}>
      <legend className={s.legend}>Method</legend>
      <div className={s.choices}>
        {METHODS.map(m => <button key={m.id} type="button" className={s.choice} aria-pressed={m.id === method} onClick={() => setMethod(m.id)}>
          <span>{m.name}</span><small>{m.about}</small>
        </button>)}
      </div>
    </fieldset>

    <label className={s.group}>
      <span className={s.legend}>Mix</span>
      <input className={s.range} type="range" min={0.05} max={0.95} step={0.05} value={share}
        onChange={e => setWeight(Number(e.target.value))}
        aria-valuetext={`${Math.round((1 - share) * 100)}% ${label(first)}, ${Math.round(share * 100)}% ${label(second)}`} />
      <span className={s.mix}>
        <span>{label(first)} <b>{Math.round((1 - share) * 100)}%</b></span>
        <span><b>{Math.round(share * 100)}%</b> {label(second)}</span>
      </span>
    </label>

    <div className={s.group}>
      <span className={s.legend}>Run it</span>
      <InstallCommand command={mergeCommand({ family: familyId, first, second, method, weight: share })} label="Merge command" copiedText="Merge command copied." />
      <p className={s.hint}>Needs Node.js 20+ and Python 3.11+. The merged model is written to a new folder on your machine.</p>
    </div>
  </div>;
}
