import type { Miner, NetworkMiners } from './network-miners';

export const STATUS_LABEL: Record<Miner['status'], string> = { online: 'Online', stale: 'Seen recently', offline: 'Offline', unseen: 'Never seen', disabled: 'Disabled' };
export type SortKey = 'selected' | 'uid' | 'status' | 'skill' | 'lastSeen';

/** Only online miners are fully lit; the board dims the rest. */
export const isActive = (m: Miner) => m.status === 'online';

const skill = (m: Miner) => m.training.median_skill ?? -1;
const value: Record<SortKey, (m: Miner) => number> = {
  selected: m => m.training.selected,
  uid: m => m.uid,
  status: m => (isActive(m) ? 1 : 0),
  skill,
  lastSeen: m => (m.last_seen ? Date.parse(m.last_seen) || -1 : -1),
};

/** Descending by `key`, ties by skill (null last). Array.prototype.sort is stable, so equal rows keep their order. */
export function sortMiners(miners: Miner[], key: SortKey): Miner[] {
  return [...miners].sort((a, b) => value[key](b) - value[key](a) || skill(b) - skill(a));
}

export function boardNumbers(n: NetworkMiners) {
  return {
    online: n.summary.online,
    total: n.summary.miners,
    jobs: n.miners.reduce((sum, m) => sum + m.training.assigned, 0),
    selected: n.miners.reduce((sum, m) => sum + m.training.selected, 0),
  };
}
