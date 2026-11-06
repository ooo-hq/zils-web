import type { CSSProperties, ReactNode } from 'react';
import { DetailsRow } from '@/components/site/details-row';
import { hfTree } from '@/lib/soup-tiers';
import { reasonLabel, type MinerRow, type nextRound } from '@/lib/network-bodies';
import s from './next-round.module.css';

type Lines = ReturnType<typeof nextRound<MinerRow>>;
type Pool = Lines[number];

/** The line at a glance: one cell per body, the ones the next round reaches in the spectrum, the rest hatched,
 *  with a rule at the cut. Decorative: the table below carries the same facts. */
function Strip({ pool }: { pool: Pool }) {
  return <ol className={s.strip} aria-hidden="true" style={{ '--n': pool.rows.length, '--k': pool.cut } as CSSProperties}>
    {pool.rows.map((r, i) => <li key={r.uid} data-next={i < pool.cut || undefined} data-cut={i === pool.cut || undefined}
      style={i < pool.cut ? { '--i': i } as CSSProperties : undefined} title={`${i + 1}: uid ${r.uid}`} />)}
  </ol>;
}

/** Fixed columns, so the rows inside the collapsed row line up with the ones above it. */
function Table({ rows, label, head = true }: { rows: Pool['rows']; label: string; head?: boolean }): ReactNode {
  return <table className={s.table} aria-label={label}>
    <colgroup><col className={s.cPlace} /><col className={s.cUid} /><col /><col className={s.cBlock} /><col className={s.cReason} /></colgroup>
    <thead className={head ? undefined : s.quiet}><tr><th scope="col">Place</th><th scope="col">UID</th><th scope="col">Body</th><th scope="col">Committed</th><th scope="col">Reason</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.uid}>
      <td data-label="Place" className={s.place}>{r.line!.position}</td>
      <td data-label="UID">{r.uid}</td>
      <td data-label="Body"><a href={hfTree(r.body!.repo, r.body!.revision)}>{r.body!.repo}</a> <code>{r.body!.revision.slice(0, 7)}</code></td>
      <td data-label="Committed" className={s.num}>{r.body!.block.toLocaleString('en-US')}</td>
      <td data-label="Reason" className={s.reason}>{reasonLabel(r.line!.reason) ?? '—'}</td>
    </tr>)}</tbody>
  </table>;
}

/** One block per pool: the bodies the validator has not graded, in the order the next round checks them. */
export function NextRound({ lines }: { lines: Lines }) {
  return <>
    {lines.map(pool => {
      const later = pool.rows.slice(pool.cut);
      return <div key={pool.tier} id={`next-${pool.tier}`} className={s.pool}>
        <div className={s.head}>
          <h3>{pool.tier}</h3>
          <p className={s.count}><b>{pool.rows.length}</b> in line</p>
        </div>
        <p className={s.lede}>{later.length ? `The next round checks the first ${pool.limit}.` : `The next round has room for all ${pool.rows.length}.`}</p>
        <Strip pool={pool} />
        <Table rows={pool.rows.slice(0, pool.cut)} label={`${pool.tier}: the next round`} />
        {later.length > 0 && <DetailsRow summary={`${later.length} more after the next round`}>
          <Table rows={later} label={`${pool.tier}: after the next round`} head={false} />
        </DetailsRow>}
      </div>;
    })}
    <p className={s.fine}>A round checks new bodies in commitment order, earliest block first, up to its pool’s limit. A place is a forecast: a round can also stop on its download budget or the validator’s disk. Reason is why the last round passed a body over; other reasons stay private.</p>
  </>;
}
