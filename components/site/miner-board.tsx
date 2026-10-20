'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Miner } from '@/lib/network-miners';
import { STATUS_LABEL, isActive, sortMiners, type SortKey } from '@/lib/miner-board';
import css from './miner-board.module.css';

const MODEL_NAMES: Record<string, string> = { 'd3-mini-4.5b-v1': 'd3-mini 4.5B', 'd3-mini-4.5b-zils-r5': 'd3-mini 4.5B · r5', 'd3-lite-0.8b-v1': 'd3-lite 0.8B', 'h2o-lightning-4b-v1.2.3': 'H2O 4B' };
const short = (hotkey: string) => hotkey.length > 14 ? `${hotkey.slice(0, 6)}…${hotkey.slice(-6)}` : hotkey;
function ago(iso: string | null, now: number) {
  if (!iso) return '—';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} days ago`;
}
const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: 'uid', label: 'Miner' }, { key: 'status', label: 'Status' }, { key: 'selected', label: 'Selected' },
  { key: 'skill', label: 'Median skill' }, { key: 'lastSeen', label: 'Last seen', right: true },
];

/** Keep refreshing even when the API is unavailable, so the page can recover. */
export function MinerRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return null;
}

export function MinerBoard({ miners, asOf }: { miners: Miner[]; asOf: string }) {
  const [key, setKey] = useState<SortKey>('selected');
  const now = Date.parse(asOf);
  const rows = sortMiners(miners, key);
  return (
    <div className={css.board} role="table" aria-label="Miner leaderboard">
      <div role="rowgroup" className={css.headGroup}>
        <div role="row" className={`${css.row} ${css.head}`}>
          <span role="columnheader" className={css.label}>#</span>
          {COLUMNS.map(c => (
            <span key={c.key} role="columnheader" aria-sort={key === c.key ? 'descending' : 'none'} className={c.right ? css.right : undefined}>
              <button type="button" className={css.sort} data-on={key === c.key || undefined} onClick={() => setKey(c.key)}>{c.label}</button>
            </span>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((m, i) => {
          const base = m.models.map(id => MODEL_NAMES[id] ?? id).join(', ') || '—';
          const skill = m.training.median_skill;
          return (
            <div role="row" key={m.hotkey} className={`${css.row} ${css.body}`} data-dim={isActive(m) ? undefined : ''}>
              <span role="cell" className={css.rank}>{String(i + 1).padStart(2, '0')}</span>
              <span role="cell" className={css.miner}><b>UID {m.uid}</b><span title={m.hotkey}>{short(m.hotkey)} · {base}</span></span>
              <span role="cell" className={css.st} data-status={m.status}>{STATUS_LABEL[m.status]}</span>
              <span role="cell" className={css.sel}><b>{m.training.selected}</b><span>of {m.training.assigned} jobs</span></span>
              <span role="cell" className={css.skillCell}>{skill === null
                ? <span className={css.label}>No candidates yet</span>
                : <span className={css.skill}><span aria-hidden="true" className={css.track}><span className={css.fill} style={{ width: `${Math.min(1, Math.max(0, skill)) * 100}%` }} /></span><b>{skill.toFixed(2)}</b></span>}</span>
              <span role="cell" className={css.seen}>{ago(m.last_seen, now)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
