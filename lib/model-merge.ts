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
// (Jev-Style v3, clef-vision); LemonDecider, whose `backbone.` weight names don't line up; bodies whose extra heads or
// weight names `zils merge` refuses (openjev-v5, Valen, nari, MedDecider) or that ship no safetensors at the root
// (Decision-2.0-Nox); and serin-0.8b, a backdoor demonstration.
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
      { id: 'jeff-legacy/Jeff-Qwen3.5-0.8B', label: 'Jeff', maker: 'jeff-legacy', specialty: 'General', note: 'Quick decisions in front of a big model; unsure queries go on to the big one.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'run-saina/saina-helm-2-0.8b', label: 'Saina Helm 2', maker: 'Saina', specialty: 'General', note: 'Typed questions over any state: yes/no, single or multiple choice, ratings.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'GhostScientist/jev-decisions-v1-model', label: 'jev-decisions v1', maker: 'GhostScientist', specialty: 'General', note: 'Picks one of 2 to 24 labelled options from a structured state.', sizeGB: 1.5, licence: 'apache-2.0', role: 'market' },
      { id: 'bvolpato/bruv1-0.8b', label: 'Bruv1', maker: 'bvolpato', specialty: 'General', note: 'Reads an evidence state and scores two to sixteen options; text only.', sizeGB: 1.5, licence: 'apache-2.0', role: 'market' },
      { id: 'OmniJev/OneJev-0.8B', label: 'OneJev 1.0', maker: 'OmniJev', specialty: 'Screens', note: 'The first OneJev: screenshots, photos, video and text from real agent runs.', sizeGB: 2.21, licence: 'apache-2.0', role: 'market' },
      { id: 'astroware/HaloGuard1-Gen-0.8B', label: 'HaloGuard 0.8B', maker: 'astroware', specialty: 'Safety', note: 'Flags unsafe prompts and names the policy before they reach an LLM.', sizeGB: 2.21, licence: 'apache-2.0', role: 'market' },
      { id: 'prithivMLmods/ImageShield-MMCF-0.8B', label: 'ImageShield', maker: 'prithivMLmods', specialty: 'Safety', note: 'Content-safety calls on images.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: '0xBrandon/Decision-WAF-V1.1-0.8B', label: 'Decision WAF 1.1', maker: '0xBrandon', specialty: 'IT and security', note: 'A web firewall: reads an HTTP request and calls it safe or an attack.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'distil-labs/distil-qwen3.5-0.8b-invoice-triage', label: 'Invoice triage', maker: 'distil labs', specialty: 'Finance', note: 'Sorts an accounts-payable inbox: invoice, receipt, reminder, vendor or spam.', sizeGB: 1.5, licence: 'apache-2.0', role: 'market' },
      { id: 'quincyqiang/chinese-decision-0.8b', label: 'Chinese Decision', maker: 'quincyqiang', specialty: 'Chinese', note: 'Typed decisions in Chinese.', sizeGB: 1.5, licence: 'apache-2.0', role: 'market' },
      { id: 'AhmedReda25300/Ara-JEV', label: 'Ara-JEV', maker: 'AhmedReda25300', specialty: 'Arabic', note: 'A compact Arabic decision model.', sizeGB: 1.71, licence: 'apache-2.0', role: 'market' },
      { id: 'eqlx-ai/tr-telekom-router', label: 'TR Telekom Router', maker: 'eqlx', specialty: 'Turkish', note: 'Routes Turkish customer messages to one of six teams, with a confidence.', sizeGB: 1.75, licence: 'apache-2.0', role: 'market' },
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
      { id: 'h2oai/h2o-lightning-4b', label: 'H2O Lightning', maker: 'H2O.ai', specialty: 'General', note: 'Typed decision questions about a record.', sizeGB: 9.32, licence: 'apache-2.0', role: 'market' },
      { id: 'Mapika/decider-4b', label: 'decider 4B', maker: 'Mapika', specialty: 'General', note: 'Reads a state and answers typed questions; text only.', sizeGB: 8.41, licence: 'apache-2.0', role: 'market' },
      { id: 'macrocosm-os/iota-decide-4b-v0.4', label: 'iota decide 0.4', maker: 'Macrocosmos', specialty: 'General', note: 'Choice, yes/no and score questions in one forward pass.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'WangSenQWQ/Senova-4B-v3', label: 'Senova v3', maker: 'WangSenQWQ', specialty: 'General', note: 'Trained on about 1.8 million examples with soft labels.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'jylin001206/SII-Decision-4B-Full', label: 'SII Decision', maker: 'jylin001206', specialty: 'General', note: 'A probability over the options you give it.', sizeGB: 10.35, licence: 'apache-2.0', role: 'market' },
      { id: 'eljiwo/jiwo-4b', label: 'jiwo 4B', maker: 'eljiwo', specialty: 'General', note: 'The bigger jiwo; text only.', sizeGB: 8.41, licence: 'apache-2.0', role: 'market' },
      { id: 'agentscope-ai/Piccolo-4B', label: 'Piccolo', maker: 'AgentScope', specialty: 'Judge', note: 'Structured judgments such as tool review and context compaction.', sizeGB: 9.32, licence: 'apache-2.0', role: 'market' },
      { id: 'internlm/Intern-Decision-4B', label: 'Intern Decision 4B', maker: 'InternLM', specialty: 'Vision', note: 'Structured decisions over text and images.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'OmniJev/OneJev1.6-4B', label: 'OneJev 1.6 4B', maker: 'OmniJev', specialty: 'Screens', note: 'Decisions over screenshots, photos and video.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
      { id: 'xgen-ai/SEV-UI-4B', label: 'SEV-UI', maker: 'xgen', specialty: 'Screens', note: 'Picks the next screen action from accessibility lines and what the user said.', sizeGB: 9.32, licence: 'apache-2.0', role: 'market' },
      { id: 'astroware/HaloGuard1-Gen-4B', label: 'HaloGuard 4B', maker: 'astroware', specialty: 'Safety', note: 'Flags unsafe prompts and names the policy before they reach an LLM.', sizeGB: 10.35, licence: 'apache-2.0', role: 'market' },
      { id: 'mayflowergmbh/Josev-4B', label: 'Josev', maker: 'Mayflower', specialty: 'German', note: 'Decisions in German.', sizeGB: 9.32, licence: 'apache-2.0', role: 'market' },
      { id: 'chinhnc/Quyet-1.0-Medium', label: 'Quyết 1.0 Medium', maker: 'Chinh Nguyen', specialty: 'Vietnamese', note: 'Choice, score and true/false questions, Vietnamese first.', sizeGB: 9.32, licence: 'apache-2.0', role: 'market' },
      { id: 'Nimruz/Mizan-v2-4B', label: 'Mizan v2', maker: 'Nimruz', specialty: 'Persian', note: 'Persian-first decisions over text and images.', sizeGB: 9.08, licence: 'apache-2.0', role: 'market' },
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
