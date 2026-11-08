'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowUp, Paperclip, Plus, X } from 'lucide-react';
import { EXAMPLES, ID_NAME, examples, fmt, guessRoles, infer, looksLikeRows, readFiles, type Dataset, type Inferred, type Role } from '../train-box/data';
import type { Reply, TurnInput } from './setup-server';
import { checkedRoles, decidable, decidedIn, freeText, listed, named, scriptedRoles, scriptedSuggestion, summary, valid, values, type Roles } from './logic';
import css from './train-chat.module.css';

// Prototype. The setup assistant chooses what to read and decide from a summary of the file (column names,
// kinds, five sample values); this page checks its choice against the real rows. Without the assistant it
// falls back to a scripted agent. Nothing is uploaded or trained.

type Tier = 'open' | 'private';
type Message =
  | { id: number; from: 'you'; text: string; file?: string }
  | { id: number; from: 'zils'; text: string; actions?: string[] }
  | { id: number; from: 'zils'; lead?: string; proposal: { data: Dataset; roles: Roles }; actions: string[] }
  | { id: number; from: 'zils'; training: Tier; data: Dataset; roles: Roles }
  | { id: number; from: 'zils'; labeler: true };
/** Typing in answers when no column holds them: first the possible answers, then one example at a time. */
type Labeling = { stage: 'answers' } | { stage: 'labeling'; column: string; answers: string[]; queue: number[]; done: number; batch: number; paused: boolean };
const MIN_LABELS = 50, BATCH = 20;
type Draft = Message extends infer M ? (M extends unknown ? Omit<M, 'id'> : never) : never;
type Turn = { role: 'user' | 'assistant'; content: string };

const STARTERS: [string, string, string][] = [
  ['Route support tickets', 'Send support tickets to the right team.', 'Support tickets'],
  ['Pick Doom moves', 'Choose the next move from a Doom game state.', 'Doom moves'],
  ['Predict tweet likes', 'Predict how many likes a tweet gets.', 'Tweet reach'],
  ['Spot defective parts', 'Flag product photos that show a defect.', 'Product photos'],
];
const TIERS: Record<string, Tier> = { 'Open tier, free': 'open', 'Private, $0.20 per million tokens': 'private' };
const LANES: Record<string, string> = { billing: 'billing', spam: 'spam', 'account changes': 'account', 'technical support': 'tech', 'tech support': 'tech', sales: 'sales', 'needs review': 'review' };
const LANE_ORDER = ['billing', 'account', 'tech', 'sales', 'review', 'spam'];
/** Pasted rows travel as a .tsv file; people see “4 pasted rows”, not a file name. */
const shown = (name: string) => name.replace(/( pasted rows?)\.tsv$/, '$1');

function kindText(column: string, q: Inferred) {
  switch (q.type) {
    case 'yesno': return `${named(column)}, yes or no`;
    case 'choice': return `${named(column)}, one of ${q.answers.length}`;
    case 'score': return `${named(column)}, a number from ${fmt(q.min)} to ${fmt(q.max)}`;
    default: return named(column);
  }
}

export function TrainChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<File[]>([]);
  const [current, setCurrent] = useState<{ data: Dataset; roles: Roles; goal: string } | null>(null);
  const [labeling, setLabeling] = useState<Labeling | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [thinking, setThinking] = useState(false);
  const [scripted, setScripted] = useState(false);
  const [over, setOver] = useState(false);
  const next = useRef(1), files = useRef<HTMLInputElement>(null), folder = useRef<HTMLInputElement>(null), end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' }); }, [messages, thinking]);

  // The whole window is the drop target, sidebar included, so a dropped file is never opened by the browser instead.
  useEffect(() => {
    const files = (e: globalThis.DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
    const enter = (e: globalThis.DragEvent) => { if (files(e)) { e.preventDefault(); setOver(true); } };
    const leave = (e: globalThis.DragEvent) => { if (!e.relatedTarget) setOver(false); };
    const drop = (e: globalThis.DragEvent) => { if (!files(e)) return; e.preventDefault(); setOver(false); setAttached([...(e.dataTransfer?.files ?? [])]); };
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', enter);
    window.addEventListener('dragleave', leave); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); };
  }, []);

  const say = (reply: Draft) => setMessages(m => [...m, { ...reply, id: next.current++ } as Message]);
  function reply(...replies: Draft[]) {
    const spoken = replies.map(r => 'text' in r ? r.text : 'lead' in r ? r.lead ?? '' : '').filter(Boolean);
    if (spoken.length) setTurns(t => [...t, ...spoken.map(content => ({ role: 'assistant' as const, content }))]);
    setThinking(true);
    setTimeout(() => { setThinking(false); replies.forEach(say); }, 450);
  }

  function proposal(data: Dataset, roles: Roles, lead?: string, suggest?: string | null): Draft {
    const extra = suggest !== undefined ? (suggest && data.columns.includes(suggest) && roles[suggest] !== 'decides' && decidable(data, suggest) ? suggest : undefined) : scriptedSuggestion(data, roles);
    return { from: 'zils', lead, proposal: { data, roles }, actions: ['Train', ...(extra ? [`Also learn ${named(extra)}`] : []), 'Change something'] };
  }

  /** One turn with the setup assistant. Returns false when it isn't connected, so the scripted agent answers. */
  async function ask(history: Turn[], data: Dataset | null, roles: Roles | null, goal: string): Promise<boolean> {
    setThinking(true);
    let body: Reply | { error: string }, status = 0;
    try {
      const response = await fetch('/api/dev-preview/train-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        messages: history.slice(-16), ...(data ? { file: summary(data) } : {}),
        ...(data && roles ? { setup: { reads: data.columns.filter(c => roles[c] === 'reads'), decides: decidedIn(roles) } } : {}),
      } satisfies TurnInput) });
      status = response.status; body = await response.json();
    } catch { body = { error: 'The assistant could not connect. Try again.' }; }
    setThinking(false);
    if (status === 503 && 'error' in body && body.error.includes('not connected')) { setScripted(true); return false; }
    if ('error' in body) { reply({ from: 'zils', text: body.error }); return true; }
    if (body.kind === 'proposal' && data) {
      const roles = checkedRoles(data, body);
      if (!roles) { reply({ from: 'zils', text: 'I couldn’t match that to your columns. Which column holds the right answer?', actions: [...data.columns.filter(c => decidable(data, c)).map(c => `Decide ${named(c)}`), 'Add answers myself'] }); return true; }
      // A change request that leaves the setup as it was gets the assistant's explanation, not the same table again.
      const same = current?.data === data && JSON.stringify(current.roles) === JSON.stringify(roles);
      if (same) { reply({ from: 'zils', text: body.message, actions: ['Train', 'Change something'] }); return true; }
      setCurrent({ data, roles, goal });
      reply(proposal(data, roles, undefined, body.suggest)); // the sentence is written from the checked columns, not the model's prose
    } else if (body.kind === 'proposal' || body.kind === 'need_examples') {
      reply({ from: 'zils', text: body.message, actions: ['Add examples', 'Use a sample file'] });
    } else {
      reply({ from: 'zils', text: body.message, actions: body.choices });
    }
    return true;
  }

  async function send(text: string, picked: File[] = attached, sample?: Dataset) {
    const said = text.trim();
    if (!said && !picked.length && !sample) return;
    setDraft(''); setAttached([]);
    const fileName = sample?.name ?? (picked.length > 1 ? `${picked.length} files` : picked[0] && shown(picked[0].name));
    say({ from: 'you', text: said, file: fileName });
    const lower = said.toLowerCase();

    // Steps that need no assistant: training, the tier, samples.
    if (current && /^(train|start|go)$/.test(lower)) return train();
    const tierChoice = Object.keys(TIERS).find(k => k.toLowerCase() === lower);
    if (tierChoice) return start(TIERS[tierChoice]);
    if (lower === 'use a sample file') return reply({ from: 'zils', text: 'Pick one to see how it works.', actions: STARTERS.map(([label]) => label) });
    const starter = STARTERS.find(([label]) => label.toLowerCase() === lower);
    if (starter) return send(starter[1], [], EXAMPLES[starter[2]]);
    if (current && lower === 'change something') return changeOptions();
    if (current && labeling?.stage === 'answers') return beginLabeling(said);
    if (current && lower === 'keep labelling') return resumeLabeling();
    if (current && lower === 'train with these') return trainWithLabels();
    if (current && (lower === 'add answers myself' || /no answers|don.?t have (any |the )?answers|label (them|these|it) myself/.test(lower))) return askForAnswers(current.data, current.goal, true);

    let data = current?.data ?? null;
    if (sample || picked.length) {
      try { data = sample ?? await readFiles(picked); } catch (failure) { return reply({ from: 'zils', text: failure instanceof Error ? failure.message : 'I couldn’t read that file.' }); }
      if (data.kind === 'documents') return reply({ from: 'zils', text: 'I can’t read PDFs or documents yet. Put each document’s text in a spreadsheet column, with the right answer in the next column, and send me that.' });
    }
    const goal = (sample || picked.length) ? said || current?.goal || '' : current?.goal || said;
    const history = [...turns, { role: 'user' as const, content: said || `Here are my examples: ${fileName}.` }];
    setTurns(history);
    const fresh = data !== current?.data;
    if (data && fresh && !data.columns.some(c => decidable(data, c))) return askForAnswers(data, goal);
    // An exact edit naming a real column ("don't use has image", "also learn urgent") is applied directly: instant and
    // certain. Everything else goes to the assistant.
    if (!fresh && current && exactEdit(said, current.data)) return scriptedTurn(said, data, fresh, goal);
    if (!scripted && await ask(history, data, fresh ? null : current?.roles ?? null, goal)) return;
    scriptedTurn(said, data, fresh, goal);
  }

  function exactEdit(said: string, data: Dataset) {
    const lower = said.toLowerCase();
    const column = data.columns.some(c => lower.includes(c.toLowerCase()) || lower.includes(named(c).toLowerCase()));
    return column && /^(don.?t use|do not use|ignore|remove|drop|also (learn|decide)|add|decide .+ instead|use )/.test(lower.trim());
  }

  /** The fallback agent: rules instead of a model, enough to try the flow. */
  function scriptedTurn(said: string, data: Dataset | null, fresh: boolean, goal: string) {
    if (!data) return reply({ from: 'zils', text: 'Got it. Now add past examples: a spreadsheet where each row has what it should look at and the right answer. You can also paste rows straight from Excel or Google Sheets, or add a folder of photos with one subfolder per answer.', actions: ['Add examples', 'Use a sample file'] });
    if (fresh || !current) {
      const roles = scriptedRoles(data, goal);
      setCurrent({ data, roles, goal });
      if (!Object.values(roles).includes('reads')) return askForAnswers(data, goal);
      if (!decidedIn(roles).length) return reply({ from: 'zils', text: 'Which column holds the right answer?', actions: [...data.columns.filter(c => decidable(data, c)).map(c => `Decide ${named(c)}`), 'Add answers myself'] });
      return reply(proposal(data, roles));
    }
    const lower = said.toLowerCase(), column = data.columns.find(c => lower.includes(c.toLowerCase()) || lower.includes(named(c).toLowerCase()));
    if (!column) return reply({ from: 'zils', text: `I can change what it looks at or what it decides. Your columns are ${listed(data.columns.map(named))}. Try “also learn urgent” or “don’t use channel”.`, actions: ['Train', 'Change something'] });
    const roles = { ...current.roles };
    if (/don.?t use|ignore|without|remove|drop/.test(lower)) roles[column] = 'unused';
    else if (/instead|^decide|should decide|predict/.test(lower)) { for (const c in roles) if (roles[c] === 'decides') roles[c] = 'reads'; delete roles[column]; roles[column] = 'decides'; }
    else if (/also|add|learn|too/.test(lower)) { delete roles[column]; roles[column] = 'decides'; }
    else roles[column] = 'reads';
    // Never claim a change that did not happen, or one that leaves nothing to learn from.
    const keep = ['Train', 'Change something'];
    if (decidedIn(roles).some(c => !decidable(data, c))) return reply({ from: 'zils', text: `${named(column)} can’t be the answer: it holds ${data.kind === 'images' && column === 'photo' ? 'the photos themselves' : 'free text or IDs'}, not a short list of answers or a number.`, actions: keep });
    if (!Object.values(roles).includes('reads')) return reply({ from: 'zils', text: data.kind === 'images' ? 'The photo is what it learns from, so it has to stay. Adding more photos usually helps most.' : `${named(column)} is the only thing it reads, so it needs to stay. Use another column as well first, or add different examples.`, actions: keep });
    if (!decidedIn(roles).length) return reply({ from: 'zils', text: `That would leave nothing to decide. ${named(column)} is the only answer it learns.`, actions: keep });
    if (JSON.stringify(roles) === JSON.stringify(current.roles)) return reply({ from: 'zils', text: 'That’s already how it’s set up.', actions: keep });
    setCurrent({ ...current, roles });
    reply(proposal(data, roles, 'Done.'));
  }

  /** No column holds the answers: ask what the possible answers are, then label examples one at a time. */
  function askForAnswers(data: Dataset, goal: string, asked = false) {
    const roles: Roles = data.kind === 'table' ? Object.fromEntries(data.columns.map(c => [c, ID_NAME.test(c) ? 'unused' : 'reads'])) : { [data.columns[0]]: 'reads' };
    setCurrent({ data, roles, goal });
    setLabeling({ stage: 'answers' });
    reply({ from: 'zils', text: `${asked ? 'Sure, you can type the answers yourself' : data.kind === 'images' ? 'These photos don’t have answers yet, so let’s add them' : 'None of these columns holds the right answers, so let’s add them'}. What are the possible answers? Type them separated by commas, like “approve, hold, reject”.` });
  }
  function beginLabeling(said: string) {
    if (!current) return;
    const answers = [...new Set(said.split(/,|\n|\bor\b/).map(a => a.trim()).filter(Boolean))].slice(0, 16);
    if (answers.length < 2) return reply({ from: 'zils', text: 'A decision needs at least two possible answers. Type them separated by commas, like “yes, no”.' });
    const { data } = current;
    const column = data.kind !== 'table' && data.columns.includes('answer') ? 'answer' : ['answer', 'answer_2', 'answer_3'].find(c => !data.columns.includes(c))!;
    const next = { ...data, columns: data.columns.includes(column) ? data.columns : [...data.columns, column], rows: data.rows.map(r => ({ ...r, [column]: r[column] ?? '' })) };
    const roles: Roles = { ...Object.fromEntries(Object.entries(current.roles).map(([c, r]) => [c, r === 'decides' ? 'unused' : r])), [column]: 'decides' };
    setCurrent({ ...current, data: next, roles });
    setLabeling({ stage: 'labeling', column, answers, queue: next.rows.map((_, i) => i).filter(i => !next.rows[i][column]).slice(0, 500), done: 0, batch: 0, paused: false });
    reply({ from: 'zils', text: `Pick the right answer for each example. The number keys 1 to ${answers.length} work too.` }, { from: 'zils', labeler: true });
  }
  function label(value: string | null) {
    if (!current || labeling?.stage !== 'labeling' || labeling.paused) return;
    const [index, ...rest] = labeling.queue;
    if (index === undefined) return;
    if (value !== null) {
      const rows = current.data.rows.slice();
      rows[index] = { ...rows[index], [labeling.column]: value };
      setCurrent({ ...current, data: { ...current.data, rows } });
    }
    const done = labeling.done + (value === null ? 0 : 1), batch = labeling.batch + 1;
    if (batch < BATCH && rest.length) return setLabeling({ ...labeling, queue: rest, done, batch });
    setLabeling({ ...labeling, queue: rest, done, batch: 0, paused: true });
    const advice = done >= MIN_LABELS ? 'That’s enough to try training, and more examples usually make it better.' : `About ${MIN_LABELS} is the least worth testing, and a few hundred is better.`;
    reply({ from: 'zils', text: `${done} answered${rest.length ? '' : ', and that’s every example'}. ${advice}`, actions: [...(rest.length ? ['Keep labelling'] : []), ...(done >= 2 ? ['Train with these'] : [])] });
  }
  function resumeLabeling() {
    if (labeling?.stage !== 'labeling' || !labeling.queue.length) return;
    setLabeling({ ...labeling, paused: false });
    reply({ from: 'zils', labeler: true });
  }
  function trainWithLabels() {
    if (!current || labeling?.stage !== 'labeling') return;
    const q = infer(values(current.data, labeling.column));
    if (q.type !== 'choice' && q.type !== 'yesno') return reply({ from: 'zils', text: 'So far every answer is the same. Answer a few more, including the other options, so it has something to learn.', actions: ['Keep labelling'] });
    setLabeling(null);
    reply(proposal(current.data, current.roles));
  }

  function changeOptions() {
    if (!current) return;
    const { data, roles } = current;
    // Offer only edits that can happen: never removing the last thing it reads, never deciding something that isn't an answer.
    const reads = data.columns.filter(c => roles[c] === 'reads');
    const options = [
      ...(reads.length > 1 ? reads.map(c => `Don’t use ${named(c)}`) : []),
      ...data.columns.filter(c => roles[c] !== 'decides' && decidable(data, c)).map(c => `Decide ${named(c)} instead`),
      ...data.columns.filter(c => roles[c] === 'unused').map(c => `Use ${named(c)}`),
    ];
    if (!options.length) return reply({ from: 'zils', text: data.kind === 'images' ? 'With photos, the photo is what it learns from and the folder name is the answer, so there’s nothing to swap. You can add more photos, which usually helps most.' : 'There’s nothing else to change in this file. You can add more examples, which usually helps most.', actions: ['Train', 'Add examples'] });
    reply({ from: 'zils', text: `What should change? You can also type it, like “don’t use ${named(reads.at(-1) ?? data.columns[0])}”.`, actions: options });
  }
  function train() {
    if (!current) return;
    if (!tier) return reply({ from: 'zils', text: 'Last thing: who should train it? Open-tier models are trained free by Zils network miners, who receive your examples and must delete them within 7 days. Private models are trained only on Zils workers.', actions: Object.keys(TIERS) });
    start(tier);
  }
  function start(choice: Tier) {
    setTier(choice);
    if (current) reply({ from: 'zils', training: choice, data: current.data, roles: current.roles });
  }

  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft); }
  }
  /** Rows copied from Excel or Google Sheets arrive as tab-separated text: treat them as an attached file. */
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = [...event.clipboardData.files];
    if (pasted.length) { event.preventDefault(); return setAttached(pasted); }
    const text = event.clipboardData.getData('text/plain');
    if (!looksLikeRows(text)) return;
    event.preventDefault();
    const rows = text.trim().split(/\r?\n/).length - 1;
    setAttached([new File([text], `${fmt(rows)} pasted ${rows === 1 ? 'row' : 'rows'}.tsv`, { type: 'text/tab-separated-values' })]);
  }

  const last = messages.at(-1);
  const lastLabeler = messages.findLast(m => 'labeler' in m)?.id;
  const trainShowing = Boolean(last && 'actions' in last && last.actions?.includes('Train')) && !thinking;
  return <div className={css.page} data-over={over} data-started={messages.length > 0}>
    {over && <div className={css.dropOverlay} aria-hidden="true"><span>Drop your examples</span></div>}
    <div className={css.inner}>
      {messages.length ? <h1 className="sr-only">Train a model</h1> : <header className={css.intro}>
        <h1 className={css.title}>What should your model decide?</h1>
        <p className={css.lede}>Say it in your own words and attach past examples. Zils works out the rest.</p>
      </header>}


      <div className={css.thread} aria-live="polite">
        {messages.map(m => m.from === 'you'
          ? <div key={m.id} className={css.you}>{m.text && <p>{m.text}</p>}{m.file && <span className={css.file}><Paperclip size={12} aria-hidden="true" />{m.file}</span>}</div>
          : <div key={m.id} className={css.zils}>
              {'text' in m && <p>{m.text}</p>}
              {'proposal' in m && <Proposal lead={m.lead} data={m.proposal.data} roles={m.proposal.roles} />}
              {'training' in m && <Training tier={m.training} data={m.data} roles={m.roles} />}
              {'labeler' in m && current && labeling?.stage === 'labeling' && (m.id === lastLabeler && !labeling.paused
                ? <Labeler data={current.data} reads={current.data.columns.filter(c => current.roles[c] === 'reads')} answers={labeling.answers} index={labeling.queue[0]} done={labeling.done} onAnswer={label} />
                : <p className={css.small}>Answered {labeling.done} so far.</p>)}
              {'actions' in m && m.actions && m.id === last?.id && !thinking && <div className={css.actions}>{m.actions.map(a => <button key={a} className={a === 'Train' ? css.primary : css.secondary} onClick={() => a === 'Add examples' ? files.current?.click() : void send(a)}>{a}</button>)}</div>}
            </div>)}
        {thinking && <div className={css.zils}><p className={css.thinking}>Looking at your examples…</p></div>}
        <div ref={end} className={css.end} />
      </div>

      <form className={css.composer} onSubmit={e => { e.preventDefault(); void send(draft); }}>
        {attached.length > 0 && <span className={css.file}><Paperclip size={12} aria-hidden="true" />{attached.length > 1 ? `${attached.length} files` : shown(attached[0].name)}<button type="button" aria-label="Remove attachment" onClick={() => setAttached([])}><X size={12} /></button></span>}
        <div className={css.row}>
          <button type="button" className={css.add} onClick={() => files.current?.click()}><Plus size={16} aria-hidden="true" />{messages.length ? <span className="sr-only">Add examples</span> : 'Add examples'}</button>
          <textarea rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={keys} onPaste={paste} placeholder={messages.length ? 'Reply, or ask for a change' : 'Describe the decision, or paste rows'} aria-label="Message" />
          <button className={trainShowing ? css.sendQuiet : css.send} aria-label="Send" disabled={!draft.trim() && !attached.length}><ArrowUp size={17} /></button>
        </div>
        <input ref={files} type="file" multiple hidden onChange={e => { setAttached([...(e.target.files ?? [])]); e.target.value = ''; }} />
        <input ref={folder} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={e => { setAttached([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </form>
      {!messages.length && <p className={css.hint}>CSV, Excel or JSON with the right answer in one column, rows pasted from a spreadsheet, or <button type="button" className={css.inline} onClick={() => folder.current?.click()}>a folder of photos</button> with one subfolder per answer.</p>}
      {!messages.length && <div className={css.starters}>{STARTERS.map(([label, goal, sample]) => <button key={label} className={css.chip} onClick={() => void send(goal, [], EXAMPLES[sample])}>{label}</button>)}</div>}
      <p className={css.footnote}>Prototype{scripted ? ', answered by a scripted agent' : ''}. What you attach stays in this tab.</p>
    </div>
  </div>;
}

function lane(answer: string, all: string[]): CSSProperties {
  const fixed = LANES[answer.toLowerCase()];
  return { '--lane': `var(--zs-lane-${fixed ?? LANE_ORDER[Math.max(0, all.indexOf(answer)) % LANE_ORDER.length]})` } as CSSProperties;
}

/** The proposal: the assistant's sentence, then real rows split by the line between what it sees and what it decides. */
function Proposal({ lead, data, roles }: { lead?: string; data: Dataset; roles: Roles }) {
  const reads = data.columns.filter(c => roles[c] === 'reads'), chosen = decidedIn(roles);
  const kinds = chosen.map(c => [c, infer(values(data, c))] as const);
  const answers = Object.fromEntries(kinds.map(([c, q]) => [c, q.type === 'choice' || q.type === 'yesno' ? q.answers : []]));
  const looks = data.kind === 'images' ? 'each photo' : listed(reads.map(named));
  const answered = data.rows.filter(r => chosen.every(c => (r[c] ?? '').trim()));
  return <>
    <p className={css.lead}>{lead && lead !== 'Done.' ? lead : `${lead ? 'Done. ' : ''}I’ll train a model that reads ${looks} and decides ${listed(chosen.map(named))}.`}</p>
    <div className={css.sample} role="table" aria-label="Examples from your file">
      <div role="row" className={css.sampleRow}><span role="columnheader" className={css.head}>It sees</span><span role="columnheader" className={`${css.head} ${css.decideHead}`}>It decides</span></div>
      {(answered.length ? answered : data.rows).slice(0, 3).map((row, i) => <div key={i} role="row" className={css.sampleRow}>
        <span role="cell" className={css.sees}>{data.kind === 'images' ? <><i className={css.thumb} style={{ background: data.swatches?.[data.rows.indexOf(row)] }} />{row.photo}</> : reads.map(c => <span key={c}>{row[c]}</span>)}</span>
        <span role="cell" className={css.decides}>{chosen.map(c => <span key={c} className={css.tag} style={lane(row[c] ?? '', answers[c])}><i aria-hidden="true" />{row[c]}</span>)}</span>
      </div>)}
    </div>
    <p className={css.small}>{examples(answered.length)}{answered.length < data.rows.length ? ` of ${fmt(data.rows.length)}` : ''} from {shown(data.name)}{answered.length < data.rows.length ? ' have an answer; the rest are left out' : ''}. Reads {looks}. Decides {listed(kinds.map(([c, q]) => kindText(c, q)))}.{chosen.length > 1 ? ' Each decision is checked on its own.' : ''}{answered.length < 50 ? ' That’s a small set: a few hundred examples usually make a model you can rely on.' : ''}</p>
  </>;
}

function Training({ tier, data, roles }: { tier: Tier; data: Dataset; roles: Roles }) {
  return <>
    <p className={css.lead}>Training started{tier === 'open' ? ' on the open tier, free' : ', privately on Zils workers'}. I’ll test it on examples it never saw and tell you how often it gets {listed(decidedIn(roles).map(named))} right, usually within the hour.</p>
    <ol className={css.steps}><li data-state="done">Examples checked: {examples(data.rows.filter(r => decidedIn(roles).every(c => (r[c] ?? '').trim())).length)}</li><li data-state="now">Training</li><li>Testing on held-out examples</li><li>Ready to use</li></ol>
    <p className={css.small}>Prototype: nothing was uploaded or trained.</p>
  </>;
}

/** One example at a time, with a button per answer (number keys work too), Skip, and progress toward a useful set. */
function Labeler({ data, reads, answers, index, done, onAnswer }: { data: Dataset; reads: string[]; answers: string[]; index: number | undefined; done: number; onAnswer: (value: string | null) => void }) {
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      // Keys answer unless the visitor is typing: an empty message box (where the cursor is after typing the answers) still counts.
      const typing = (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) && e.target.value !== '';
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= answers.length) { e.preventDefault(); onAnswer(answers[n - 1]); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); onAnswer(null); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [answers, onAnswer]);
  if (index === undefined) return null;
  const row = data.rows[index];
  return <div className={css.labeler}>
    <div className={css.progress} aria-hidden="true"><span style={{ width: `${Math.min(100, (done / MIN_LABELS) * 100)}%` }} /></div>
    <p className={css.small}>{done} answered. Aim for at least {MIN_LABELS}; example {fmt(index + 1)} of {fmt(data.rows.length)}.</p>
    <div className={css.card} aria-live="polite">
      {data.kind === 'images' ? <div className={css.photoCard}><i style={{ background: data.swatches?.[index] }} /><span>{row.photo}</span></div>
        : <dl>{reads.map(c => <div key={c}><dt>{named(c)}</dt><dd>{row[c]}</dd></div>)}</dl>}
    </div>
    <div className={css.choices}>
      {answers.map((a, i) => <button key={a} className={css.choice} style={lane(a, answers)} onClick={() => onAnswer(a)}><kbd>{i + 1}</kbd><i aria-hidden="true" />{a}</button>)}
      <button className={css.skip} onClick={() => onAnswer(null)}>Skip</button>
    </div>
  </div>;
}
