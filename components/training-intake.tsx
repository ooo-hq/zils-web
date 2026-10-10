'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { prepareTraining, type ColumnMapping, type CsvData, type PreparedTraining } from '@/lib/training-csv';
import { readSpreadsheet, type SpreadsheetSheet } from '@/lib/training-spreadsheet';
import { reviewData, suggestAnswers, suggestMapping, type ReviewEdits } from '@/lib/training-review';
import { MAX_DATASET_BYTES, SPLITS, submissionSchema, validateDatasets, type Split, type Submission } from '@/lib/training';
import { TrainingDecisionSetup } from '@/components/training-decision-setup';
import { TrainingExampleSetup } from '@/components/training-example-setup';
import { TrainingExampleReview } from '@/components/training-example-review';
import { SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  active?: boolean;
  onChooseType?: () => void;
  assistantConfigured?: boolean;
  busy: boolean;
  onSubmit: (input: Submission, files: Record<Split, File>) => Promise<void>;
  onFiles: (files: Partial<Record<Split, File>>) => void;
  onCloseAutoFocus: (event: Event) => void;
  pending?: boolean;
  pendingName?: string;
  submissionError: string;
  needsCredit?: boolean;
  progress: string;
  onStopUpload?: () => void;
};
const steps = ['Describe', 'Examples', 'Review', 'Train'];
const stepTitles = ['What should Zils decide?', 'Bring examples of your work.', 'Check what your model will learn.', 'Your data is ready for an experiment.'];
const splitNames = { train: 'Training', calibration: 'Calibration', test: 'Evaluation' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message.replace(/CSV record/g, 'Source record') : 'Could not read your data. Check the file or pasted text and try again.';

// State lives outside SheetContent so closing the panel preserves this browser's draft.
export function TrainingIntake({ active = true, onChooseType, assistantConfigured, busy, onSubmit, onFiles, onCloseAutoFocus, pending = false, pendingName, submissionError, needsCredit = false, progress, onStopUpload }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState('');
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [edits, setEdits] = useState<ReviewEdits>({});
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState('');
  const [pasted, setPasted] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({ inputs: [], answer: '', group: '' });
  const [independent, setIndependent] = useState(false);
  const [prepared, setPrepared] = useState<PreparedTraining | null>(null);
  const [advancedFiles, setAdvancedFiles] = useState<Partial<Record<Split, File>>>({});
  const [accuracy, setAccuracy] = useState('80');
  const [improvement, setImprovement] = useState('0.01');
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preparedName = useRef('');
  const suggestedAnswers = useRef(false);
  const locked = busy || working;
  const outcomes = useMemo(() => answers.split('\n').map(value => value.trim()).filter(Boolean), [answers]);
  const report = useMemo(() => csv ? reviewData(csv, mapping, outcomes, edits) : null, [csv, mapping, outcomes, edits]);
  useEffect(() => { if (error || submissionError) alert.current?.focus(); }, [error, submissionError]);
  function go(next: number) {
    setStep(next); setError('');
    if (next < 3) { setPrepared(null); setConsent(false); setReviewed(false); onFiles({}); }
    requestAnimationFrame(() => heading.current?.focus());
  }
  function nextDecision(event: FormEvent) {
    event.preventDefault();
    if (outcomes.length && (outcomes.length < 2 || outcomes.length > 16 || new Set(outcomes).size !== outcomes.length || outcomes.some(value => value.length > 100))) { setError('Enter 2–16 different possible answers, or leave this blank to use answers from your data.'); return; }
    if (!name) setName(question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'decision-training');
    go(1);
  }
  function chooseSheet(next: number, available = sheets) {
    const sheet = available[next];
    setSheetIndex(next); setCsv(sheet?.data || null); setEdits({}); setError(sheet?.error || '');
    setIndependent(false); setPrepared(null); setReviewed(false); setConsent(false); onFiles({});
    if (sheet?.data) {
      const suggestion = suggestMapping(sheet.data);
      setMapping(suggestion);
      if (!answers.trim() || suggestedAnswers.current) {
        setAnswers(suggestAnswers(sheet.data, suggestion.answer).join('\n')); suggestedAnswers.current = true;
      }
    }
  }
  function clearExamples() {
    setCsv(null); setSheets([]); setEdits({}); setFilename(''); setPrepared(null); setError(''); setConsent(false); setReviewed(false); onFiles({});
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    clearExamples();
    setWorking(true);
    try {
      const available = await readSpreadsheet(file);
      setSheets(available); setFilename(file.name);
      chooseSheet(Math.max(0, available.findIndex(sheet => sheet.data)), available);
    } catch (error) { setError(errorMessage(error)); if (fileInput.current) fileInput.current.value = ''; }
    finally { setWorking(false); }
  }
  function nextExamples(event: FormEvent) {
    event.preventDefault();
    if (!csv || !mapping.answer || !mapping.inputs.length) { setError('Choose the information your model should read and the field containing the correct answer.'); return; }
    if (mapping.inputs.includes(mapping.answer) || (mapping.group && mapping.inputs.includes(mapping.group)) || mapping.group === mapping.answer) { setError('Keep the answer and case reference separate from the information the model reads.'); return; }
    if (!mapping.group && !independent) { setError('Choose a shared case reference or confirm that each example is a separate case.'); return; }
    if (outcomes.length < 2 || outcomes.length > 16 || new Set(outcomes).size !== outcomes.length || outcomes.some(value => value.length > 100)) { setError('Add 2–16 different possible answers, one per line, up to 100 characters each.'); return; }
    go(2);
  }
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (!report) return;
    if (report.issues.length || report.blockers.length) { setError('Resolve the readiness checks or leave out examples needing attention before continuing.'); return; }
    setWorking(true); setError('');
    try {
      const runName = pendingName || name;
      const result = await prepareTraining(report.data, mapping, { name: runName, question, outcomes }, independent);
      await validateDatasets(result.files);
      setName(runName); preparedName.current = runName;
      setPrepared(result); onFiles(result.files); setStep(3);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) { setError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  async function loadExample() {
    setError(''); setWorking(true);
    try {
      const response = await fetch('/training/support-routing-example.csv');
      if (!response.ok) throw new Error('Could not load the example. Download it and choose the file instead.');
      await readFile(new File([await response.text()], 'support-routing-example.csv', { type: 'text/csv' }));
    } catch (error) { setError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const parsed = submissionSchema.safeParse({ name, acceptance: { min_accuracy: accuracy === '' ? NaN : Number(accuracy) / 100, min_brier_improvement: improvement === '' ? NaN : Number(improvement) }, allow_training_data_export: consent, allow_jev_comparison: consent });
    if (!parsed.success) { setError('Check your run name, success criteria, and data-sharing permission.'); return; }
    let files = advanced ? advancedFiles : prepared?.files;
    if (!files?.train || !files.calibration || !files.test) { setError('Prepare all three dataset files before submitting.'); return; }
    if (!advanced && !reviewed) { setError('Confirm that you checked the examples before sending them for training.'); return; }
    setWorking(true);
    try {
      if (!advanced && report && preparedName.current !== name) {
        const result = await prepareTraining(report.data, mapping, { name, question, outcomes }, independent);
        files = result.files; setPrepared(result); preparedName.current = name; onFiles(result.files);
      }
      await onSubmit(parsed.data, { train: files.train!, calibration: files.calibration!, test: files.test! });
    } catch (error) { setError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  function switchMode() {
    setAdvanced(value => !value); setError(''); setConsent(false); setReviewed(false);
    onFiles(advanced ? (prepared?.files || {}) : advancedFiles);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function downloadPrepared(split: Split) {
    if (!report || !prepared) return;
    setWorking(true); setError('');
    try {
      const result = preparedName.current === name ? prepared : await prepareTraining(report.data, mapping, { name, question, outcomes }, independent);
      setPrepared(result); preparedName.current = name; onFiles(result.files);
      const url = URL.createObjectURL(result.files[split]);
      const link = document.createElement('a'); link.href = url; link.download = result.files[split].name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  const criteria = <>
    <details className={styles.details}><summary>Success criteria: at least {accuracy || '—'}% accuracy</summary>
      <label htmlFor="min-accuracy">Minimum accuracy (%)</label><input id="min-accuracy" type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} />
      <small>Measured on examples kept aside from training. The trained model must also improve its probability estimates over the base model.</small>
      <label htmlFor="min-brier">Minimum Brier improvement</label><input id="min-brier" type="number" required min="0" max="2" step="any" value={improvement} onChange={event => setImprovement(event.target.value)} />
      <small>An absolute Brier loss decrease from 0 to 2, not a percentage. The default is 0.01.</small>
    </details>
    <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I am authorized to use and share these examples. I permit the learning data to be copied to assigned, approved workers, whose operators can read and retain it. I also permit final-evaluation inputs and questions to be sent to TypeSafe Jev for one saved comparison. Correct answers and confidence-check data stay with Zils. This is not confidential compute.</span></label>
  </>;
  if (!active) return null;
  return <SheetContent className={`${styles.page} ${styles.trainingSheet}`} onCloseAutoFocus={onCloseAutoFocus} onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}>
    <div className={styles.sheetHeader}><SheetTitle>Train a model</SheetTitle><SheetDescription>Text examples · Turn reviewed decisions into a tested model.</SheetDescription>{onChooseType && <button type="button" className={styles.textButton} disabled={locked || pending} onClick={onChooseType}>Change example type</button>}</div>
    <div className={styles.sheetBody}>
      {!advanced && <ol className={styles.steps} aria-label="Training setup progress">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>}
      <h3 className={styles.stepTitle} ref={heading} tabIndex={-1}>{advanced ? 'Upload prepared files.' : stepTitles[step]}</h3>
      {(error || submissionError) && <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>{error || submissionError}{!error && needsCredit && <> <Link href="/billing" className={styles.textButton}>Add credit</Link>.</>}</p>}
      {progress && <p role="status" className={styles.notice}>{progress}</p>}
      {onStopUpload && <button type="button" className={styles.secondary} onClick={onStopUpload}>Stop upload</button>}
      {pending && !busy && <p className={styles.notice}>A run is already saved. To recover its upload, prepare the original file here, then close this panel and choose “Resume missing uploads.”</p>}
      {advanced ? <form onSubmit={submit} onInvalid={event => { const details = (event.target as HTMLElement).closest('details'); if (details) details.open = true; }}><fieldset disabled={locked}>
        <p className={styles.intakeIntro}>For prepared training, calibration, and evaluation files. Keep related cases within one set.</p>
        <label htmlFor="advanced-name">Run name</label><input id="advanced-name" required pattern="[a-z0-9]([a-z0-9]|-){0,63}" maxLength={64} placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} />
        {SPLITS.map(split => <div key={split} className={styles.file}><label htmlFor={`dataset-${split}`}>{splitNames[split]} file</label><input id={`dataset-${split}`} type="file" accept=".jsonl,application/jsonl,application/x-ndjson" required={!advancedFiles[split]} onChange={event => {
          const file = event.target.files?.[0]; const files = { ...advancedFiles, [split]: file }; setAdvancedFiles(files); onFiles(files);
          if (file && file.size > MAX_DATASET_BYTES) setError(`${split}: maximum file size is 128 MiB.`);
        }} /><small>{advancedFiles[split]?.name || 'JSONL · 128 MiB maximum'}</small></div>)}
        <details className={styles.details}><summary>JSONL format</summary><p>Each line requires id, group_id, family, state, question, and label. IDs must be unique across all files. Calibration and test must share the same families, all present in training.</p><pre>{'{"id":"ticket-001","group_id":"conversation-001","family":"support-routing","state":{"message":"Please send my invoice."},"question":{"type":"choice","criteria":{"billing":"Billing","technical":"Technical support"}},"label":"billing"}'}</pre></details>
        {criteria}<div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={switchMode}>Guided setup</button><button className={styles.button} disabled={locked || pending}>{busy ? 'Sending…' : 'Send for training'}</button></div>
      </fieldset></form> : <>
        {step === 0 && <form onSubmit={nextDecision}><fieldset disabled={locked}>
          <TrainingDecisionSetup kind="text" question={question} answers={answers} assistantConfigured={assistantConfigured} onQuestion={setQuestion} onAnswers={value => { setAnswers(value); suggestedAnswers.current = false; setEdits({}); }} />
          <div className={styles.wizardActions}><button type="button" className={styles.textButton} onClick={switchMode}>Use prepared files</button><button className={styles.button}>Continue</button></div>
        </fieldset></form>}
        {step === 1 && <form onSubmit={nextExamples}><fieldset disabled={locked}>
          <p className={styles.intakeIntro}>Bring examples from your team’s tools. Choose a file or paste your data, then check how Zils reads it.</p>
          <div className={styles.spreadsheetDrop} data-dragging={dragging} onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => {
            event.preventDefault(); setDragging(false); if (locked) return;
            if (event.dataTransfer.files.length !== 1) { setError('Choose one file at a time.'); return; }
            void readFile(event.dataTransfer.files[0]);
          }}>
            <label htmlFor="decision-data">Drop your data here or choose a file</label>
            <input ref={fileInput} id="decision-data" type="file" accept=".csv,.xlsx,.json,.jsonl,.ndjson,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,application/jsonl,application/x-ndjson" onChange={event => { void readFile(event.target.files?.[0]); }} />
            <small>CSV, Excel (.xlsx), JSON, or JSONL · Up to 10 MiB and 20,000 examples</small>
          </div>
          <details className={styles.details}>
            <summary>Or paste your data</summary>
            <label htmlFor="pasted-data">Paste JSON or JSONL</label>
            <textarea id="pasted-data" rows={6} spellCheck={false} value={pasted} onChange={event => { setPasted(event.target.value); clearExamples(); if (fileInput.current) fileInput.current.value = ''; }} placeholder={'[{"message":"Please send my invoice.","answer":"Billing"}]'} />
            <small>Paste one object, a list of objects, or one object per line. Nested information is kept together.</small>
            <div className={styles.actions}><button type="button" className={styles.secondary} disabled={locked || !pasted.trim()} onClick={() => { void readFile(new File([pasted], 'pasted-data.json', { type: 'application/json' })); }}>Use pasted data</button></div>
          </details>
          <p className={styles.localNote}>Read locally in your browser. Nothing is uploaded until you send the prepared examples for training.</p>
          {!csv && <div className={styles.fileHelp}><a href="/training/decision-template.csv" download>Download a template</a>{outcomes.length === 3 && ['Billing', 'Technical support', 'Account changes'].every(answer => outcomes.includes(answer)) && <button type="button" className={styles.textButton} onClick={() => { void loadExample(); }}>Try sample examples</button>}</div>}
          {working && <p role="status" className={styles.localNote}>Checking your examples…</p>}
          {sheets.length > 1 && <><label htmlFor="data-source">Choose the examples to use</label><select id="data-source" value={sheetIndex} onChange={event => chooseSheet(Number(event.target.value))}>{sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}{sheet.data ? ` (${sheet.data.rows.length.toLocaleString()} examples)` : ''}</option>)}</select>{/\.json$/i.test(filename) && sheetIndex > 0 && <p className={styles.localNote}>Fields outside the selected list are not included.</p>}</>}
          {csv && <>
            <p role="status" className={styles.fileReady}><strong>{csv.rows.length.toLocaleString()} examples found</strong><span>{filename}{sheets.length > 1 ? ` / ${sheets[sheetIndex].name}` : ''}</span></p>
            {/\.xlsx$/i.test(filename) && <p className={styles.localNote}>Excel imports saved cell values. Save your workbook first if formulas have changed.</p>}
            <TrainingExampleSetup key={`${filename}-${sheetIndex}`} csv={csv} mapping={mapping} independent={independent} onMapping={next => {
              if (next.answer !== mapping.answer && (!answers.trim() || suggestedAnswers.current)) { setAnswers(suggestAnswers(csv, next.answer).join('\n')); suggestedAnswers.current = true; }
              setMapping(next); setEdits({});
            }} onIndependent={setIndependent} />
            <label htmlFor="spreadsheet-answers">Possible answers</label><textarea id="spreadsheet-answers" required rows={3} value={answers} onChange={event => { setAnswers(event.target.value); suggestedAnswers.current = false; setEdits({}); }} placeholder={'Billing\nTechnical support\nAccount changes'} />
            <small>Check these answers before continuing. One per line; you can correct individual examples in the next step.</small>
            {mapping.answer && suggestAnswers(csv, mapping.answer).length >= 2 && <button type="button" className={styles.textButton} onClick={() => { setAnswers(suggestAnswers(csv, mapping.answer).join('\n')); suggestedAnswers.current = true; setEdits({}); }}>Use answers found in this field</button>}
          </>}
          {!csv && <details className={styles.details}><summary>My data doesn’t have answers yet</summary><p>Include a field for the correct answer, even if some answers are blank. You can fill in or correct those answers during review. Policy documents alone need real decision examples before training.</p></details>}
          <div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={() => go(0)}>Back</button><button className={styles.button} disabled={!csv || locked}>{working ? 'Checking…' : 'Review examples'}</button></div>
        </fieldset></form>}
        {step === 2 && csv && report && <form onSubmit={prepare}><fieldset disabled={locked}>
          <p className={styles.intakeIntro}>Check the suggested examples and resolve any flagged decisions.</p>
          <TrainingExampleReview data={csv} mapping={mapping} outcomes={outcomes} edits={edits} report={report} onEdit={(index, edit) => { setEdits(previous => ({ ...previous, [index]: edit })); setError(''); setReviewed(false); setConsent(false); setPrepared(null); onFiles({}); }} />
          <div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={() => go(1)}>Back</button><button className={styles.button} disabled={locked || report.issues.length > 0 || report.blockers.length > 0}>{working ? 'Preparing…' : 'Check readiness'}</button></div>
        </fieldset></form>}
        {step === 3 && prepared && <form onSubmit={submit} onInvalid={event => { const details = (event.target as HTMLElement).closest('details'); if (details) details.open = true; }}><fieldset disabled={locked}>
          <p className={styles.intakeIntro}>Zils will train on your examples and check whether the result improves on the base model. A run may finish without a qualifying model.</p>
          <label htmlFor="decision-name">Run name</label><input id="decision-name" required readOnly={pending} maxLength={64} pattern="[a-z0-9]([a-z0-9]|-){0,63}" value={name} onChange={event => setName(event.target.value)} /><small>{pending ? 'The original run name is kept for upload recovery.' : 'Lowercase letters, numbers, and hyphens.'}</small>
          <div className={styles.reviewSummary}><strong>{question}</strong><p>{prepared.total.toLocaleString()} examples from {prepared.groups.toLocaleString()} separate cases.</p></div>
          <div className={styles.readinessChecks}><h4>Ready to submit</h4><p>{report?.excluded || 0} examples left out. Every included example has an allowed answer, repeated inputs are resolved, and related cases stay together.</p><p>This is a data-readiness result. Model quality will be measured after training on examples kept aside for evaluation.</p></div>
          <PreparedExamples rows={prepared.preview.slice(0, 1)} />
          <details className={styles.details}><summary>More examples and evaluation details</summary>
            <PreparedExamples rows={prepared.preview.slice(1)} />
            <div className={styles.splitSummary}>{SPLITS.map(split => <div key={split}><strong>{prepared.counts[split].toLocaleString()}</strong><span>{splitNames[split]}</span></div>)}</div>
            <p>We aim for a 70/15/15 split. Related cases stay together and every answer is represented. Calibration checks confidence; final evaluation uses cases withheld from fitting.</p>
            <div className={styles.tableWrap} role="region" aria-label="Answer coverage" tabIndex={0}><table><thead><tr><th>Answer</th>{SPLITS.map(split => <th key={split}>{splitNames[split]}</th>)}</tr></thead><tbody>{prepared.distribution.map(row => <tr key={row.outcome}><th>{row.outcome}</th>{SPLITS.map(split => <td key={split}>{row[split]}</td>)}</tr>)}</tbody></table></div>
            <div className={styles.actions}>{SPLITS.map(split => <button key={split} type="button" className={styles.secondary} onClick={() => { void downloadPrepared(split); }}>Download {split}</button>)}</div>
          </details>
          <label className={styles.checkLabel}><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I checked the answers and the information Zils will read. Examples from the same case are kept together.</span></label>
          {criteria}
          <div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={() => go(2)}>Back</button><button className={styles.button} disabled={locked || pending}>{busy ? 'Sending…' : 'Send for training'}</button></div>
        </fieldset></form>}
      </>}
      <p className={styles.draftNote}>Your draft stays here when you close this panel. Refreshing or leaving this page clears it. Files are uploaded only when you send them for training.</p>
    </div>
  </SheetContent>;
}

function PreparedExamples({ rows }: { rows: PreparedTraining['preview'] }) {
  return <div className={styles.previewRows}>{rows.map((row, index) => <div key={index}>
    <dl>{Object.entries(row.information).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <p><span>Should answer</span><strong>{row.answer}</strong></p>
  </div>)}</div>;
}
