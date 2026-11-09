'use client';

import { useMemo, useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { readSpreadsheet, type SpreadsheetSheet } from '@/lib/training-spreadsheet';
import { prepareTraining, type CsvData } from '@/lib/training-csv';
import { leaks } from '@/lib/training-review';
import { answerLabel, guessColumns, readiness, type Columns } from '@/lib/train-table';
import { TeachingSubmission } from '@/components/teaching-submission';
import type { TrainingConfig } from '@/lib/training-config';
import css from './train-table.module.css';

const SHOWN = 6;
const fmt = (n: number) => n.toLocaleString();
const examples = (n: number) => `${fmt(n)} ${n === 1 ? 'example' : 'examples'}`;
const list = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
type Role = 'reads' | 'decides' | 'group' | 'unused';

/** Animate a column crossing the line, where the browser can and the visitor allows motion. */
function moving(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  doc.startViewTransition(() => flushSync(update));
}

/** One screen: the customer's own rows, split by a line. Left is what the model reads; right is the one column it decides. */
export function TrainTable({ config }: { config: TrainingConfig | null }) {
  const [file, setFile] = useState('');
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [data, setData] = useState<CsvData | null>(null);
  const [columns, setColumns] = useState<Columns>({ decide: '', group: '', reads: [], unused: [] });
  const [menu, setMenu] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState<'edit' | 'review'>('edit');
  const [question, setQuestion] = useState('');
  const [locked, setLocked] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const ready = useMemo(() => data ? readiness(data, columns) : null, [data, columns]);
  const giveaways = useMemo(() => new Set(data && columns.decide ? leaks(data, columns.decide, columns.reads).map(l => l.column) : []), [data, columns]);

  function show(next: CsvData | undefined) {
    setData(next ?? null); setMenu(null); setStage('edit');
    if (next) setColumns(guessColumns(next));
  }
  async function read(picked: File[]) {
    setError('');
    const chosen = picked[0];
    if (!chosen) return;
    if (picked.every(f => f.type.startsWith('image/'))) { setError('Photos train through the photo setup for now. Use “Train on photos” below.'); return; }
    if (/\.pdf$/i.test(chosen.name)) { setError('PDFs come later. For now, put each document’s text in a spreadsheet column and drop the spreadsheet.'); return; }
    setWorking(true);
    try {
      const found = await readSpreadsheet(chosen);
      setFile(chosen.name); setSheets(found);
      const first = found.find(sheet => sheet.data);
      if (!first) throw new Error(found[0]?.error || 'No sheet in this file has examples.');
      show(first.data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'That file could not be read.'); }
    finally { setWorking(false); if (picker.current) picker.current.value = ''; }
  }
  async function example() {
    setError(''); setWorking(true);
    try {
      const response = await fetch('/training/support-routing-example.csv');
      if (!response.ok) throw new Error('The example could not be loaded.');
      await read([new File([await response.text()], 'support-routing-example.csv', { type: 'text/csv' })]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The example could not be loaded.'); }
    finally { setWorking(false); }
  }
  function drop(event: DragEvent) { event.preventDefault(); setOver(false); if (!locked) void read([...event.dataTransfer.files]); }
  function assign(column: string, role: Role) {
    setMenu(null);
    moving(() => setColumns(c => {
      const without = { decide: c.decide === column ? '' : c.decide, group: c.group === column ? '' : c.group, reads: c.reads.filter(x => x !== column), unused: c.unused.filter(x => x !== column) };
      if (role === 'reads') return { ...without, reads: [...without.reads, column] };
      if (role === 'unused') return { ...without, unused: [...without.unused, column] };
      if (role === 'group') return { ...without, group: column, reads: c.group ? [...without.reads, c.group] : without.reads };
      // One decision per run for now: the column it decided before goes back to the left.
      return { ...without, decide: column, reads: c.decide && c.decide !== column ? [...without.reads, c.decide] : without.reads };
    }));
  }
  function train() {
    if (!ready || ready.problem) return;
    setQuestion(q => q || (ready.answer.type === 'yesno' ? `${columns.decide}: yes or no?` : `Which ${columns.decide}?`));
    setStage('review');
  }

  const roleOf = (c: string): Role => c === columns.decide ? 'decides' : c === columns.group ? 'group' : columns.reads.includes(c) ? 'reads' : 'unused';
  const value = (row: string[], c: string) => row[data!.headers.indexOf(c)] ?? '';
  const header = (c: string) => {
    const role = roleOf(c);
    return <th key={c} scope="col" className={role === 'decides' ? css.decideHead : css.seeHead} style={{ viewTransitionName: `head-${slug(c) || 'col'}` }}>
      <button className={css.colButton} aria-haspopup="menu" aria-expanded={menu === c} disabled={locked} onClick={() => setMenu(m => m === c ? null : c)}>
        <span className={css.colName}>{c}</span>
        {role === 'decides' && ready && <span className={css.colRole}>{answerLabel(ready.answer)}</span>}
      </button>
      {role === 'reads' && giveaways.has(c) && <span className={css.leak}>Gives away the answer</span>}
      {menu === c && <div role="menu" className={css.menu}>
        {role !== 'reads' && <button role="menuitem" onClick={() => assign(c, 'reads')}>It reads this</button>}
        {role !== 'decides' && <button role="menuitem" onClick={() => assign(c, 'decides')}>It decides this</button>}
        {role !== 'group' && <button role="menuitem" onClick={() => assign(c, 'group')}>Rows with the same {c} belong together</button>}
        {role !== 'unused' && <button role="menuitem" onClick={() => assign(c, 'unused')}>Don’t use it</button>}
      </div>}
    </th>;
  };
  const used = ready ? ready.report.included : 0;

  return <main className={css.page}>
    <h1 className={css.title}>Train a model</h1>
    <p className={css.lede}>Drop your examples, then put what it should decide on the right of the line.</p>

    <section className={css.sheet} data-over={over} data-empty={!data} onDragOver={e => { e.preventDefault(); if (!locked) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop} aria-label="Your examples" aria-busy={working}>
      {!data ? <div className={css.drop}>
        <Upload size={24} aria-hidden="true" />
        <p className={css.dropTitle}>Drop your examples here</p>
        <p className={css.dropText}>A spreadsheet (CSV or Excel), JSON or JSON Lines: one example per row, with the right answer in one column.</p>
        <div className={css.dropActions}><button className={css.secondary} disabled={working} onClick={() => picker.current?.click()}>Choose a file</button></div>
        <input ref={picker} type="file" hidden accept=".csv,.xlsx,.json,.jsonl,.ndjson" aria-label="Choose a file of examples" onChange={e => void read([...(e.target.files ?? [])])} />
        <p className={css.tryLine}>Or start from an example: <button className={css.inline} disabled={working} onClick={() => void example()}>Support tickets</button></p>
      </div> : <>
        <div className={css.sheetTop}>
          <span className={css.fileName}>{file}</span>
          {sheets.length > 1 && <select className={css.sheetPick} aria-label="Sheet" disabled={locked} onChange={e => show(sheets[Number(e.target.value)]?.data)}>{sheets.map((sheet, i) => <option key={sheet.name} value={i} disabled={!sheet.data}>{sheet.name}</option>)}</select>}
          <span className={css.count}>{examples(data.rows.length)}</span>
          {!locked && <button className={css.inline} onClick={() => { setData(null); setFile(''); setSheets([]); setStage('edit'); }}>Use other examples</button>}
        </div>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr className={css.sides}><th colSpan={Math.max(1, columns.reads.length)} scope="colgroup">It reads</th><th aria-hidden="true" className={css.seam} /><th scope="colgroup" className={css.decideHead}>It decides</th></tr>
              <tr>{columns.reads.length ? columns.reads.map(header) : <th />}<th aria-hidden="true" className={css.seam} />{columns.decide ? header(columns.decide) : <th className={css.decideHead}><span className={css.colRole}>Choose a column</span></th>}</tr>
            </thead>
            <tbody>{data.rows.slice(0, SHOWN).map((row, i) => <tr key={i}>
              {columns.reads.length ? columns.reads.map(c => <td key={c} className={css.seeCell} style={{ viewTransitionName: `c${i}-${slug(c) || 'col'}` }}><span className={css.clamp}>{value(row, c)}</span></td>) : <td />}
              <td aria-hidden="true" className={css.seam} />
              <td className={css.decideCell} style={columns.decide ? { viewTransitionName: `c${i}-${slug(columns.decide) || 'col'}` } : undefined}>{columns.decide ? value(row, columns.decide) : ''}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {data.rows.length > SHOWN && <p className={css.more}>{fmt(data.rows.length - SHOWN)} more {data.rows.length - SHOWN === 1 ? 'example' : 'examples'}</p>}
        <p className={css.unused}>{columns.group ? <>Rows with the same <button className={css.inline} disabled={locked} onClick={() => setMenu(m => m === columns.group ? null : columns.group)}>{columns.group}</button> stay together when testing.</> : 'Each row is a separate case.'}</p>
        {menu === columns.group && columns.group && <div role="menu" className={css.menu} style={{ margin: '8px 20px 0' }}><button role="menuitem" onClick={() => assign(columns.group, 'reads')}>It reads this</button><button role="menuitem" onClick={() => assign(columns.group, 'unused')}>Don’t use it</button></div>}
        {columns.unused.length > 0 && <p className={css.unused}>Not used: {columns.unused.map(c => <button key={c} className={css.inline} disabled={locked} onClick={() => assign(c, 'reads')}>{c}</button>)}</p>}
        <p className={css.hint}>Click a column’s name to move it across the line, keep related rows together, or leave it out.</p>
      </>}
      {error && <p role="alert" className={css.error}>{error}</p>}
    </section>

    {!data && <p className={css.elsewhere}><Link href="/train/teach">No examples yet? Teach it by example</Link><Link href="/train/teach">Train on photos</Link><Link href="/train#train-with-your-agent">Decisions made in your code? Train with your coding agent</Link></p>}

    {data && ready && stage === 'edit' && <div className={css.bar}>
      <p className={css.summary} aria-live="polite">{ready.problem || <>Learns {columns.decide} ({answerLabel(ready.answer)}) from {list(columns.reads)}, using {examples(used)}.{ready.left > 0 && <> {fmt(ready.left)} left out: repeated, conflicting or empty.</>}</>}</p>
      <button className={css.primary} disabled={Boolean(ready.problem)} onClick={train}>Train</button>
    </div>}

    {data && ready && stage === 'review' && <section className={css.review} aria-label="Before training">
      <h2>Train on {examples(used)}?</h2>
      <p>It learns {columns.decide} ({answerLabel(ready.answer)}: {list(ready.outcomes.map(o => `“${o}”`))}) from {list(columns.reads)}.{ready.left > 0 && ` ${examples(ready.left)} are left out because they repeat, conflict or are empty.`}</p>
      {used < 50 && <p>That’s a small set. A few hundred examples usually make a model you can rely on.</p>}
      <label className={css.question}><span>The question it answers, shown to the model with each example</span><textarea rows={2} maxLength={1000} value={question} disabled={locked} onChange={e => setQuestion(e.target.value)} /></label>
      {!locked && <div className={css.reviewActions}><button className={css.secondary} onClick={() => setStage('edit')}>Back</button></div>}
      <TeachingSubmission config={config} onLock={setLocked} initialName={slug(`${file.replace(/\.[a-z]+$/i, '')}-${columns.decide}`).slice(0, 64)} prepare={async name => {
        if (!question.trim()) throw new Error('Write the question it answers.');
        const prepared = await prepareTraining(ready.report.data, ready.mapping, { name, question: question.trim(), outcomes: ready.outcomes }, ready.independent);
        return { kind: 'text', files: prepared.files };
      }} />
    </section>}
  </main>;
}
