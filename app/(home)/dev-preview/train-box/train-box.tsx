'use client';

import { useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import { Upload } from 'lucide-react';
import css from './train-box.module.css';
import { EXAMPLES, SHOWN, examples, fmt, guessRoles, infer, kindOf, list, readFiles, slug, type Dataset, type Role } from './data';

// Prototype only: files are read in this tab and never uploaded; Train does not start a run.

/** Animate a column crossing the line, where the browser can and the visitor allows motion. */
function moving(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  doc.startViewTransition(() => flushSync(update));
}

export function TrainBox() {
  const [data, setData] = useState<Dataset | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tier, setTier] = useState<'open' | 'private' | null>(null);
  const [target, setTarget] = useState(80);
  const [stage, setStage] = useState<'edit' | 'review' | 'done'>('edit');
  const files = useRef<HTMLInputElement>(null), folder = useRef<HTMLInputElement>(null);

  function load(next: Dataset) {
    setData(next); setRoles(guessRoles(next)); setEdits({}); setMenu(null); setError(''); setStage('edit');
  }

  async function read(picked: File[]) {
    setError('');
    if (!picked.length) return;
    try { load(await readFiles(picked)); } catch (failure) { setError(failure instanceof Error ? failure.message : 'That file could not be read.'); }
  }

  function drop(event: DragEvent) { event.preventDefault(); setOver(false); void read([...event.dataTransfer.files]); }
  function assign(column: string, role: Role) { setMenu(null); moving(() => setRoles(r => ({ ...r, [column]: role }))); }
  function addAnswerColumn() {
    if (!data) return;
    const name = `answer ${data.columns.filter(c => c.startsWith('answer')).length + 1}`;
    moving(() => { setData({ ...data, columns: [...data.columns, name] }); setRoles(r => ({ ...r, [name]: 'decides' })); });
  }

  const value = (row: number, column: string) => edits[`${row}:${column}`] ?? data?.rows[row]?.[column] ?? '';
  const columns = data?.columns ?? [];
  const reads = columns.filter(c => roles[c] === 'reads');
  const decides = columns.filter(c => roles[c] === 'decides');
  const unused = columns.filter(c => roles[c] === 'unused');
  const inferred = Object.fromEntries(decides.map(c => [c, infer((data?.rows ?? []).map((_, i) => value(i, c)))]));
  const editable = data?.kind !== 'table';
  const missing = data ? data.rows.filter((_, i) => decides.some(c => !value(i, c).trim())).length : 0;
  const problem = !data ? '' : !decides.length ? 'Move a column to the right of the line: that is what it decides.'
    : !reads.length ? 'Keep at least one column on the left: that is what it sees.'
    : decides.map(c => [c, inferred[c]] as const).map(([c, q]) => q.type === 'toomany' ? `${c} has ${fmt(q.count)} different values, too many to choose between. Move it back to the left.` : q.type === 'single' ? `Every answer in ${c} is “${q.answer}”. A decision needs at least two different answers.` : q.type === 'missing' ? `Type an answer for some ${data.kind === 'images' ? 'photos' : 'documents'} in ${c}, so it knows what to decide.` : '').find(Boolean) ?? '';
  const ready = Boolean(data && !problem);

  const header = (c: string) => <th key={c} scope="col" className={roles[c] === 'decides' ? css.decideHead : css.seeHead} style={{ viewTransitionName: `head-${slug(c)}` }}>
    <button className={css.colButton} aria-haspopup="menu" aria-expanded={menu === c} onClick={() => setMenu(m => m === c ? null : c)}>
      <span className={css.colName}>{c}</span>
      {roles[c] === 'decides' && <span className={css.colRole}>{kindOf(inferred[c])}</span>}
    </button>
    {menu === c && <div role="menu" className={css.menu}>
      {roles[c] !== 'reads' && <button role="menuitem" onClick={() => assign(c, 'reads')}>It sees this</button>}
      {roles[c] !== 'decides' && <button role="menuitem" onClick={() => assign(c, 'decides')}>It decides this</button>}
      {roles[c] !== 'unused' && <button role="menuitem" onClick={() => assign(c, 'unused')}>Don’t use it</button>}
    </div>}
  </th>;

  const cell = (row: number, c: string) => {
    const decide = roles[c] === 'decides', text = value(row, c);
    const content = data?.kind === 'images' && c === 'photo' ? <span className={css.photo}><i style={{ background: data.swatches?.[row] }} />{text}</span>
      : decide && editable ? <input className={css.answerInput} value={text} placeholder="type answer" aria-label={`${c} for row ${row + 1}`} onChange={e => setEdits(x => ({ ...x, [`${row}:${c}`]: e.target.value }))} />
      : decide ? text : <span className={css.clamp}>{text}</span>;
    return <td key={c} className={decide ? css.decideCell : css.seeCell} style={{ viewTransitionName: `c${row}-${slug(c)}` }}>{content}</td>;
  };

  return <main className={css.page}>
    <p className={css.note}>Prototype: what you drop here stays in this tab.</p>
    <h1 className={css.title}>Train a model</h1>
    <p className={css.lede}>Drop your examples, then put what it should decide on the right of the line.</p>

    <section className={css.sheet} data-over={over} data-empty={!data} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop} aria-label="Your examples">
      {!data ? <div className={css.drop}>
        <Upload size={24} aria-hidden="true" />
        <p className={css.dropTitle}>Drop your examples here</p>
        <p className={css.dropText}>A spreadsheet, a folder of photos, PDFs or JSONL: one example per row, photo or file.</p>
        <div className={css.dropActions}>
          <button className={css.secondary} onClick={() => files.current?.click()}>Choose files</button>
          <button className={css.secondary} onClick={() => folder.current?.click()}>Choose a folder</button>
        </div>
        <input ref={files} type="file" multiple hidden onChange={e => void read([...(e.target.files ?? [])])} />
        <input ref={folder} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={e => void read([...(e.target.files ?? [])])} />
        <p className={css.tryLine}>Or start from an example: {Object.keys(EXAMPLES).map(name => <button key={name} className={css.inline} onClick={() => load(EXAMPLES[name])}>{name}</button>)}</p>
      </div> : <>
        <div className={css.sheetTop}>
          <span className={css.fileName}>{data.name}</span>
          <span className={css.count}>{examples(data.rows.length)}</span>
          <button className={css.inline} onClick={() => { setData(null); setStage('edit'); }}>Use other examples</button>
        </div>
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead><tr className={css.sides}><th colSpan={reads.length} scope="colgroup">It sees</th><th aria-hidden="true" className={css.seam} /><th colSpan={decides.length + (editable ? 1 : 0)} scope="colgroup" className={css.decideHead}>It decides</th></tr>
              <tr>{reads.map(header)}<th aria-hidden="true" className={css.seam} />{decides.map(header)}{editable && <th className={css.addCol}><button className={css.inline} onClick={addAnswerColumn}>Add a decision</button></th>}</tr></thead>
            <tbody>{data.rows.slice(0, SHOWN).map((_, i) => <tr key={i}>{reads.map(c => cell(i, c))}<td aria-hidden="true" className={css.seam} />{decides.map(c => cell(i, c))}{editable && <td />}</tr>)}</tbody>
          </table>
        </div>
        {data.rows.length > SHOWN && <p className={css.more}>{fmt(data.rows.length - SHOWN)} more {data.rows.length - SHOWN === 1 ? 'example' : 'examples'}</p>}
        {unused.length > 0 && <p className={css.unused}>Not used: {unused.map(c => <button key={c} className={css.inline} onClick={() => assign(c, 'reads')}>{c}</button>)}</p>}
        {data.kind === 'table' && <p className={css.hint}>Click a column’s name to move it across the line or leave it out.</p>}
      </>}
      {error && <p role="alert" className={css.error}>{error}</p>}
    </section>

    {data && stage === 'edit' && <div className={css.bar}>
      <p className={css.summary} aria-live="polite">{problem || <>Learns {list(decides)} from {data.kind === 'table' ? list(reads) : data.kind === 'images' ? 'each photo' : 'each document'}, using {examples(data.rows.length - missing)}.</>}</p>
      <button className={css.secondary} aria-expanded={settings} onClick={() => setSettings(s => !s)}>Settings</button>
      <button className={css.primary} disabled={!ready} onClick={() => setStage('review')}>Train</button>
    </div>}

    {settings && stage === 'edit' && <section className={css.settings} aria-label="Settings">
      <fieldset><legend>Who trains it</legend>
        <label><input type="radio" name="tier" checked={tier === 'open'} onChange={() => setTier('open')} /><span><strong>Open tier, free.</strong> Zils network miners train it and must delete your examples within 7 days of the run finishing.</span></label>
        <label><input type="radio" name="tier" checked={tier === 'private'} onChange={() => setTier('private')} /><span><strong>Private, $0.20 per million training tokens.</strong> Only Zils workers train it.</span></label>
      </fieldset>
      <label className={css.range}><span>Keep the model only if it is right at least <strong>{target}%</strong> of the time{decides.length > 1 ? ' on every decision' : ''}.</span>
        <input type="range" min={50} max={99} value={target} onChange={e => setTarget(Number(e.target.value))} /></label>
      <p className={css.hint}>Model: z3-mini, which reads up to 8,192 tokens per example.</p>
    </section>}

    {stage === 'review' && data && <section className={css.review} aria-label="Before training">
      <h2>Train on {examples(data.rows.length - missing)}?</h2>
      <p>One model learns {decides.length > 1 ? `${decides.length} decisions: ` : ''}{decides.map(c => `${c} (${kindOf(inferred[c])})`).join(', ')}. {decides.length > 1 && 'Your app asks whichever one it needs.'}</p>
      {missing > 0 && <p>{fmt(missing)} {missing === 1 ? 'example has' : 'examples have'} a blank answer and will be left out.</p>}
      {data.rows.length < 50 && <p>That’s a small set. A few hundred examples usually make a model you can rely on.</p>}
      {!tier && <p className={css.warn}>Choose who trains it first. <button className={css.inline} onClick={() => { setStage('edit'); setSettings(true); }}>Open settings</button></p>}
      <div className={css.reviewActions}><button className={css.secondary} onClick={() => setStage('edit')}>Back</button><button className={css.primary} disabled={!tier} onClick={() => setStage('done')}>Start training</button></div>
    </section>}

    {stage === 'done' && <section className={css.review} role="status"><h2>Training started.</h2><p>In the real page this uploads the examples and starts a {tier === 'open' ? 'free open-tier' : 'private'} run. This prototype sent nothing.</p>
      <div className={css.reviewActions}><button className={css.secondary} onClick={() => { setData(null); setStage('edit'); }}>Start over</button></div></section>}
  </main>;
}
