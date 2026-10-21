'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthSession } from '@/components/auth-session';
import { Specimen } from './specimen';
import s from './roadmap.module.css';

// Ids are stored in zils_feature_votes (zils-platform migration 202610210001); never rename one.
const FEATURES = [
  { id: 'count', name: 'Count', example: '“How many red apples?” → 7' },
  { id: 'text-spans', name: 'Text spans', example: 'Return the exact words: the deadline, the invoice number' },
  { id: 'points', name: 'Points', example: 'Where to click, as one x, y' },
  { id: 'video', name: 'Video', example: 'Decisions over clips, not single frames' },
  { id: 'multi-select', name: 'Multi-select', example: 'Every label that applies, including none' },
  { id: 'masks', name: 'Masks', example: 'The exact outline of an object' },
] as const;
const NONE = new Set<string>();

export function Votes() {
  const { client, session } = useAuthSession();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [replays, setReplays] = useState<Record<string, number>>({});
  const mine = session ? saved : NONE;

  useEffect(() => {
    if (!client) return;
    client.rpc('zils_feature_vote_counts').then(({ data, error }) => {
      if (error) { setError('Vote totals are unavailable right now.'); return; }
      setCounts(Object.fromEntries((data as { feature: string; votes: number }[]).map(r => [r.feature, Number(r.votes)])));
    });
  }, [client]);

  useEffect(() => {
    if (!client || !session) return;
    client.from('zils_feature_votes').select('feature').then(({ data }) => setSaved(new Set((data ?? []).map(r => r.feature))));
  }, [client, session]);

  async function toggle(feature: string) {
    if (!client || !session || busy) return;
    setBusy(feature); setError('');
    const voted = mine.has(feature);
    const { error } = voted
      ? await client.from('zils_feature_votes').delete().eq('feature', feature)
      : await client.from('zils_feature_votes').insert({ feature });
    if (error) setError('Your vote was not saved. Please try again.');
    else {
      setSaved(prev => { const next = new Set(prev); if (voted) next.delete(feature); else next.add(feature); return next; });
      setCounts(prev => prev && { ...prev, [feature]: (prev[feature] ?? 0) + (voted ? -1 : 1) });
    }
    setBusy('');
  }

  // Stable sort: ties keep the listed order.
  const rows = [...FEATURES].sort((a, b) => (counts?.[b.id] ?? 0) - (counts?.[a.id] ?? 0));
  return <>
    <ol className={s.list}>{rows.map((f, i) => {
      const on = mine.has(f.id);
      const count = counts ? counts[f.id] ?? 0 : '–';
      const replay = replays[f.id] ?? 0;
      return <li key={f.id} className={s.row}>
        <div className={s.specimen} style={{ '--row': replay ? 0 : i } as React.CSSProperties}
          onMouseEnter={() => setReplays(r => ({ ...r, [f.id]: replay + 1 }))}>
          <Specimen key={replay} id={f.id} />
        </div>
        <div className={s.text}><h3>{f.name}</h3><p>{f.example}</p></div>
        {session
          ? <button type="button" className={s.vote} aria-pressed={on} disabled={busy !== ''} onClick={() => toggle(f.id)}
              aria-label={`${on ? 'Remove your vote for' : 'Vote for'} ${f.name}, ${count} votes`}>
              <span aria-hidden="true">▲</span><span>{count}</span>
            </button>
          : <Link className={s.vote} href="/sign-in" aria-label={`Sign in to vote for ${f.name}, ${count} votes`}>
              <span aria-hidden="true">▲</span><span>{count}</span>
            </Link>}
      </li>;
    })}</ol>
    {error && <p className={s.error} role="status">{error}</p>}
  </>;
}
