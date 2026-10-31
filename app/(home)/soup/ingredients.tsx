'use client';

import { useState } from 'react';
import s from './ingredients.module.css';
import { FoodIcon } from './food-icons';

// Each tier's soup starts from its own Qwen base and open house models, which enter every round and are never paid.
// zils main 0974870: zils/data/soup-house*.json and the "Four pools" table in docs/mining.md. Flash and z3 open later.
const TIERS = {
  'z3-lite': {
    base: { repo: 'Qwen/Qwen3.5-0.8B', revision: '2fc06364715b967f1860aea9cf38778875588b17' },
    house: [
      { name: 'd3-lite', repo: 'vllm-sr/d3-lite', revision: '03560c26f5199c3c04129a2ccb38960c913635e0', note: 'Also the lite chassis' },
      { name: 'Intern-Decision-0.8B', repo: 'internlm/Intern-Decision-0.8B', revision: '42457fafd13d10d0b0d9be46cb30a23caa409994' },
    ],
  },
  'z3-mini': {
    base: { repo: 'Qwen/Qwen3.5-4B', revision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a' },
    house: [
      { name: 'd3-mini', repo: 'vllm-sr/d3-mini', revision: 'df99bf4ca4418bc6908ee68e9b7479af1f3b8800', note: 'Also z3-mini v1, the founding baseline' },
      { name: 'pplx-decider-flash-v1.2', repo: 'perplexity-ai/pplx-decider-flash-v1.2', revision: '9ff7cf9838e59df461c276b7699d56b244d2af58' },
      { name: 'torchcast-decision-4b', repo: 'torchcast-ai/torchcast-decision-4b', revision: '492bfb19662f3c6e601cc9c4bd2911ac95609ed4' },
      { name: 'Matilda-Decision-v1-Mini', repo: 'Maincode/Matilda-Decision-v1-Mini', revision: '39479a8a372987bf81ec867e8fc3b2cc364ff343' },
      { name: 'KnowLine-4B-Gen5', repo: 'PelaAI/KnowLine-4B-Gen5', revision: 'a8e0cd664f88bd2d2561dc69de74fdc48c641da5' },
    ],
  },
  'z3-flash': {
    later: true,
    base: { repo: 'Qwen/Qwen3.5-9B', revision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a' },
    house: [{ name: 'd3-flash', repo: 'vllm-sr/d3-flash', revision: '13dc1cc8ef23caefa765907e1d764751e5629f7d', note: 'Also the flash chassis' }],
  },
  'z3': {
    later: true,
    base: { repo: 'Qwen/Qwen3.8-27B', revision: '1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0' },
    house: [{ name: 'd3-ultra', repo: 'vllm-sr/d3-ultra', revision: '52ba9e7a00402f9560c7fba8c039608e7ddee7fb', note: 'Also the z3 chassis' }],
  },
} as const;
type Tier = keyof typeof TIERS;

const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const hf = (repo: string, revision: string) => `https://huggingface.co/${repo}/tree/${revision}`;

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
    {later && <p className={s.later}>Opens later: this pool runs no rounds and pays nothing until its opening block, then pays a boosted share for its first weeks.</p>}
  </section>;
}
