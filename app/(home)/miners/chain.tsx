import Link from 'next/link';
import { hfTree } from '@/lib/soup-tiers';
import type { MinerRow, NetworkBodies, Standing } from '@/lib/network-bodies';
import s from './board.module.css';

const STANDING: Record<Standing, string> = {
  crown: 'Crown', seat: 'Paid seat', unpaid: 'In the soup, unpaid', out: 'Not in tonight’s soup',
  waiting: 'Waiting for the first round', unknown: '—', none: 'No body committed',
};
const short = (hotkey: string) => `${hotkey.slice(0, 6)}…${hotkey.slice(-4)}`;

/** The pass: every uid with a soup body or a serving endpoint on chain, each an order ticket clipped on the purple
 *  counter. The uid is the order number, the tier the station, the body the dish, and tonight's standing is stamped
 *  on the ticket. Joined with tonight's soups for the standing. */
export function ChainTable({ chain, rows }: { chain: NetworkBodies; rows: MinerRow[] }) {
  return <div className={s.pass}>
    {rows.length ? <ol className={s.tickets} aria-label="Miners on chain" data-contrast>
      {rows.map(r => <li key={r.uid} className={s.ticket} data-standing={r.standing}>
        <div className={s.ticketHead}>
          <span className={s.uid}><small>uid</small>{r.uid}</span>
          <span className={s.station}>{r.tier ?? 'no tier'}</span>
        </div>
        <code className={s.hotkey} title={r.hotkey}>{short(r.hotkey)}</code>
        <p className={s.dish}>{r.body
          ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code className={s.rev}>{r.body.revision.slice(0, 7)}</code></>
          : <span>No body committed</span>}</p>
        <p className={s.standing}>{(r.standing === 'seat' || r.standing === 'crown') && <i className={s.chip} aria-hidden="true" />}{STANDING[r.standing]}</p>
        <p className={s.serving}>{r.serving ? 'Endpoint announced' : 'No endpoint'}</p>
      </li>)}
    </ol> : <p className={s.empty}>No miner has committed a body yet. <Link href="/soup">Bring a body to the soup</Link></p>}
    <p className={s.fine}><span>Block {chain.block.toLocaleString('en-US')}</span> on subnet {chain.netuid}. Bodies come from chain commitments; a miner may hold one per hotkey. An announced endpoint means the miner can serve; Zils does not send traffic to miners yet.</p>
  </div>;
}
