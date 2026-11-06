import Link from 'next/link';
import { hfTree } from '@/lib/soup-tiers';
import { sortHref, type Line, type MinerRow, type MinerSort, type NetworkBodies, type SortKey, type Standing } from '@/lib/network-bodies';

type Page = { rows: MinerRow[]; page: number; pages: number; total: number; from: number; to: number };
import s from './board.module.css';

const STANDING: Record<Standing, string> = {
  crown: 'Crown', seat: 'Paid seat', unpaid: 'In the soup, unpaid', out: 'Not in tonight’s soup',
  pending: 'Committed after the deadline, graded in the next round', waiting: 'Waiting for the first round',
  unknown: '—', none: 'No body committed',
  checking: 'Being checked now', checked: 'Checked, in tonight’s round', queued: 'Waiting to be checked',
  deferred: 'Over tonight’s limit, graded in the next round', refused: 'Not admitted tonight',
  in_line: 'In line',
};
/** A body in line: its place, linking to its tier's table under Next round. */
function InLine({ line, tier }: { line: Line; tier: string | null }) {
  return <span><a href={`#next-${tier}`}>In line, #{line.position}</a></span>;
}
const short = (hotkey: string) => `${hotkey.slice(0, 6)}…${hotkey.slice(-4)}`;

/** Previous and next pages of the sheet; each link lands back on the table. */
function Pager({ page, sort }: { page: Page; sort: MinerSort }) {
  if (page.pages < 2) return null;
  const to = (n: number) => sortHref(sort, null, n);
  return <nav className={s.pager} aria-label="Miner pages">
    {page.page > 1 ? <Link href={to(page.page - 1)} rel="prev">Previous</Link> : <span aria-hidden="true">Previous</span>}
    <span>{page.from}–{page.to} of {page.total}</span>
    {page.page < page.pages ? <Link href={to(page.page + 1)} rel="next">Next</Link> : <span aria-hidden="true">Next</span>}
  </nav>;
}

/** A sortable header: a link that sorts every page by this column, flipping direction when it is already active. */
function SortHeader({ column, label, sort }: { column: SortKey; label: string; sort: MinerSort }) {
  const active = sort.key === column;
  return <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
    <Link href={sortHref(sort, column)} className={s.sortLink}>{label}<span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span></Link>
  </th>;
}

/** The pass: every uid with a soup body or a serving endpoint on chain, one row of the order sheet on the purple
 *  counter, joined with tonight's soups for the standing. Tonight's soup comes first, 25 rows a page. */
export function ChainTable({ chain, page, sort }: { chain: NetworkBodies; page: Page; sort: MinerSort }) {
  const rows = page.rows;
  return <div className={s.pass}>
    {rows.length ? <div className={s.sheet}>
      <table className={s.table} aria-label="Miners on chain" data-contrast>
        <thead><tr><SortHeader column="uid" label="UID" sort={sort} /><th scope="col">Hotkey</th><SortHeader column="tier" label="Tier" sort={sort} /><th scope="col">Body</th><SortHeader column="tonight" label="Tonight" sort={sort} /><th scope="col">Serving</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.uid} data-standing={r.standing}>
          <td data-label="UID" className={s.uid}><span>{r.uid}</span></td>
          <td data-label="Hotkey"><code title={r.hotkey}>{short(r.hotkey)}</code></td>
          <td data-label="Tier"><span className={s.station}>{r.tier ?? '—'}</span></td>
          <td data-label="Body">{r.body ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code className={s.rev}>{r.body.revision.slice(0, 7)}</code></> : <span>—</span>}</td>
          <td data-label="Tonight" className={s.standing}>{r.line ? <InLine line={r.line} tier={r.tier} /> : <span>{(r.standing === 'seat' || r.standing === 'crown') && <i className={s.chip} aria-hidden="true" />}{STANDING[r.standing]}</span>}</td>
          <td data-label="Serving"><span>{r.serving ? 'Endpoint announced' : 'No endpoint'}</span></td>
        </tr>)}</tbody>
      </table>
    </div> : <p className={s.empty}>No miner has committed a body yet. <Link href="/soup">Bring a body to the soup</Link></p>}
    <Pager page={page} sort={sort} />
    <p className={s.fine}><span>Block {chain.block.toLocaleString('en-US')}</span> on subnet {chain.netuid}. Bodies come from chain commitments; a miner may hold one per hotkey. Each round freezes its bodies at its pool’s deadline (mini 00:00 UTC, lite 06:00 UTC; 7 PM and 1 AM New York); a body committed later waits for the next round. An announced endpoint means the miner can serve; Zils does not send traffic to miners yet.</p>
  </div>;
}
