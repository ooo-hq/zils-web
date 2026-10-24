export const MODEL_NAMES: Record<string, string> = { 'd3-mini-4.5b-v1': 'z3-mini 4.5B', 'd3-lite-0.8b-v1': 'z3-lite 0.8B', 'h2o-lightning-4b-v1.2.3': 'H2O 4B' };

/** Public branding only; API IDs, pinned profiles and historical evidence stay unchanged. */
export function modelDisplayName(name: string | null | undefined): string {
  return name?.replace(/^d3(?=-(?:lite|nano|mini|flash)(?:\s|$)|\s|$)/, 'z3') ?? '';
}
