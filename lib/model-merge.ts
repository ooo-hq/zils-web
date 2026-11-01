/** Curated same-family models for /merge and the `zils merge` command the page builds. */

export type MergeMethod = 'linear' | 'slerp';
export type MergeModel = { id: string; label: string; note: string; licence: 'apache-2.0' | 'mit' };
export type MergeFamily = { id: 'lite' | 'mini'; name: string; base: string; download: string; models: MergeModel[] };

// Full-weight fine-tunes of one Qwen3.5 base each, shape-checked against the d3 chassis (zils lite and mini
// cousin searches, 31 Oct and 1 Nov 2026). Apache-2.0 or MIT only; bodies that break on the d3 chassis
// (Jev-Style v3, clef-vision) are left out. The first model of each family is the house model.
export const FAMILIES: MergeFamily[] = [
  {
    id: 'lite',
    name: 'Lite · 0.8B',
    base: 'Qwen/Qwen3.5-0.8B',
    download: 'about 1.7 GB per model',
    models: [
      { id: 'vllm-sr/d3-lite', label: 'z3-lite (d3-lite)', note: 'The lite decision model, with its answer layer', licence: 'apache-2.0' },
      { id: 'eljiwo/jiwo-0.8b', label: 'jiwo', note: 'Decision fine-tune with a d3-style answer layer', licence: 'apache-2.0' },
      { id: 'cribl-ai/cribl-decision-2-0.8B', label: 'Cribl Decision 2', note: 'IT and security decisions', licence: 'apache-2.0' },
      { id: 'Maincode/Matilda-Decision-v1-Edge', label: 'Matilda Edge', note: 'Decision model for small devices', licence: 'apache-2.0' },
      { id: 'OmniJev/OneJev1.6-0.8B', label: 'OneJev 1.6', note: 'Decisions with images and screens', licence: 'apache-2.0' },
      { id: 'internlm/Intern-Decision-0.8B', label: 'Intern Decision', note: 'General decisions from InternLM', licence: 'apache-2.0' },
      { id: 'Mapika/decider-0.8b', label: 'decider', note: 'Text-only general decisions', licence: 'apache-2.0' },
      { id: 'PelaAI/KnowLine-0.8B-Gen1', label: 'KnowLine Gen1', note: 'Decisions, trained mostly in Chinese', licence: 'apache-2.0' },
      { id: 'Qwen/Qwen3.5-0.8B', label: 'Qwen3.5 0.8B', note: 'The shared base: pulls a mix back toward it', licence: 'apache-2.0' },
    ],
  },
  {
    id: 'mini',
    name: 'Mini · 4B',
    base: 'Qwen/Qwen3.5-4B',
    download: 'about 9 GB per model; 20 GB free disk',
    models: [
      { id: 'zils-ai/z3-mini-v1', label: 'z3-mini v1', note: 'The mini decision model, with its answer layer', licence: 'apache-2.0' },
      { id: 'zils-ai/z3-mini-soup-preview', label: 'z3-mini soup preview', note: 'A weight average of three decision models', licence: 'apache-2.0' },
      { id: 'torchcast-ai/torchcast-decision-4b', label: 'Torchcast Decision', note: 'General typed decisions', licence: 'apache-2.0' },
      { id: 'perplexity-ai/pplx-decider-flash-v1.2', label: 'pplx decider flash', note: 'General typed decisions', licence: 'apache-2.0' },
      { id: 'akta-pro/d3-mini-multi', label: 'd3-mini multi', note: 'A d3-mini fine-tune for multi-label answers', licence: 'apache-2.0' },
      { id: 'Accuknoxtechnologies/accuknox-guard-1.2', label: 'AccuKnox Guard 1.2', note: 'A d3-mini fine-tune for AI safety checks', licence: 'apache-2.0' },
      { id: 'Maincode/Matilda-Decision-v1-Mini', label: 'Matilda Mini', note: 'Decisions with images', licence: 'apache-2.0' },
      { id: 'cribl-ai/cribl-decision-2-4B', label: 'Cribl Decision 2 4B', note: 'IT and security decisions', licence: 'apache-2.0' },
      { id: 'PelaAI/KnowLine-4B-Gen5.5', label: 'KnowLine Gen5.5', note: 'Decisions, trained mostly in Chinese', licence: 'apache-2.0' },
      { id: 'Qwen/Qwen3.5-4B', label: 'Qwen3.5 4B', note: 'The shared base: pulls a mix back toward it', licence: 'apache-2.0' },
    ],
  },
];

export const DEFAULT_WEIGHT = 0.5;

/** `./<first>-x-<second>`, from the repo names. */
export function outputName(first: string, second: string) {
  const name = (id: string) => id.split('/').pop() ?? id;
  return `./${name(first)}-x-${name(second)}`;
}

/** The weight shown and sent: the second model's share, rounded to 0.05. */
export function roundWeight(weight: number) {
  return Math.round(weight * 20) / 20;
}

export function mergeCommand({ family, first, second, method, weight }: {
  family: string; first: string; second: string; method: string; weight: number;
}) {
  const models = FAMILIES.find(f => f.id === family)?.models.map(m => m.id) ?? [];
  if (!models.includes(first) || !models.includes(second)) throw new Error('Pick two models from the same family.');
  if (first === second) throw new Error('Pick two different models.');
  if (method !== 'linear' && method !== 'slerp') throw new Error(`Unknown merge method ${method}.`);
  const share = roundWeight(weight);
  if (!(share > 0 && share < 1)) throw new Error('The weight must be between 0 and 1.');
  let command = `npx @zils/cli merge ${first} ${second} --out ${outputName(first, second)}`;
  if (method !== 'linear') command += ` --method ${method}`;
  if (share !== DEFAULT_WEIGHT) command += ` --weight ${share}`;
  return command;
}
