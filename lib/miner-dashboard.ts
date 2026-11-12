import { z } from 'zod';
import { TIER_NAMES, type Tier } from './soup-tiers';
import type { SoupBoard } from './soup-board';

// Contract for GET /v1/network/miner/dashboard (zils-platform miner_dashboard.view): the hotkey behind a private
// link from `zils-miner dashboard`, the validator's report the hosted API kept when the link was made, and that
// hotkey's newest customer jobs. Report entries are zils/soup_report.build's. Strict objects: anything extra is
// refused, so a job id, an owner or a copy-check detail can never reach the page through this feed.
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const number = z.number().finite();
const STAGES = ['seated', 'seated_unpaid', 'deferred', 'not_selected', 'screened_out', 'refused'] as const;
const entry = z.object({
  body_sha256: sha.nullable(), stage: z.enum(STAGES), reason: z.string().regex(/^[a-z_]{1,40}$/).nullable(),
  rate: number.optional(),
  screen: z.object({ score: number, needed: number }).strict().optional(),
  solo: z.object({ score: number, soup: number }).strict().optional(),
  categories: z.record(z.string().regex(/^[a-z]{1,20}$/), z.object({ score: number, soup: number }).strict()).optional(),
  trial: z.object({ gain: number, needed: number }).strict().optional(),
  seat: z.object({ contribution: number, floor: number }).strict().optional(),
  gate: z.object({ base: z.enum(['house', 'soup', 'release']).nullable(), needed: number }).strict().optional(),
}).strict();
export type ReportBody = z.infer<typeof entry>;
const job = z.object({
  created_at: z.string().max(40).nullable(), track: z.enum(['text', 'image']),
  state: z.enum(['ready', 'leased', 'submitted', 'failed']), status: z.string().max(32).nullable(),
  evaluated: z.boolean(), skill: number.nullable(), selected: z.boolean(),
}).strict();
export type MinerJob = z.infer<typeof job>;
export const minerDashboardSchema = z.object({
  hotkey: z.string().min(1).max(100),
  report: z.object({ pools: z.record(z.string().min(1).max(32), z.object({ round_id: z.string().max(64).nullable(), bodies: z.array(entry).max(64) }).strict()) }).strict(),
  jobs: z.array(job).max(50),
  expires_at: z.iso.datetime({ offset: true }),
}).strict();
export type MinerDashboard = z.infer<typeof minerDashboardSchema>;

/** A report stage as the page names it; the tone picks its mark. */
export const STAGE: Record<ReportBody['stage'], { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  seated: { label: 'Seated', tone: 'good' },
  seated_unpaid: { label: 'Seated, unpaid', tone: 'warn' },
  deferred: { label: 'Waiting', tone: 'warn' },
  not_selected: { label: 'Not selected', tone: 'bad' },
  screened_out: { label: 'Not in the pool', tone: 'bad' },
  refused: { label: 'Refused', tone: 'bad' },
};

const CHECK = 'Run zils-miner commit-body --check --path <folder> to see which.';
const OWN = 'Commit a body with your own training.';
// zils/soup_report.py EXPLAIN, the sentences `zils-miner report` prints: reason -> [what happened, what to do next].
const EXPLAIN: Record<string, [string, string | null]> = {
  round_limit: ['The round reached its limit on new bodies, claims, downloads or disk before your turn.', 'Nothing to do; it is tried again next round.'],
  download_failed: ['The validator could not download your repo.', 'Check that the repo is public; it is tried again in a later round.'],
  backing_off: ['Your hotkey’s last claim failed, so it sits out a few rounds.', 'Nothing to do; it is tried again after the wait.'],
  committed_first_by_another: ['Another hotkey committed this exact body first.', OWN],
  rejected_earlier: ['This body was refused in an earlier round.', 'Commit a new body.'],
  failed_earlier: ['This commitment failed in an earlier round.', 'Upload a new revision and commit it.'],
  twin: ['Your body answers almost exactly like a body already in the pool.', 'Commit a new revision; it is also tried again when that body leaves the pool.'],
  house_reupload: ['Your body is a re-upload of a house ingredient.', 'Fine-tune it first; a fine-tune of a house ingredient is welcome.'],
  no_change: ['Your body is the pool’s parent, unchanged.', OWN],
  near_copy: ['Your body is a near-copy of an earlier body, or mostly built from other miners’ bodies.', OWN],
  owner_file: ['zils-owner.json is missing or names another hotkey.', 'Run zils-miner commit-body --write-owner --path <folder>, upload, then commit.'],
  license: ['The model card has no accepted license.', 'Add a license to the README.md front matter, upload, then commit.'],
  hash_mismatch: ['The downloaded body does not hash to your commitment.', 'Commit the revision you uploaded with zils-miner commit-body.'],
  change_cap: ['Your body moved further from the pool’s parent than the change bound allows.', 'Run zils-miner commit-body --check --path <folder> to see the change and the bound.'],
  not_finite: ['A weight in your body is NaN or infinite.', CHECK],
  too_large: ['Your body is over the pool’s size limit.', CHECK],
  bad_commitment: ['The commitment text is malformed or names an unknown pool.', 'Commit again with zils-miner commit-body.'],
  bad_format: ['A tensor is missing, extra, misshapen or of the wrong type.', CHECK],
  check_failed: ['Your body failed a check.', CHECK],
  grade_failed: ['Your body could not be graded this round.', 'Nothing to do yet; after three such rounds it is refused.'],
  below_screen: ['Your screening score was below the lowest score that entered the pool.', 'Train a stronger body; only the best new bodies are graded in full.'],
  pool_full: ['An earlier body of yours was left out of this round’s full pool.', 'Commit a stronger body.'],
  no_soup_gain: ['Adding your body did not raise the soup’s score by the margin needed.', 'Train where the soup is weak, not where it is already strong.'],
  soup_full: ['The soup reached its member limit before your body’s turn.', 'Raise your score alone; bodies are tried in that order.'],
  current_soup_kept: ['Your body was in the new soup, but that soup did not beat the current one by the margin.', 'Nothing is wrong with the body; the new soup needs a larger gain.'],
  below_floor: ['Your body is in the soup, but its contribution is under the seat floor.', 'Add more of what the soup lacks.'],
  fine_tune_gate: ['Your body is a fine-tune that did not beat its base alone by the margin.', 'Train until your body alone beats what you started from.'],
  unpaid_rate: ['Your body is in the soup at rate 0, which pays nothing.', null],
};

/** [what happened, what to do next] for a report's reason code; a code this page does not know is shown as sent. */
export function explain(reason: string | null): [string, string | null] {
  if (reason === null) return ['Your body is in the soup and its seat pays.', null];
  return EXPLAIN[reason] ?? [`Reason code: ${reason}.`, null];
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

/** A body's numbers next to the bars they are measured against, in the order `zils-miner report` prints them. */
export function bodyNumbers(body: ReportBody) {
  const rows: { label: string; value: string; bar: string }[] = [];
  if (body.trial) rows.push({ label: 'Soup gain', value: signed(body.trial.gain), bar: `needed ${signed(body.trial.needed)}` });
  if (body.seat) rows.push({ label: 'Contribution', value: String(body.seat.contribution), bar: `floor ${body.seat.floor}` });
  if (body.gate) rows.push({ label: 'Base', value: body.gate.base ?? 'unknown', bar: `must beat it by ${body.gate.needed}` });
  if (body.solo) rows.push({ label: 'Alone', value: String(body.solo.score), bar: `soup ${body.solo.soup}` });
  if (body.screen) rows.push({ label: 'Screening', value: String(body.screen.score), bar: `needed ${body.screen.needed}` });
  if (body.rate !== undefined && body.rate !== 1) rows.push({ label: 'Rate', value: String(body.rate), bar: '' });
  return rows;
}

/** The category where the body trails the soup most, or null when it trails nowhere or two categories tie. */
export function weakestCategory(categories: ReportBody['categories']) {
  const gaps = Object.entries(categories ?? {}).map(([name, pair]) => [name, pair.soup - pair.score] as const);
  if (!gaps.length) return null;
  const worst = Math.max(...gaps.map(([, gap]) => gap));
  const behind = gaps.filter(([, gap]) => gap === worst);
  return worst > 0 && behind.length === 1 ? behind[0][0] : null;
}

type Board = { tiers: { tier: string; rounds: Pick<SoupBoard['tiers'][number]['rounds'][number], 'round_id' | 'members' | 'crown'>[] }[] };

/** The rounds in the public soup feed where the hotkey's body sat in a soup, newest first: its seat, what the soup
 *  loses without it, and the share of emissions the seat (and crown) carried. */
export function seatHistory(board: Board | null, hotkey: string) {
  const rows = (board?.tiers ?? []).flatMap(t => t.rounds.flatMap(r => r.members.filter(m => m.hotkey === hotkey).map(m => {
    const crowned = r.crown?.hotkey === hotkey && r.crown.body_sha256 === m.body_sha256;
    const share = Math.round((m.seat_weight + (crowned ? r.crown!.weight : 0)) * 1e6) / 1e6;
    return {
      day: /(\d{4}-\d{2}-\d{2})$/.exec(r.round_id)?.[1] ?? r.round_id, tier: t.tier, round: r.round_id, body: m.body_sha256,
      seat: crowned ? 'crown' as const : m.seat_weight > 0 ? 'seat' as const : 'unpaid' as const,
      contribution: m.contribution, share,
    };
  })));
  const rank = (tier: string) => TIER_NAMES.indexOf(tier as Tier);
  rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0) || rank(a.tier) - rank(b.tier));
  return { rows, rounds: rows.length, paid: rows.filter(r => r.share > 0).length };
}

/** Counts over a hotkey's listed customer jobs, and the median skill of the graded ones. */
export function jobTotals(jobs: MinerJob[]) {
  const skills = jobs.flatMap(j => j.evaluated && j.skill !== null ? [j.skill] : []).sort((a, b) => a - b);
  const mid = skills.length >> 1;
  return {
    assigned: jobs.length,
    submitted: jobs.filter(j => j.state === 'submitted').length,
    evaluated: jobs.filter(j => j.evaluated).length,
    selected: jobs.filter(j => j.selected).length,
    medianSkill: skills.length ? (skills.length % 2 ? skills[mid] : (skills[mid - 1] + skills[mid]) / 2) : null,
  };
}
