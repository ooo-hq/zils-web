import s from './ingredients.module.css';

// The pinned Qwen parent and the five house models, from zils/data/soup-house.json (zils main 16b87a6).
// Every body is a fine-tune of this Qwen revision; house models enter every round and are never paid.
const QWEN = { repo: 'Qwen/Qwen3.5-4B', revision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a' };

export const HOUSE = [
  { name: 'd3-mini', repo: 'vllm-sr/d3-mini', revision: 'df99bf4ca4418bc6908ee68e9b7479af1f3b8800', note: 'Also z3-mini v1, the founding baseline' },
  { name: 'pplx-decider-flash-v1.2', repo: 'perplexity-ai/pplx-decider-flash-v1.2', revision: '9ff7cf9838e59df461c276b7699d56b244d2af58' },
  { name: 'torchcast-decision-4b', repo: 'torchcast-ai/torchcast-decision-4b', revision: '492bfb19662f3c6e601cc9c4bd2911ac95609ed4' },
  { name: 'Matilda-Decision-v1-Mini', repo: 'Maincode/Matilda-Decision-v1-Mini', revision: '39479a8a372987bf81ec867e8fc3b2cc364ff343' },
  { name: 'KnowLine-4B-Gen5', repo: 'PelaAI/KnowLine-4B-Gen5', revision: 'a8e0cd664f88bd2d2561dc69de74fdc48c641da5' },
] as const;

const hf = (repo: string, revision: string) => `https://huggingface.co/${repo}/tree/${revision}`;

/** What the z3-mini soup starts from: the Qwen base every body fine-tunes, and the five open house models. */
export function Ingredients({ heading = 'What the soup is built from' }: { heading?: string }) {
  return <section className={s.wrap} aria-label="What the mini soup is built from">
    <h3 className={s.title}>{heading}</h3>
    <div className={s.base}>
      <span className={s.label}>Base</span>
      <a href={hf(QWEN.repo, QWEN.revision)}>{QWEN.repo}</a>
      <span className={s.by}>by Qwen · every body is a fine-tune of this revision</span>
    </div>
    <p className={s.lead}>Five open models already fine-tuned from that base go into the pool every round. They are the free starting point: a soup can be built from them alone, and they are never paid. Your body joins only if it makes the soup better.</p>
    <ul className={s.list}>
      {HOUSE.map(m => <li key={m.name}>
        <a href={hf(m.repo, m.revision)}>{m.name}</a>
        <span className={s.by}>by {m.repo.split('/')[0]}{'note' in m ? ` · ${m.note}` : ''}</span>
      </li>)}
    </ul>
  </section>;
}
