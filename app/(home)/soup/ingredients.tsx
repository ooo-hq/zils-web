'use client';

import { useState } from 'react';
import s from './ingredients.module.css';
import { FoodIcon } from './food-icons';

// Each tier's soup starts from its own Qwen base and open house models, which enter every round and are never paid.
// Mini: zils/data/soup-house.json (zils main 16b87a6). Lite: Linear ZIL-108 (owner decision, 30 Oct 2026); its
// Qwen parent revision is not pinned yet, so that link has none.
const TIERS = {
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
  'z3-lite': {
    base: { repo: 'Qwen/Qwen3.5-0.8B', revision: null },
    house: [
      { name: 'd3-lite', repo: 'vllm-sr/d3-lite', revision: '03560c26f5199c3c04129a2ccb38960c913635e0', note: 'Also the lite chassis' },
      { name: 'Intern-Decision-0.8B', repo: 'internlm/Intern-Decision-0.8B', revision: '42457fafd13d10d0b0d9be46cb30a23caa409994' },
    ],
  },
} as const;
type Tier = keyof typeof TIERS;

const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const hf = (repo: string, revision: string | null) => `https://huggingface.co/${repo}${revision ? `/tree/${revision}` : ''}`;

/** What each tier's soup starts from: the Qwen base every body fine-tunes, and that tier's open house models. */
export function Ingredients({ heading = 'What each soup is built from' }: { heading?: string }) {
  const [tier, setTier] = useState<Tier>('z3-mini');
  const { base, house } = TIERS[tier];
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
    <p className={s.lead}>{COUNT[house.length]} open models already fine-tuned from that base go into the pool every round. They are the free starting point: a soup can be built from them alone, and they are never paid. Your body joins only if it makes the soup better.</p>
    <ul className={s.list}>
      {house.map(m => <li key={m.name}>
        <a href={hf(m.repo, m.revision)}>{m.name}</a>
        <span className={s.by}>by {m.repo.split('/')[0]}{'note' in m ? ` · ${m.note}` : ''}</span>
      </li>)}
    </ul>
    <p className={s.later}>Nano, flash and z3 get their own house models when they open.</p>
  </section>;
}
