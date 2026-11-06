import { hfTree } from '@/lib/soup-tiers';
import type { MinerRow, nextRound } from '@/lib/network-bodies';
import s from './board.module.css';

type Lines = ReturnType<typeof nextRound<MinerRow>>;

/** One table per tier: the bodies the validator has not graded, in the order the next round checks them, with a
 *  rule where its new-body limit falls. Positions are a forecast; other limits (download budget, disk) can still
 *  push a body back. */
export function NextRound({ lines }: { lines: Lines }) {
  return <div className={s.pass}>
    {lines.map(t => <div key={t.tier} id={`next-${t.tier}`} className={s.lineBlock}>
      <h3 className={s.lineHead}><b>{t.tier}</b> {t.rows.length} in line; the next round checks up to {t.limit}</h3>
      <div className={s.sheet}>
        <table className={s.table} aria-label={`${t.tier} line for the next round`} data-contrast>
          <thead><tr><th scope="col">Place</th><th scope="col">UID</th><th scope="col">Body</th><th scope="col">Committed</th><th scope="col">Reason</th></tr></thead>
          <tbody>{t.rows.flatMap((r, i) => {
            const row = <tr key={r.uid} data-next={r.line!.next || undefined}>
              <td data-label="Place" className={s.uid}><span>#{r.line!.position}</span></td>
              <td data-label="UID"><span>{r.uid}</span></td>
              <td data-label="Body"><a href={hfTree(r.body!.repo, r.body!.revision)}>{r.body!.repo}</a> <code className={s.rev}>{r.body!.revision.slice(0, 7)}</code></td>
              <td data-label="Committed"><span>Block {r.body!.block.toLocaleString('en-US')}</span></td>
              <td data-label="Reason"><span>{r.line!.reason ?? '—'}</span></td>
            </tr>;
            return i + 1 === t.cut && t.cut < t.rows.length
              ? [row, <tr key={`cut-${t.tier}`} className={s.cut}><td colSpan={5}><span>After the next round</span></td></tr>]
              : [row];
          })}</tbody>
        </table>
      </div>
    </div>)}
    <p className={s.fine}>Each round checks new bodies in commitment order, earliest block first, up to its pool’s limit; the rest wait for the next one. A place is a forecast: a round can also stop early on its download budget or the validator’s disk. “Reason” is why the last round passed a body over; other reasons stay private.</p>
  </div>;
}
