/** Public branding only; API IDs, pinned profiles and historical evidence stay unchanged. */
export function modelDisplayName(name: string | null | undefined): string {
  return name?.replace(/^d3(?=-(?:lite|nano|mini|flash)(?:\s|$)|\s|$)/, 'z3') ?? '';
}
