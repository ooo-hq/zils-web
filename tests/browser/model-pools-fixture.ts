export const mini = { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B', base: 'zils-ai/d3-mini-4.5b-v1', base_revision: '8'.repeat(40), max_input_tokens: 4096, inputs: { images: 4, video: true } };
export const lite = { ...mini, id: 'd3-lite-0.8b-v1', name: 'd3-lite', base: 'vllm-sr/d3-lite' };
export const legacyConfig = { model: mini, channels: { stable: mini, latest: mini } };
export function poolConfig() {
  return { ...legacyConfig, pools: Object.fromEntries([
    ['d3-mini', mini, 4.54, true], ['d3-lite', lite, .85, true], ['d3-nano', { ...mini, id: 'd3-nano-2.2b-v1', name: 'd3-nano' }, 2.21, false],
  ].map(([id, model, parameters_billions, enabled]) => [String(id), { id, name: (model as typeof mini).name, enabled, parameters_billions, channels: { stable: model, latest: model }, availability: Object.fromEntries(['stable', 'latest'].map(c => [c, { training_enabled: enabled, serving_enabled: false, max_input_tokens: 4096, inputs: { text: enabled, images: enabled, video: false } }])) }])) };
}
