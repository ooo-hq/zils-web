/** The /merge market: same-family models you can blend with `zils merge`, and the command it builds. */

export type MergeMethod = 'linear' | 'slerp';
export type Role = 'house' | 'base' | 'market';
export type MergeModel = {
  id: string; label: string; maker: string; specialty: string; note: string;
  sizeGB: number; licence: 'apache-2.0' | 'mit'; role: Role;
};
export type MergeFamily = { id: 'lite' | 'mini'; name: string; base: string; models: MergeModel[] };

export const MAX_MODELS = 5; // a soup holds at most five bodies
export const MAX_PORTION = 3; // parts per model

// Full-weight fine-tunes of one Qwen3.5 base each, shape-checked against the d3 chassis (zils lite and mini cousin
// searches, 31 Oct and 1 Nov 2026) and header-checked against `zils merge`'s rules. Apache-2.0 or MIT only.
// House models match the soup page (zils/data/soup-house*.json). Left out: bodies that break on the d3 chassis
// (Jev-Style v3, clef-vision) and LemonDecider, whose `backbone.` weight names don't line up.
export const FAMILIES: MergeFamily[] = [
  {
    id: 'lite',
    name: 'Lite · 0.8B',
    base: 'Qwen/Qwen3.5-0.8B',
    models: [
      { id: 'vllm-sr/d3-lite', label: 'd3-lite', maker: 'vLLM Semantic Router', specialty: 'Vision', note: 'The lite chassis. Put it first and the soup keeps its answer layer.', sizeGB: 1.71, licence: 'apache-2.0', role: 'house' },
      { id: 'internlm/Intern-Decision-0.8B', label: 'Intern Decision', maker: 'InternLM', specialty: 'Vision', note: 'Structured decisions over text and images.', sizeGB: 1.71, licence: 'apache-2.0', role: 'house' },
      { id: 'eljiwo/jiwo-0.8b', label: 'jiwo', maker: 'eljiwo', specialty: 'General', note: 'A text-only decision fine-tune with a d3-style answer layer.', sizeGB: 1.51, licence: 'apache-2.0', role: 'market' },
      { id: 'cribl-ai/cribl-decision-2-0.8B', label: 'Cribl Decision 2', maker: 'Cribl', specialty: 'IT and security', note: 'Decisions for IT operations and security data.', sizeGB: 1.51, licence: 'apache-2.0', role: 'market' },
      { id: 'Maincode/Matilda-Decision-v1-Edge', label: 'Matilda Edge', maker: 'Maincode', specialty: 'On device', note: 'Maincode’s smallest decision model, for phones and high throughput.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'OmniJev/OneJev1.6-0.8B', label: 'OneJev 1.6', maker: 'OmniJev', specialty: 'Screens', note: 'Decisions over screenshots, photos and video.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'Mapika/decider-0.8b', label: 'decider', maker: 'Mapika', specialty: 'General', note: 'Reads a state and answers typed questions; text only.', sizeGB: 1.5, licence: 'apache-2.0', role: 'market' },
      { id: 'PelaAI/KnowLine-0.8B-Gen1', label: 'KnowLine Gen1', maker: 'PelaAI', specialty: 'Chinese', note: 'Decisions trained mostly in Chinese.', sizeGB: 1.75, licence: 'apache-2.0', role: 'market' },
      { id: 'Qwen/Qwen3.5-0.8B', label: 'Qwen3.5 0.8B', maker: 'Qwen', specialty: 'Base', note: 'The plain base every lite body grew from. A spoonful pulls a soup back toward it.', sizeGB: 1.75, licence: 'apache-2.0', role: 'base' },
    ],
  },
  {
    id: 'mini',
    name: 'Mini · 4B',
    base: 'Qwen/Qwen3.5-4B',
    models: [
      { id: 'vllm-sr/d3-mini', label: 'd3-mini', maker: 'vLLM Semantic Router', specialty: 'Vision', note: 'The mini chassis and z3-mini v1. Put it first and the soup keeps its answer layer.', sizeGB: 9.08, licence: 'apache-2.0', role: 'house' },
      { id: 'perplexity-ai/pplx-decider-flash-v1.2', label: 'pplx decider flash', maker: 'Perplexity', specialty: 'General', note: 'Typed decisions from Perplexity.', sizeGB: 9.08, licence: 'apache-2.0', role: 'house' },
      { id: 'torchcast-ai/torchcast-decision-4b', label: 'Torchcast Decision', maker: 'Torchcast', specialty: 'General', note: 'Typed decisions; a strong single body on its own.', sizeGB: 10.35, licence: 'apache-2.0', role: 'house' },
      { id: 'Maincode/Matilda-Decision-v1-Mini', label: 'Matilda Mini', maker: 'Maincode', specialty: 'Vision', note: 'Decisions with images.', sizeGB: 9.08, licence: 'apache-2.0', role: 'house' },
      { id: 'PelaAI/KnowLine-4B-Gen5', label: 'KnowLine Gen5', maker: 'PelaAI', specialty: 'Chinese', note: 'Decisions trained mostly in Chinese.', sizeGB: 9.32, licence: 'apache-2.0', role: 'house' },
      { id: 'zils-ai/z3-mini-soup-preview', label: 'z3-mini soup preview', maker: 'Zils', specialty: 'Soup', note: 'A greedy soup of Torchcast, pplx and d3-mini, ready to stir into another.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'akta-pro/d3-mini-multi', label: 'd3-mini multi', maker: 'akta', specialty: 'Multi-label', note: 'A d3-mini fine-tune that picks every label that applies.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'Accuknoxtechnologies/accuknox-guard-1.2', label: 'AccuKnox Guard 1.2', maker: 'AccuKnox', specialty: 'Safety', note: 'A d3-mini fine-tune for harmful requests, jailbreaks and injection.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'cribl-ai/cribl-decision-2-4B', label: 'Cribl Decision 2 4B', maker: 'Cribl', specialty: 'IT and security', note: 'Decisions for IT operations and security data.', sizeGB: 8.41, licence: 'apache-2.0', role: 'market' },
      { id: 'Qwen/Qwen3.5-4B', label: 'Qwen3.5 4B', maker: 'Qwen', specialty: 'Base', note: 'The plain base every mini body grew from. A spoonful pulls a soup back toward it.', sizeGB: 9.3, licence: 'apache-2.0', role: 'base' },
    ],
  },
];

export function family(id: string) {
  return FAMILIES.find(f => f.id === id);
}

/** Total download for the models in the bowl, in GB to one decimal. */
export function downloadGB(familyId: string, models: string[]) {
  const sizes = family(familyId)?.models ?? [];
  return Math.round(models.reduce((sum, id) => sum + (sizes.find(m => m.id === id)?.sizeGB ?? 0), 0) * 10) / 10;
}

export function mergeCommand({ family: familyId, models, method, portions }: {
  family: string; models: string[]; method: string; portions: number[];
}) {
  const known = family(familyId)?.models.map(m => m.id) ?? [];
  if (models.length < 2 || models.length > MAX_MODELS) throw new Error(`Pick 2 to ${MAX_MODELS} models.`);
  if (!models.every(id => known.includes(id))) throw new Error('Pick every model from the same family.');
  if (new Set(models).size !== models.length) throw new Error('Pick different models.');
  if (method !== 'linear' && method !== 'slerp') throw new Error(`Unknown merge method ${method}.`);
  if (method === 'slerp' && models.length !== 2) throw new Error('SLERP blends exactly two models.');
  if (portions.length !== models.length || !portions.every(p => Number.isInteger(p) && p >= 1 && p <= MAX_PORTION)) {
    throw new Error(`Give each model a portion of 1 to ${MAX_PORTION} parts.`);
  }
  let command = `npx @zils/cli merge ${models.join(' ')} --out ./my-merge`;
  if (method !== 'linear') command += ` --method ${method}`;
  if (new Set(portions).size > 1) command += ` --weights ${portions.join(',')}`;
  return command;
}
