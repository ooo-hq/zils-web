// Shared by the train-box and train-chat prototypes: reading examples and guessing what each column is.

export type Row = Record<string, string>;
export type Kind = 'table' | 'images' | 'documents';
export type Dataset = { name: string; kind: Kind; columns: string[]; rows: Row[]; swatches?: string[] };
export type Role = 'reads' | 'decides' | 'unused';
export type Inferred =
  | { type: 'yesno'; answers: string[] }
  | { type: 'choice'; answers: string[] }
  | { type: 'score'; min: number; max: number }
  | { type: 'missing' }
  | { type: 'single'; answer: string }
  | { type: 'toomany'; count: number };

export const ANSWER_NAME = /answer|label|decision|outcome|target|class|category|action|result|team|verdict|condition/i;
export const ID_NAME = /(^|_)(id|uuid|key|ticket|ref|reference|number|no)($|_)/i;
export const YES = ['yes', 'true', 'y'];
export const YESNO = new Set([...YES, 'no', 'false', 'n']);
export const SHOWN = 6;

/** Tab-separated rows, as a spreadsheet copies them: tabs split cells, so commas inside a value survive. */
export function parseTsv(text: string): Row[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
  const [head = '', ...body] = lines;
  const names = head.split('\t').map(h => h.trim());
  return body.map(line => { const cells = line.split('\t'); return Object.fromEntries(names.map((h, i) => [h, (cells[i] ?? '').trim()])); });
}

/** Looks like rows copied from Excel or Google Sheets: a header and at least one row, split by tabs. */
export function looksLikeRows(text: string) {
  const lines = text.trim().split(/\r?\n/);
  return lines.length >= 2 && lines[0].includes('\t') && lines.slice(1).every(line => line.split('\t').length <= lines[0].split('\t').length + 1);
}

export function parseCsv(text: string): Row[] {
  const out: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; continue; }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(v => v.trim())) out.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(v => v.trim())) out.push(row);
  const [head = [], ...body] = out;
  return body.map(cells => Object.fromEntries(head.map((h, i) => [h.trim(), (cells[i] ?? '').trim()])));
}
export const flat = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);
export const parseObjects = (items: unknown[]): Row[] => items.filter(x => x && typeof x === 'object' && !Array.isArray(x)).map(x => Object.fromEntries(Object.entries(x as object).map(([k, v]) => [k, flat(v)])));

export function infer(values: string[]): Inferred {
  const seen = values.map(v => v.trim()).filter(Boolean);
  if (!seen.length) return { type: 'missing' };
  const distinct = [...new Set(seen)];
  if (distinct.length === 1) return { type: 'single', answer: distinct[0] };
  if (distinct.length === 2 && distinct.every(v => YESNO.has(v.toLowerCase()))) return { type: 'yesno', answers: distinct.sort(a => YES.includes(a.toLowerCase()) ? -1 : 1) };
  const numbers = seen.map(Number);
  if (numbers.every(Number.isFinite) && distinct.length > 6) return { type: 'score', min: Math.min(...numbers), max: Math.max(...numbers) };
  if (distinct.length <= 50) return { type: 'choice', answers: distinct.sort() };
  return { type: 'toomany', count: distinct.length };
}
export const fmt = (n: number) => n.toLocaleString();
export const examples = (n: number) => `${fmt(n)} ${n === 1 ? 'example' : 'examples'}`;
export function kindOf(q: Inferred) {
  switch (q.type) {
    case 'yesno': return 'yes or no';
    case 'choice': return `picks 1 of ${q.answers.length}`;
    case 'score': return `a number, ${fmt(q.min)} to ${fmt(q.max)}`;
    case 'missing': return 'type the answers below';
    case 'single': return 'needs a second answer';
    case 'toomany': return `${fmt(q.count)} different values`;
  }
}
export const list = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
export const slug = (s: string) => s.replace(/[^a-z0-9]/gi, '-');

export const EXAMPLES: Record<string, Dataset> = {
  'Support tickets': { name: 'support-tickets.csv', kind: 'table', columns: ['ticket_id', 'message', 'channel', 'team', 'urgent'], rows: [
    ['T-1', 'Please send last month’s invoice.', 'email', 'Billing', 'no'], ['T-2', 'The app crashes when I open it.', 'chat', 'Tech support', 'yes'],
    ['T-3', 'Can I add five more seats?', 'email', 'Sales', 'no'], ['T-4', 'I was charged twice this month.', 'phone', 'Billing', 'yes'],
    ['T-5', 'Login link never arrives.', 'chat', 'Tech support', 'yes'], ['T-6', 'Do you offer an annual plan?', 'email', 'Sales', 'no'],
    ['T-7', 'Change the email on my account.', 'chat', 'Account changes', 'no'],
  ].map(([ticket_id, message, channel, team, urgent]) => ({ ticket_id, message, channel, team, urgent })) },
  'Doom moves': { name: 'doom-frames.jsonl', kind: 'table', columns: ['tick', 'state', 'action'], rows: [
    ['104', '{"health":64,"ammo":12,"enemy":"imp, 3m ahead"}', 'FIRE'], ['105', '{"health":64,"ammo":11,"enemy":"none","door":"ahead"}', 'FORWARD'],
    ['106', '{"health":31,"ammo":0,"enemy":"demon, 2m right"}', 'MOVE_LEFT'], ['107', '{"health":31,"ammo":0,"switch":"ahead"}', 'USE'],
    ['108', '{"health":80,"ammo":20,"enemy":"zombie, 6m right"}', 'TURN_RIGHT'],
  ].map(([tick, state, action]) => ({ tick, state, action })) },
  'Tweet reach': { name: 'tweets.csv', kind: 'table', columns: ['tweet', 'has_image', 'likes_after_24h'], rows: [
    ['shipping the new miner CLI today', 'yes', '412'], ['thread: why small decision models beat giant ones on routing', 'no', '1830'],
    ['maintenance window tonight, 2 to 3 UTC', 'no', '35'], ['we just open-sourced the exam bank', 'yes', '960'], ['what should we build next?', 'no', '220'],
    ['z3-mini now reads 8k tokens', 'yes', '640'], ['hiring a founding engineer', 'no', '505'],
  ].map(([tweet, has_image, likes]) => ({ tweet, has_image, likes_after_24h: likes })) },
  'Product photos': { name: 'photos (defect, ok)', kind: 'images', columns: ['photo', 'condition'], swatches: ['#8a6f5a', '#5f7a66', '#6d6f8a', '#8a5a64', '#5a7f8a', '#7a7a5a'], rows: [
    ['defect/scratch-01.jpg', 'defect'], ['ok/part-02.jpg', 'ok'], ['defect/dent-03.jpg', 'defect'], ['ok/part-04.jpg', 'ok'], ['ok/part-05.jpg', 'ok'], ['defect/crack-06.jpg', 'defect'],
  ].map(([photo, condition]) => ({ photo, condition })) },
};

export function guessRoles(data: Dataset): Record<string, Role> {
  if (data.kind !== 'table') return Object.fromEntries(data.columns.map((c, i) => [c, i === 0 ? 'reads' : 'decides']));
  const decide = data.columns.find(c => ANSWER_NAME.test(c)) ?? data.columns.at(-1)!;
  return Object.fromEntries(data.columns.map(c => [c, c === decide ? 'decides' : ID_NAME.test(c) ? 'unused' : 'reads']));
}

/** Read dropped or chosen files into one dataset: a table, photos or documents. Throws a message for the visitor. */
export async function readFiles(picked: File[]): Promise<Dataset> {
  const images = picked.filter(f => f.type.startsWith('image/'));
  const docs = picked.filter(f => /\.(pdf|docx?|txt|md)$/i.test(f.name));
  const table = picked.find(f => /\.(csv|tsv|json|jsonl|ndjson)$/i.test(f.name));
  if (table) {
    const text = await table.text();
    const rows = /\.(jsonl|ndjson)$/i.test(table.name) ? parseObjects(text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)))
      : /\.json$/i.test(table.name) ? parseObjects([JSON.parse(text)].flat())
      : /\.tsv$/i.test(table.name) ? parseTsv(text) : parseCsv(text);
    if (!rows.length) throw new Error(`${table.name} has no rows.`);
    return { name: table.name, kind: 'table', columns: Object.keys(rows[0]), rows };
  }
  if (picked.some(f => /\.(xlsx|xls)$/i.test(f.name))) throw new Error('The real page reads Excel with its spreadsheet reader. This prototype reads CSV, JSON and JSONL.');
  if (images.length) {
    const rows = images.map(f => { const parts = (f.webkitRelativePath || f.name).split('/'); return { photo: parts.slice(-2).join('/'), answer: parts.length > 2 ? parts.at(-2)! : '' }; });
    return { name: images.length === 1 ? images[0].name : `${fmt(images.length)} photos`, kind: 'images', columns: ['photo', 'answer'], rows, swatches: rows.map((_, i) => `hsl(${(i * 47) % 360} 18% 45%)`) };
  }
  if (docs.length) return { name: docs.length === 1 ? docs[0].name : `${fmt(docs.length)} documents`, kind: 'documents', columns: ['document', 'answer'], rows: docs.map(f => ({ document: f.name, answer: '' })) };
  throw new Error(`Zils can’t read ${picked[0]?.name ?? 'that'} yet. Use a spreadsheet, photos or documents.`);
}
