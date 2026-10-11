'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, FileSpreadsheet, FileText, FolderInput, HelpCircle, Layers3, LockKeyhole, MessageSquareText, Plus, Sparkles, TriangleAlert, Upload, X } from 'lucide-react';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { TeachingDocuments } from '@/components/teaching-documents';
import { PreparedTrainingPreview } from '@/components/prepared-training-preview';
import { ThemeToggle } from '@/components/theme';
import { readSpreadsheet, type SpreadsheetSheet } from '@/lib/training-spreadsheet';
import { suggestMapping } from '@/lib/training-review';
import type { ColumnMapping } from '@/lib/training-csv';
import { importTeachingExamples, inspectTeachingExamples, prepareTeachingDraft, type TeachingExample, type TeachingTask } from '@/lib/teach-by-example';
import s from './teach-by-example.module.css';

const steps = ['Describe the task', 'Bring examples', 'Show what’s good', 'Check the gaps', 'Preview the test'];
const starters = {
  sort: { title: 'Sort or make a decision', description: 'Route a request. Choose a category.', icon: Layers3, goal: 'Send each customer request to the right team.', input: 'Could you send me the invoice for last month?', output: 'Billing', labels: ['Billing', 'Technical support', 'Account changes'], rule: 'Use Billing for payments, Technical support for product issues, and Account changes for profile updates.' },
  write: { title: 'Write in your style', description: 'Draft a reply. Rewrite something.', icon: MessageSquareText, goal: 'Write helpful, concise replies to customer requests.', input: 'My order arrived with a broken handle. What can I do?\nPolicy: replace damaged items free of charge after receiving a photo.', output: 'Please send us a photo of the damaged handle and your order number. We’ll arrange a free replacement.', labels: [], rule: 'Use a warm, direct tone. Follow the supplied policy. Never invent order details.' },
  extract: { title: 'Pull out information', description: 'Turn text into a few useful fields.', icon: FileText, goal: 'Extract the invoice number, total, and currency from invoice text.', input: 'Invoice INV-1042\nAlder Supply Lab\nSubtotal: USD 390.00\nTax: USD 30.00\nTotal due: USD 420.00', output: 'Invoice number: INV-1042\nTotal: 420.00\nCurrency: USD', labels: [], rule: 'Use the total including tax. Write “Not provided” for a field that is not present.' },
} satisfies Record<TeachingTask['kind'], { title: string; description: string; icon: typeof Layers3; goal: string; input: string; output: string; labels: string[]; rule: string }>;

const samplePairs: Record<TeachingTask['kind'], [string, string][]> = {
  sort: [
    [starters.sort.input, 'Billing'], ['I was charged twice for my subscription.', 'Billing'], ['Where can I update my payment card?', 'Billing'],
    ['The app crashes whenever I open a file.', 'Technical support'], ['My upload has been stuck for an hour.', 'Technical support'], ['The latest update will not install.', 'Technical support'],
    ['Please change the email address on my profile.', 'Account changes'], ['I want to update my display name.', 'Account changes'], ['How do I close my account?', 'Account changes'],
  ],
  write: [
    [starters.write.input, starters.write.output],
    ['Can I return this unopened item? I bought it 10 days ago.\nPolicy: unopened items can be returned within 30 days. Ask for the order number.', 'Yes, unopened items can be returned within 30 days. Send us your order number and we’ll help you start the return.'],
    ['Do you deliver outside the US?\nPolicy: delivery is available only in the United States.', 'We currently deliver within the United States. We don’t offer international delivery yet.'],
  ],
  extract: [
    [starters.extract.input, starters.extract.output],
    ['Invoice INV-2050\nTotal including tax: EUR 185.50', 'Invoice number: INV-2050\nTotal: 185.50\nCurrency: EUR'],
    ['Invoice\nTotal due: USD 90.00\nNo invoice number supplied.', 'Invoice number: Not provided\nTotal: 90.00\nCurrency: USD'],
  ],
};

export function TeachByExample() {
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<'guided' | 'prepared'>('guided');
  const [task, setTask] = useState<TeachingTask>({ kind: 'sort', goal: '', rules: '', answers: [] });
  const [answerText, setAnswerText] = useState('');
  const [examples, setExamples] = useState<TeachingExample[]>([]);
  const [mode, setMode] = useState<'paste' | 'file' | 'documents'>('paste');
  const [input, setInput] = useState(''), [output, setOutput] = useState(''), [group, setGroup] = useState('');
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]), [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({ inputs: [], answer: '', group: '' });
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [independent, setIndependent] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ReturnType<typeof prepareTeachingDraft> | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0), [showDemo, setShowDemo] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const exampleList = useRef<HTMLDivElement>(null);
  const starter = starters[task.kind];
  const report = useMemo(() => inspectTeachingExamples(task, examples, independent), [task, examples, independent]);
  const active = examples.find(example => example.id === activeId) || examples[0];
  const currentSheet = sheets[sheetIndex];
  const reviewed = report.reviewed;
  useEffect(() => {
    exampleList.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, step]);

  function go(next: number) {
    setStep(next); setError(''); setNotice('');
    requestAnimationFrame(() => { heading.current?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  }
  function changeTask(next: TeachingTask) {
    setTask(next); setDraft(null); setNotice('');
    setExamples(rows => rows.map(row => ({ ...row, reviewed: false })));
  }
  function selectStarter(kind: TeachingTask['kind']) {
    const next = starters[kind];
    changeTask({ kind, goal: next.goal, rules: next.rule, answers: [...next.labels] });
    setAnswerText(next.labels.join('\n'));
  }
  function useSamples() {
    if (examples.length + samplePairs[task.kind].length > 500) { setError('Keep this preview to 500 examples.'); return; }
    const rows = samplePairs[task.kind].map(([sampleInput, sampleOutput]) => ({ id: crypto.randomUUID(), input: sampleInput, output: sampleOutput, group: '', reviewed: false, excluded: false, source: 'Sample example' }));
    setExamples(previous => [...previous, ...rows]); setActiveId(rows[0].id); setDraft(null);
    if (!task.goal.trim()) { selectStarter(task.kind); }
    if (!examples.length) setIndependent(true);
    setNotice(`${rows.length} sample examples added. You’ll review their answers next.`);
    if (step === 0) go(1);
  }
  function addExample(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) { setError('Paste the information the model should receive.'); return; }
    if (examples.length >= 500) { setError('Keep this preview to 500 examples.'); return; }
    const row = { id: crypto.randomUUID(), input: input.trim(), output: output.trim(), group: group.trim(), reviewed: false, excluded: false, source: 'Pasted example' };
    setExamples(previous => [...previous, row]); setActiveId(row.id); setInput(''); setOutput(''); setGroup(''); setDraft(null); setError('');
    setNotice(`Example ${examples.length + 1} added${row.output ? '. You can review it next.' : '. You can add its answer during review.'}`);
  }
  function updateExample(id: string, patch: Partial<TeachingExample>) {
    setExamples(rows => rows.map(row => row.id === id ? { ...row, ...patch, ...(('input' in patch || 'output' in patch || 'group' in patch) ? { reviewed: false } : {}) } : row));
    setDraft(null); setError(''); setNotice('');
  }
  function chooseSheet(index: number, available = sheets) {
    setSheetIndex(index);
    const sheet = available[index];
    setError(sheet?.error || '');
    if (sheet?.data) {
      const suggested = suggestMapping(sheet.data);
      const outputField = suggested.answer || sheet.data.headers.find(header => /^(output|response|reply|completion|expected_output)$/i.test(header)) || '';
      setMapping({ ...suggested, answer: outputField, inputs: suggested.inputs.filter(header => header !== outputField) });
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setSheets([]);
    try {
      const available = await readSpreadsheet(file);
      setSheets(available); setFileName(file.name);
      chooseSheet(Math.max(0, available.findIndex(sheet => sheet.data)), available);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read this file. Choose CSV, Excel, JSON, or JSONL.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  function importFile() {
    if (!currentSheet?.data) return;
    try {
      const rows = importTeachingExamples(currentSheet.data, mapping, `${fileName} / ${currentSheet.name}`);
      if (examples.length + rows.length > 500) throw new Error('This local preview supports 500 examples in total. Choose a smaller sample.');
      setExamples(previous => [...previous, ...rows]); setActiveId(rows[0].id); setDraft(null); setIndependent(false); setSheets([]); setError('');
      if (task.kind === 'sort' && !task.answers.length) {
        const answers = [...new Set(rows.map(row => row.output.trim()).filter(Boolean))];
        if (answers.length <= 16) { setTask(current => ({ ...current, answers })); setAnswerText(answers.join('\n')); }
      }
      setNotice(`${rows.length} examples imported. Their answers still need your review.`);
    } catch (error) { setError((error as Error).message); }
  }
  function markReviewed() {
    if (!active) return;
    const check = inspectTeachingExamples(task, [{ ...active, reviewed: true }], true);
    if (check.issues.length) { setError(check.issues[0].message); return; }
    updateExample(active.id, { reviewed: true });
    const next = examples.find(row => row.id !== active.id && !row.excluded && !row.reviewed);
    if (next) setActiveId(next.id);
    setNotice(next ? 'Answer reviewed. Here’s the next example.' : 'Every included answer has been reviewed.');
  }
  function prepare() {
    try { setDraft(prepareTeachingDraft(task, examples, independent)); setPreviewIndex(0); setShowDemo(false); go(4); }
    catch (error) { setError((error as Error).message); }
  }
  function downloadDraft() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'zils-teaching-draft.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Download requested. No training job has been submitted.');
  }
  const issueIds = new Set(report.issues.map(issue => issue.id));
  const testExample = draft?.splits.test[previewIndex];

  return <div className={s.page}>
    <header className={s.header}>
      <Link href="/" aria-label="Zils home"><ZilsWordmark className="text-[40px]" /></Link>
      <span className={s.headerTitle}>Teach a model</span>
      <div className={s.headerEnd}><span className={s.previewBadge}>Local preview</span><ThemeToggle /></div>
    </header>
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <Link href="/train" className={s.backLink}><ArrowLeft size={14} /> Training home</Link>
        <nav aria-label="Teaching progress" hidden={path !== 'guided'}><ol>{steps.map((title, index) => <li key={title} data-active={step === index} data-done={step > index}>
          <button type="button" aria-label={title} aria-current={step === index ? 'step' : undefined} disabled={index > step} onClick={() => go(index)}><span className={s.stepNumber}>{step > index ? <Check size={13} /> : index + 1}</span><span>{title}</span></button>
        </li>)}</ol></nav>
        {path === 'prepared' && <div className={s.directNote}><FileText size={21} /><strong>Prepared training</strong><p>Your labels and dataset splits stay as supplied. Check the files, set your success criteria, and review the run.</p></div>}
        <div className={s.sidebarNote}><LockKeyhole size={17} /><p>Your examples stay in this tab.</p><span>No uploads or training charges. Download your draft before closing.</span></div>
      </aside>
      <main className={s.main} id="main-content">
        <div className={s.entryPaths} aria-label="Choose your starting point"><button type="button" aria-pressed={path === 'guided'} onClick={() => setPath('guided')}>Guide me</button><button type="button" aria-pressed={path === 'prepared'} onClick={() => setPath('prepared')}>I have training data</button></div>
        <div hidden={path !== 'prepared'}><PreparedTrainingPreview onGuided={() => { setPath('guided'); setMode('file'); go(0); }} /></div>
        <div hidden={path !== 'guided'}>
        <div className={s.progressLine}><span>Step {step + 1} of 5</span><span>{step === 0 ? 'Start with something you know' : `${examples.length} ${examples.length === 1 ? 'example' : 'examples'} added`}</span></div>
        <h1 ref={heading} tabIndex={-1}>{['What would you like to teach?', 'Start with work you already have.', 'Show Zils what a good answer is.', 'A few checks before you train.', 'Decide how you’ll measure success.'][step]}</h1>
        <p className={s.intro}>{[
          'Pick a task you do repeatedly. One clear job is a good place to start.',
          'Bring what you received and what a good result looked like. One example is enough to start.',
          'You know your work best. Check each answer, make corrections, and leave out examples you don’t want to use.',
          'Good examples cover different situations. These checks help you find what’s missing.',
          'Some examples teach the model. Others stay separate to check whether it learned something useful.',
        ][step]}</p>
        {error && <div className={s.error} role="alert"><TriangleAlert size={17} /><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
        <div aria-live="polite" className={notice ? s.notice : s.srOnly}>{notice}</div>

        {step === 0 && <form onSubmit={event => { event.preventDefault(); if (!task.goal.trim()) { setError('Describe one task you want to teach.'); return; } go(1); }}>
          <div className={s.taskChoices}>{(Object.keys(starters) as TeachingTask['kind'][]).map(kind => { const choice = starters[kind], Icon = choice.icon; return <button type="button" key={kind} className={s.taskChoice} aria-pressed={task.kind === kind} onClick={() => selectStarter(kind)}><Icon size={22} strokeWidth={1.5} /><strong>{choice.title}</strong><span>{choice.description}</span>{task.kind === kind && <Check className={s.choiceCheck} size={15} />}</button>; })}</div>
          <label htmlFor="teaching-goal">What should your model do?</label>
          <textarea id="teaching-goal" rows={2} required maxLength={1000} value={task.goal} onChange={event => changeTask({ ...task, goal: event.target.value })} placeholder={starter.goal} />
          <details className={s.details}><summary>Add rules or preferences <span>Optional</span></summary><label htmlFor="teaching-rules">What should a good answer follow?</label><textarea id="teaching-rules" rows={3} maxLength={3000} value={task.rules} placeholder={starter.rule} onChange={event => changeTask({ ...task, rules: event.target.value })} /></details>
          <div className={s.lessonPreview}><div className={s.lessonTitle}><Sparkles size={16} /><span>What one teaching example looks like</span></div><div className={s.lessonPair}><div><span>What comes in</span><p>{starter.input}</p></div><ChevronRight size={20} className={s.pairArrow} /><div><span>A good answer</span><p>{starter.output}</p></div></div></div>
          <button type="button" className={s.documentEntry} onClick={() => { if (!examples.length) selectStarter('extract'); setMode('documents'); go(1); }}><FileText size={19} /><span><strong>Is your information in documents?</strong><small>Read a PDF or Word file, review its fields, and use what you need.</small></span><ArrowRight size={17} /></button>
          <div className={s.actions}><button type="button" className={s.textButton} onClick={useSamples}>Try with sample examples</button><button className={s.primary}>Bring my first example <ArrowRight size={16} /></button></div>
        </form>}

        <div hidden={step !== 1}>
          <div className={s.tabs} role="tablist" aria-label="Add examples"><button type="button" role="tab" aria-selected={mode === 'paste'} aria-controls="example-entry" onClick={() => setMode('paste')}><Plus size={16} /> Paste an example</button><button type="button" role="tab" aria-selected={mode === 'file'} aria-controls="example-entry" onClick={() => setMode('file')}><FileSpreadsheet size={16} /> Import a file</button><button type="button" role="tab" aria-selected={mode === 'documents'} aria-controls="example-entry" onClick={() => setMode('documents')}><FileText size={16} /> Documents</button></div>
          <div id="example-entry" role="tabpanel" aria-label={mode === 'paste' ? 'Paste an example' : mode === 'file' ? 'Import a file' : 'Documents'}>
            <div hidden={mode !== 'paste'}><form onSubmit={addExample}>
              <div className={s.pairFields}><div><label htmlFor="example-input">What the model receives</label><textarea id="example-input" required rows={6} maxLength={16000} placeholder={starter.input} value={input} onChange={event => setInput(event.target.value)} /><p className={s.hint}>Include the context you had when doing this task.</p></div><div><label htmlFor="example-output">What a good answer looks like</label><textarea id="example-output" rows={6} maxLength={16000} placeholder={starter.output} value={output} onChange={event => setOutput(event.target.value)} /><p className={s.hint}>You can leave this blank and write the answer during review.</p></div></div>
              <details className={s.details}><summary>Is this part of a larger conversation or case?</summary><label htmlFor="example-group">Case reference</label><input id="example-group" value={group} maxLength={200} onChange={event => setGroup(event.target.value)} placeholder="e.g. ticket-1042" /><p className={s.hint}>Give related examples the same reference so they stay together during testing.</p></details>
              <button className={s.secondary}><Plus size={16} /> Add this example</button>
            </form></div>
            <div hidden={mode !== 'file'}>
              <div className={s.dropzone} data-dragging={dragging} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; if (event.dataTransfer.files.length !== 1) { setError('Choose one file at a time.'); return; } void readFile(event.dataTransfer.files[0]); }}>
                <Upload size={24} strokeWidth={1.5} /><strong>Drop a file with past examples</strong><p>CSV, Excel (.xlsx), JSON, or JSONL. Keep the input and answer in separate fields.</p><label className={s.secondary} htmlFor="teaching-file">Choose a file</label><input className={s.fileInput} id="teaching-file" ref={fileInput} type="file" disabled={busy} accept=".csv,.xlsx,.json,.jsonl,.ndjson,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,application/jsonl,application/x-ndjson" onChange={event => void readFile(event.target.files?.[0])} /><small>Up to 10 MiB · 500 examples in this preview</small>
              </div>
              <p className={s.hint}>JSON can contain a list of examples or one example. JSONL and NDJSON use one example per line. Nested objects and lists are kept as text for review.</p>
              {busy && <p role="status" className={s.hint}>Reading your file…</p>}
              {sheets.length > 1 && <><label htmlFor="teaching-sheet">Which sheet or list has your examples?</label><select id="teaching-sheet" value={sheetIndex} onChange={event => chooseSheet(Number(event.target.value))}>{sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}</select></>}
              {currentSheet?.data && <div className={s.mapping}><h2>Check how we read your file</h2><p>{fileName} · {currentSheet.data.rows.length} examples found</p><div className={s.pairFields}><fieldset><legend>Information the model receives</legend>{currentSheet.data.headers.map(header => <label className={s.checkLabel} key={header}><input type="checkbox" checked={mapping.inputs.includes(header)} disabled={header === mapping.answer || header === mapping.group} onChange={event => setMapping(current => ({ ...current, inputs: event.target.checked ? [...current.inputs, header] : current.inputs.filter(value => value !== header) }))} />{header}</label>)}</fieldset><div><label htmlFor="teaching-answer-column">The correct answer</label><select id="teaching-answer-column" value={mapping.answer} onChange={event => setMapping(current => ({ ...current, answer: event.target.value, inputs: current.inputs.filter(value => value !== event.target.value), group: current.group === event.target.value ? '' : current.group }))}><option value="">Choose a field</option>{currentSheet.data.headers.map(header => <option key={header}>{header}</option>)}</select><label htmlFor="teaching-group-column">Shared case reference <span className={s.optional}>Optional</span></label><select id="teaching-group-column" value={mapping.group} onChange={event => setMapping(current => ({ ...current, group: event.target.value, inputs: current.inputs.filter(value => value !== event.target.value) }))}><option value="">No reference field</option>{currentSheet.data.headers.filter(header => header !== mapping.answer).map(header => <option key={header}>{header}</option>)}</select></div></div><div className={s.importPreview}><span>First example</span><p>{mapping.inputs.map(header => `${header}: ${currentSheet.data!.rows[0][currentSheet.data!.headers.indexOf(header)]}`).join('\n') || 'Select the information fields.'}</p><strong>{mapping.answer ? currentSheet.data.rows[0][currentSheet.data.headers.indexOf(mapping.answer)] || 'Answer is blank — review needed' : 'Choose the answer field.'}</strong></div><button type="button" className={s.secondary} disabled={busy} onClick={importFile}>Add {currentSheet.data.rows.length} examples</button></div>}
            </div>
            <div hidden={mode !== 'documents'}><TeachingDocuments extractionTask={task.kind === 'extract'} onAdd={row => { if (examples.length >= 500) throw new Error('Keep this preview to 500 examples.'); setExamples(previous => [...previous, row]); setActiveId(row.id); setDraft(null); setIndependent(false); setError(''); }} /></div>
          </div>
          <div className={s.collection}><div><CheckCheck size={19} /><strong>{examples.length} {examples.length === 1 ? 'example' : 'examples'} collected</strong></div><button type="button" className={s.textButton} onClick={useSamples}>Add sample examples</button>{examples.length > 0 && <p>{examples.slice(-2).map(example => example.input.replace(/\n/g, ' ').slice(0, 65)).join(' / ')}{examples.length > 2 ? ' …' : ''}</p>}</div>
          <div className={s.actions}><button type="button" className={s.backButton} onClick={() => go(0)}><ArrowLeft size={15} /> Back</button><button type="button" className={s.primary} disabled={!examples.length || busy} onClick={() => { setActiveId(examples.find(row => !row.reviewed && !row.excluded)?.id || examples[0].id); go(2); }}>Review my examples <ArrowRight size={16} /></button></div>
        </div>

        {step === 2 && <>
          {task.kind === 'sort' && <details className={s.details} open={!task.answers.length}><summary>Possible answers <span>{task.answers.length ? task.answers.join(', ') : 'Add your categories'}</span></summary><label htmlFor="teaching-answers">One answer per line</label><textarea id="teaching-answers" rows={3} value={answerText} placeholder={'Billing\nTechnical support\nAccount changes'} onChange={event => { setAnswerText(event.target.value); changeTask({ ...task, answers: event.target.value.split('\n').map(answer => answer.trim()).filter(Boolean) }); }} /></details>}
          <div className={s.reviewProgress}><span><strong>{reviewed}</strong> of {report.included.length} included examples reviewed</span><progress value={reviewed} max={Math.max(1, report.included.length)} aria-label="Examples reviewed" /></div>
          <div className={s.reviewWorkspace}>
            <div ref={exampleList} className={s.exampleList} aria-label="Your examples">{examples.map((example, index) => <button type="button" key={example.id} aria-pressed={active?.id === example.id} data-excluded={example.excluded} onClick={() => { setActiveId(example.id); setError(''); }}><span className={s.exampleIndex}>{example.excluded ? <X size={13} /> : example.reviewed ? <Check size={13} /> : index + 1}</span><span><strong>Example {index + 1}</strong><small>{example.excluded ? 'Left out' : example.reviewed ? 'Reviewed' : 'Needs your review'}</small></span></button>)}</div>
            {active && <div className={s.reviewEditor}><div className={s.editorTop}><span>{active.source}</span><button type="button" className={s.textButton} onClick={() => updateExample(active.id, { excluded: !active.excluded, reviewed: false })}>{active.excluded ? 'Include again' : 'Leave out'}</button></div>
              <label htmlFor="review-input">What the model receives</label><textarea id="review-input" rows={4} maxLength={16000} value={active.input} disabled={active.excluded} onChange={event => updateExample(active.id, { input: event.target.value })} />
              <label htmlFor="review-output">The answer you want it to learn</label>{task.kind === 'sort' && task.answers.length > 0 ? <select id="review-output" value={active.output} disabled={active.excluded} onChange={event => updateExample(active.id, { output: event.target.value })}><option value="">Choose the correct answer</option>{!task.answers.includes(active.output) && active.output && <option value={active.output}>{active.output} — check this answer</option>}{task.answers.map(answer => <option key={answer}>{answer}</option>)}</select> : <textarea id="review-output" rows={4} maxLength={16000} value={active.output} disabled={active.excluded} onChange={event => updateExample(active.id, { output: event.target.value })} />}
              <details className={s.details}><summary>Case reference <span>{active.group.startsWith('document-') ? 'Source document' : active.group || 'Not set'}</span></summary><label htmlFor="review-group">Shared case reference</label><input id="review-group" value={active.group} maxLength={200} disabled={active.excluded} onChange={event => updateExample(active.id, { group: event.target.value })} /></details>
              <div className={s.editorFooter}><span>{active.excluded ? 'This example will not be used.' : active.reviewed ? 'Reviewed. Editing it will ask for review again.' : 'Check the answer against your own knowledge.'}</span><button type="button" className={s.primary} disabled={active.excluded || active.reviewed} onClick={markReviewed}><Check size={16} /> {active.reviewed ? 'Reviewed' : 'This answer is right'}</button></div>
            </div>}
          </div>
          <div className={s.actions}><button type="button" className={s.backButton} onClick={() => go(1)}><ArrowLeft size={15} /> Add more examples</button><button type="button" className={s.primary} onClick={() => go(3)}>Check for gaps <ArrowRight size={16} /></button></div>
        </>}

        {step === 3 && <>
          <div className={s.taskSummary}><span>Your task</span><p>{task.goal}</p>{task.rules && <small>{task.rules}</small>}</div>
          <fieldset className={s.caseChoice}><legend>Could any examples come from the same case?</legend><label className={s.checkLabel}><input type="radio" name="case-kind" checked={!independent} onChange={() => { setIndependent(false); setDraft(null); }} /><span>Yes. Keep examples with the same case reference together.</span></label><label className={s.checkLabel}><input type="radio" name="case-kind" checked={independent} onChange={() => { setIndependent(true); setDraft(null); }} /><span>I checked: every example is a separate case.</span></label><p className={s.hint}>Related conversations or documents must stay in one set. This keeps the final test fair.</p></fieldset>
          <div className={s.coverage}><h2>{task.kind === 'sort' ? 'Give every answer a fair chance.' : 'Build a useful starting set.'}</h2>{report.coverage.map(item => <div className={s.coverageRow} key={item.answer}><span>{item.answer}</span><div><span style={{ width: `${Math.min(100, item.groups / 3 * 100)}%` }} /></div><strong>{item.groups} {item.groups === 1 ? 'case' : 'cases'}</strong>{item.groups >= 3 ? <Check size={16} /> : <Plus size={16} />}</div>)}<p className={s.hint}>Three separate cases per answer allow this preview to make a split. That is a setup minimum, not evidence of enough data for a useful model.</p></div>
          {(report.issues.length > 0 || report.gaps.length > 0) ? <div className={s.gaps}><h2><TriangleAlert size={19} /> Here’s what to work on next</h2>{report.issues.length > 0 && <button type="button" className={s.gapAction} onClick={() => { setActiveId(report.issues[0].id); go(2); }}><span>Review {issueIds.size} {issueIds.size === 1 ? 'example' : 'examples'} needing attention<small>{report.issues[0].message}</small></span><ArrowRight size={17} /></button>}{report.gaps.map(gap => <button type="button" key={gap} className={s.gapAction} onClick={() => go(gap.startsWith('Choose') ? 2 : gap.startsWith('Describe') ? 0 : 1)}><span>{gap}</span><Plus size={17} /></button>)}</div> : <div className={s.ready}><CheckCheck size={21} /><div><strong>Your examples pass the basic checks.</strong><p>All included answers are reviewed, with no duplicate inputs. You can now inspect the proposed test.</p></div></div>}
          <div className={s.coachNote}><HelpCircle size={18} /><p>{task.kind === 'sort' ? 'Have you included unclear requests and unusual cases? Add the answer your team would choose when the usual categories don’t fit.' : task.kind === 'write' ? 'Include a request you would refuse, missing information, and a reply that needs a different tone. Good examples should show the limits too.' : 'Include documents with missing fields and different layouts. The correct answer should show when a value is unknown.'}</p></div>
          <div className={s.actions}><button type="button" className={s.backButton} onClick={() => go(2)}><ArrowLeft size={15} /> Review examples</button><button type="button" className={s.primary} disabled={Boolean(report.issues.length || report.gaps.length)} onClick={prepare}>Preview my test <ArrowRight size={16} /></button></div>
        </>}

        {step === 4 && draft && <>
          <div className={s.splitOverview}>{[{ key: 'train' as const, title: 'For learning', text: 'Examples the model can learn from.' }, { key: 'calibration' as const, title: 'For checking', text: 'Separate cases for confidence checks.' }, { key: 'test' as const, title: 'For the final test', text: 'Held aside to measure the result.' }].map(item => <div key={item.key}><strong>{draft.counts[item.key]}</strong><span>{item.title}</span><p>{item.text}</p></div>)}</div>
          <section className={s.testPreview}><div className={s.testTitle}><div><h2>One example the model won’t train on</h2><p>Use cases like this to compare the original and trained models.</p></div><span>{previewIndex + 1} / {draft.splits.test.length}</span></div>{testExample && <><div className={s.testInput}><span>What it will receive</span><p>{testExample.input}</p></div><div className={s.testExpected}><span>The answer you’ll compare against</span><p>{testExample.output}</p></div></>}{draft.splits.test.length > 1 && <button type="button" className={s.textButton} onClick={() => setPreviewIndex(index => (index + 1) % draft.splits.test.length)}>See another test example <ChevronRight size={15} /></button>}</section>
          <div className={s.previewNotice}><FolderInput size={22} /><div><strong>Your teaching draft is ready to inspect.</strong><p>This preview prepares examples and a test plan. It doesn’t train a model, run predictions, or measure improvement.</p>{task.kind !== 'sort' && <p>Writing and extraction also need a compatible training backend before live submission.</p>}</div></div>
          <details className={s.details} open={showDemo} onToggle={event => setShowDemo(event.currentTarget.open)}><summary>What would a comparison look like?</summary><div className={s.demoLabel}>Illustrative example · fixed sample answers, not model results</div><p className={s.hint}>Customer asks: “Can you send a copy of my last invoice?” The reviewed answer is Billing.</p><div className={s.demoComparison}><div><span>Original model</span><strong>Account changes</strong><small>Doesn’t match the reviewed answer</small></div><div><span>Trained model</span><strong>Billing</strong><small>Matches the reviewed answer</small></div></div><p className={s.hint}>A real comparison must include failures and use held-out cases. Training may not improve the result.</p></details>
          <div className={s.actions}><button type="button" className={s.backButton} onClick={() => go(3)}><ArrowLeft size={15} /> Back to checks</button><button type="button" className={s.primary} onClick={downloadDraft}>Download teaching draft <FolderInput size={16} /></button></div>
          <details className={s.details}><summary>View or copy the prepared draft</summary><label htmlFor="draft-json">Prepared draft data</label><textarea id="draft-json" rows={8} readOnly spellCheck={false} value={JSON.stringify(draft, null, 2)} /><p className={s.hint}>A portable preparation draft. It is not a file for direct submission to the current training service.</p></details>
        </>}
        </div>
        <footer className={s.footer}><span><LockKeyhole size={13} /> Local preparation only</span><span>Nothing is sent to a model.</span></footer>
      </main>
    </div>
  </div>;
}
