// Each tier's soup starts from its own Qwen base and open house models, which enter every round and are never paid.
// zils main 0974870: zils/data/soup-house*.json and the "Four pools" table in docs/mining.md. z3 opens later; flash is off (owner, 6 Nov 2026: its pool is closed on validators).
export const TIERS = {
  'z3-lite': {
    pool: 'd3-lite', size: '0.8B',
    base: { repo: 'Qwen/Qwen3.5-0.8B', revision: '2fc06364715b967f1860aea9cf38778875588b17' },
    house: [
      { name: 'd3-lite', repo: 'vllm-sr/d3-lite', revision: '03560c26f5199c3c04129a2ccb38960c913635e0', note: 'Also the lite chassis' },
      { name: 'Intern-Decision-0.8B', repo: 'internlm/Intern-Decision-0.8B', revision: '42457fafd13d10d0b0d9be46cb30a23caa409994' },
    ],
  },
  'z3-mini': {
    pool: 'd3-mini', size: '4.5B',
    base: { repo: 'Qwen/Qwen3.5-4B', revision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a' },
    house: [
      { name: 'd3-mini', repo: 'vllm-sr/d3-mini', revision: 'df99bf4ca4418bc6908ee68e9b7479af1f3b8800', note: 'Also z3-mini v1, the founding baseline' },
      { name: 'pplx-decider-flash-v1.2', repo: 'perplexity-ai/pplx-decider-flash-v1.2', revision: '9ff7cf9838e59df461c276b7699d56b244d2af58' },
      { name: 'torchcast-decision-4b', repo: 'torchcast-ai/torchcast-decision-4b', revision: '492bfb19662f3c6e601cc9c4bd2911ac95609ed4' },
      { name: 'Matilda-Decision-v1-Mini', repo: 'Maincode/Matilda-Decision-v1-Mini', revision: '39479a8a372987bf81ec867e8fc3b2cc364ff343' },
      { name: 'KnowLine-4B-Gen5', repo: 'PelaAI/KnowLine-4B-Gen5', revision: 'a8e0cd664f88bd2d2561dc69de74fdc48c641da5' },
    ],
  },
  'z3': {
    pool: 'd3', size: '27B',
    later: true,
    base: { repo: 'Qwen/Qwen3.8-27B', revision: '1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0' },
    house: [{ name: 'd3-ultra', repo: 'vllm-sr/d3-ultra', revision: '52ba9e7a00402f9560c7fba8c039608e7ddee7fb', note: 'Also the z3 chassis' }],
  },
} as const;
export type Tier = keyof typeof TIERS;
export const TIER_NAMES = Object.keys(TIERS) as Tier[];

/** The tier a validator pool id belongs to (d3-mini → z3-mini), or null for a pool this page does not know. */
export function poolTier(pool: string): Tier | null {
  return TIER_NAMES.find(t => TIERS[t].pool === pool) ?? null;
}

export const hfTree = (repo: string, revision: string) => `https://huggingface.co/${repo}/tree/${revision}`;
