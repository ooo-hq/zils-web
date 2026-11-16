/** The workspace loader: "Zils" decodes from runes, one letter at a time, then holds. */
export const LOADER_WORD = 'Zils';
export const LOADER_TICK_MS = 45;
/** One cycle: four ticks of runes, a letter locks every three ticks, then the word holds. */
export const LOADER_TICKS = 30;
const RUNES = 'ᛉᚱᛟᛞᛜᛃᚦ∴◇⌁✶⟡⋔⊹';

export type LoaderCell = { char: string; locked: boolean };

export function loaderFrame(tick: number, random: () => number = Math.random): LoaderCell[] {
  const t = tick % LOADER_TICKS;
  return [...LOADER_WORD].map((letter, i) => t >= 4 + i * 3
    ? { char: letter, locked: true }
    : { char: RUNES[Math.floor(random() * RUNES.length)], locked: false });
}

/** Where a loader starts. One that replaces a loader removed within the last half second carries on from it, so swapping
    the route's loader for the page's own reads as one loader; any other starts at the top of a cycle. */
export function resumeTick(last: { tick: number; at: number } | null, now: number): number {
  if (!last || now - last.at > 500) return LOADER_TICKS - 1;
  return last.tick + Math.max(1, Math.round((now - last.at) / LOADER_TICK_MS));
}
