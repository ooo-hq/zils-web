'use client';

import { useState } from 'react';
import s from './ingredients.module.css';
import { FoodIcon } from './food-icons';
import { TIERS, hfTree as hf, type Tier } from '@/lib/soup-tiers';

const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five'];

/** What each tier's soup starts from: the Qwen base every body fine-tunes, and that tier's open house models. */
export function Ingredients({ heading = 'What each soup is built from' }: { heading?: string }) {
  const [tier, setTier] = useState<Tier>('z3-mini');
  const { base, house } = TIERS[tier];
  const later = 'later' in TIERS[tier];
  const one = house.length === 1;
  return <section className={s.wrap} aria-label="What each soup is built from">
    <div className={s.top}>
      <h3 className={s.title}><FoodIcon name="naruto" />{heading}</h3>
      <div className={s.tiers} role="group" aria-label="Tier">
        {(Object.keys(TIERS) as Tier[]).map(t => <button key={t} type="button" aria-pressed={t === tier} onClick={() => setTier(t)}>{t}</button>)}
      </div>
    </div>
    <div className={s.base}>
      <span className={s.label}>Base</span>
      <a href={hf(base.repo, base.revision)}>{base.repo}</a>
      <span className={s.by}>by Qwen · every {tier} body is a fine-tune of it</span>
    </div>
    <p className={s.lead}>{COUNT[house.length]} open {one ? 'model' : 'models'} already fine-tuned from that base {one ? 'goes' : 'go'} into the pool every round. {one ? 'It is' : 'They are'} the free starting point and {one ? 'is' : 'are'} never paid. Your body joins only if it makes the soup better.</p>
    <ul className={s.list}>
      {house.map(m => <li key={m.name}>
        <a href={hf(m.repo, m.revision)}>{m.name}</a>
        <span className={s.by}>by {m.repo.split('/')[0]}{'note' in m ? ` · ${m.note}` : ''}</span>
      </li>)}
    </ul>
    {later && <p className={s.later}>Opens later: this pool runs no rounds and pays nothing until its opening block; its share burns until then.</p>}
  </section>;
}
