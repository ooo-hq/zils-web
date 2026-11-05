import Link from 'next/link';
import { hfTree } from '@/lib/soup-tiers';
import type { MinerRow, NetworkBodies, Standing } from '@/lib/network-bodies';
import s from './board.module.css';

const STANDING: Record<Standing, string> = {
  crown: 'Crown', seat: 'Paid seat', unpaid: 'In the soup, unpaid', out: 'Not in tonight’s soup',
  pending: 'Committed after the deadline, graded in the next round', waiting: 'Waiting for the first round',
  unknown: '—', none: 'No body committed',
  checking: 'Being checked now', checked: 'Checked, in tonight’s round', queued: 'Waiting to be checked',
  deferred: 'Over tonight’s limit, graded in the next round', refused: 'Not admitted tonight',
};
const short = (hotkey: string) => `${hotkey.slice(0, 6)}…${hotkey.slice(-4)}`;

/** The pass: every uid with a soup body or a serving endpoint on chain, one row of the order sheet on the purple
 *  counter, joined with tonight's soups for the standing. */
export function ChainTable({ chain, rows }: { chain: NetworkBodies; rows: MinerRow[] }) {
  return <div className={s.pass}>
    {rows.length ? <div className={s.sheet}>
      <table className={s.table} aria-label="Miners on chain" data-contrast>
        <thead><tr><th scope="col">UID</th><th scope="col">Hotkey</th><th scope="col">Tier</th><th scope="col">Body</th><th scope="col">Tonight</th><th scope="col">Serving</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.uid} data-standing={r.standing}>
          <td data-label="UID" className={s.uid}><span>{r.uid}</span></td>
          <td data-label="Hotkey"><code title={r.hotkey}>{short(r.hotkey)}</code></td>
          <td data-label="Tier"><span className={s.station}>{r.tier ?? '—'}</span></td>
          <td data-label="Body">{r.body ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code className={s.rev}>{r.body.revision.slice(0, 7)}</code></> : <span>—</span>}</td>
          <td data-label="Tonight" className={s.standing}><span>{(r.standing === 'seat' || r.standing === 'crown') && <i className={s.chip} aria-hidden="true" />}{STANDING[r.standing]}</span></td>
          <td data-label="Serving"><span>{r.serving ? 'Endpoint announced' : 'No endpoint'}</span></td>
        </tr>)}</tbody>
      </table>
    </div> : <p className={s.empty}>No miner has committed a body yet. <Link href="/soup">Bring a body to the soup</Link></p>}
    <p className={s.fine}><span>Block {chain.block.toLocaleString('en-US')}</span> on subnet {chain.netuid}. Bodies come from chain commitments; a miner may hold one per hotkey. Each round freezes its bodies at its pool’s deadline (mini 00:00 UTC, lite 06:00 UTC; 7 PM and 1 AM New York); a body committed later waits for the next round. An announced endpoint means the miner can serve; Zils does not send traffic to miners yet.</p>
  </div>;
}
