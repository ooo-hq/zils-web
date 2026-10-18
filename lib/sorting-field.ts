// Pure geometry and path logic for the animated "Sorting" hero. No DOM, no randomness:
// callers pass random values in. Lane copy comes from the home.html mockup.

export type LaneId = 'billing' | 'spam' | 'account' | 'tech' | 'sales' | 'review';
export type Cell = { col: number; row: number };
export type Lane = {
  id: LaneId;
  label: string;
  color: string; // fallback hex; the canvas reads the live value from `cssVar`
  cssVar: string;
  desk: Cell;
  phone: Cell | null;
  side: 0 | 1;
  messages: string[];
  files: string[];
};

export const COLS = 10;
export const ROWS = 6;
export const SKY = [4, 3, 2, 3, 4, 4, 3, 4, 3, 2];

export const READ_FRACTION = 0.44;
export const SPAWN_MS = 2400;
export const PHONE_TICK_MS = 2600;
export const HESITATE_P = 0.16;
export const PRE_ALPHA = 0.12;
export const POST_ALPHA = [0.26, 0.46];

export const LANES: Lane[] = [
  { id: 'billing', label: 'Billing', color: '#f08a4b', cssVar: '--zs-lane-billing', desk: { col: 0, row: 2 }, phone: { col: 0, row: 2 }, side: 0,
    messages: ['Please send me a receipt.', 'Charged twice this month', 'Refund for order 2231?', 'Can I pay yearly?'],
    files: ['receipt_0412.jpg', 'invoice-scan.pdf'] },
  { id: 'spam', label: 'Spam', color: '#e7a58f', cssVar: '--zs-lane-spam', desk: { col: 1, row: 1 }, phone: null, side: 0,
    messages: ['You won a free cruise!!', 'Crypto opportunity, act now', 'Re: re: re: urgent wire'], files: [] },
  { id: 'account', label: 'Account changes', color: '#d7a6e8', cssVar: '--zs-lane-account', desk: { col: 3, row: 0 }, phone: { col: 5, row: 0 }, side: 0,
    messages: ['Change my account email', 'Add a teammate', 'Rename our workspace', 'Transfer to Dana'],
    files: ['new-id-card.jpg'] },
  { id: 'tech', label: 'Technical support', color: '#c3b2f6', cssVar: '--zs-lane-tech', desk: { col: 6, row: 0 }, phone: { col: 0, row: 0 }, side: 1,
    messages: ['App closes when I open it', 'Invoice page keeps crashing', 'Login loops on Android', 'Export does nothing'],
    files: ['crash-screenshot.png', 'error-modal.png'] },
  { id: 'sales', label: 'Sales', color: '#a9b5f2', cssVar: '--zs-lane-sales', desk: { col: 8, row: 1 }, phone: null, side: 1,
    messages: ['Do you offer volume pricing?', 'Can we get a demo Friday?', 'Pricing for 40 seats?'], files: [] },
  { id: 'review', label: 'Needs review', color: '#8ea6ff', cssVar: '--zs-lane-review', desk: { col: 7, row: 2 }, phone: { col: 5, row: 2 }, side: 1,
    messages: ['Nobody answered in 3 days', 'Fourth time asking', 'I want to speak to legal'], files: ['damaged-box.jpg'] },
];

export const isPhone = (width: number) => width < 700;
export const rowHeight = (width: number) => (isPhone(width) ? 34 : 42);

export function fieldGeometry(width: number, height: number) {
  const gutter = isPhone(width) ? 0 : 56;
  const left = gutter, right = width - gutter, rh = rowHeight(width);
  return { left, right, cell: (right - left) / COLS, top: height - ROWS * rh, bottom: height, rh };
}

export const visibleLanes = (width: number): Lane[] => (isPhone(width) ? LANES.filter((l) => l.phone) : LANES);

export const heroHeight = (consoleBottom: number, width: number) =>
  Math.max(isPhone(width) ? 720 : 860, Math.ceil(consoleBottom + 40 + ROWS * rowHeight(width)));

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// t is progress 0..1 from the reading row to the tag. With `tempt`, drift to it by t=0.55, wobble, then commit.
export function itemX(t: number, x0: number, target: number, tempt: number | null): number {
  if (t >= 1) return target;
  t = Math.max(0, t);
  if (tempt === null) return x0 + (target - x0) * ease(t);
  const a = ease(Math.min(1, t / 0.55)), b = ease(Math.max(0, (t - 0.55) / 0.45));
  const wobble = Math.sin(t * 28) * 6 * Math.sin(Math.min(1, t / 0.55) * Math.PI);
  return x0 + (tempt - x0) * a * (1 - b) + (target - x0) * b + wobble;
}
