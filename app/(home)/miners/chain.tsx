import { hfTree } from '@/lib/soup-tiers';
import type { MinerRow, NetworkBodies, Standing } from '@/lib/network-bodies';
import s from './board.module.css';

const STANDING: Record<Standing, string> = {
  crown: 'Crown', seat: 'Paid seat', unpaid: 'In the soup, unpaid', out: 'Not in tonight’s soup',
  waiting: 'Waiting for the first round', unknown: '—', none: 'No body committed',
};
const short = (hotkey: string) => `${hotkey.slice(0, 6)}…${hotkey.slice(-4)}`;

/** Every uid with a soup body or a serving endpoint, from chain commitments, joined with tonight's soups. */
export function ChainTable({ chain, rows }: { chain: NetworkBodies; rows: MinerRow[] }) {
  return <div className={s.chain}>
    {rows.length ? <table className={s.table} aria-label="Miners on chain" data-contrast>
      <thead><tr><th scope="col">UID</th><th scope="col">Hotkey</th><th scope="col">Tier</th><th scope="col">Body</th><th scope="col">Tonight</th><th scope="col">Serving</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.uid} data-standing={r.standing}>
        <td data-label="UID" className={s.uid}><span>{r.uid}</span></td>
        <td data-label="Hotkey"><code title={r.hotkey}>{short(r.hotkey)}</code></td>
        <td data-label="Tier"><span>{r.tier ?? '—'}</span></td>
        <td data-label="Body">{r.body ? <><a href={hfTree(r.body.repo, r.body.revision)}>{r.body.repo}</a> <code className={s.rev}>{r.body.revision.slice(0, 7)}</code></> : <span>—</span>}</td>
        <td data-label="Tonight" className={s.standing}><span>{(r.standing === 'seat' || r.standing === 'crown') && <i className={s.chip} aria-hidden="true" />}{STANDING[r.standing]}</span></td>
        <td data-label="Serving"><span>{r.serving ? 'Endpoint announced' : '—'}</span></td>
      </tr>)}</tbody>
    </table> : <p className={s.note}>No miner has committed a body yet.</p>}
    <p className={s.fine}><span>Block {chain.block.toLocaleString('en-US')}</span> on subnet {chain.netuid}. Bodies come from chain commitments; a miner may hold one per hotkey. An announced endpoint means the miner can serve; Zils does not send traffic to miners yet.</p>
  </div>;
}
