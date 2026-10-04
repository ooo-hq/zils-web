'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CSV_BYTES, parseCsv, prepareTraining, type ColumnMapping, type CsvData, type PreparedTraining } from '@/lib/training-csv';
import { MAX_DATASET_BYTES, SPLITS, submissionSchema, validateDatasets, type Split, type Submission } from '@/lib/training';
import { TrainingExampleSetup } from '@/components/training-example-setup';
import { SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  busy: boolean;
  onSubmit: (input: Submission, files: Record<Split, File>) => Promise<void>;
  onFiles: (files: Partial<Record<Split, File>>) => void;
  onCloseAutoFocus: (event: Event) => void;
  pending?: boolean;
  pendingName?: string;
  submissionError: string;
  progress: string;
  onStopUpload?: () => void;
};
const steps = ['Decision', 'Examples', 'Review'];
const stepTitles = ['What should Zils decide?', 'Show Zils your past decisions.', 'Ready for training?'];
const splitNames = { train: 'Training', calibration: 'Calibration', test: 'Evaluation' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not prepare the file. Try exporting it as CSV again.';

// State lives outside SheetContent so closing the panel preserves this browser's draft.
export function TrainingIntake({ busy, onSubmit, onFiles, onCloseAutoFocus, pending = false, pendingName, submissionError, progress, onStopUpload }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState('');
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [filename, setFilename] = useState('');
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
  const locked = busy || working;
  const outcomes = answers.split('\n').map(value => value.trim()).filter(Boolean);
  useEffect(() => { if (error || submissionError) alert.current?.focus(); }, [error, submissionError]);
  function go(next: number) {
    setStep(next); setError('');
    if (next < 2) { setPrepared(null); setConsent(false); setReviewed(false); onFiles({}); }
    requestAnimationFrame(() => heading.current?.focus());
  }
  function useExample() {
    setName('support-routing-v1'); setQuestion('Which team should handle this support ticket?');
    setAnswers('Billing\nTechnical support\nAccount changes');
  }
  function nextDecision(event: FormEvent) {
    event.preventDefault();
    if (outcomes.length < 2 || outcomes.length > 16 || new Set(outcomes).size !== outcomes.length || outcomes.some(value => value.length > 100)) { setError('Enter 2–16 different possible answers, one per line, up to 100 characters each.'); return; }
    if (!name) setName(question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'decision-training');
    go(1);
  }
  async function readFile(file: File | undefined) {
    setCsv(null); setFilename(''); setPrepared(null); setError(''); setConsent(false); setReviewed(false); onFiles({});
    if (!file) return;
    setWorking(true);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Export your spreadsheet as a comma-separated .csv file. Excel workbooks and PDFs are not supported here.');
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 10 MiB, or use prepared JSONL files in advanced setup.');
      let source: string;
      try { source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
      catch { throw new Error('Save the spreadsheet as CSV UTF-8 and choose the exported file again.'); }
      const data = parseCsv(source);
      const answer = data.headers.find(header => /^(correct_decision|correct_answer|label)$/i.test(header)) || '';
      const group = data.headers.find(header => /^(case_group|group_id|source_group)$/i.test(header)) || '';
      const inputs = data.headers.filter(header => /^(information|customer_message|context)$/i.test(header) && header !== answer && header !== group);
      setMapping({ inputs, answer, group }); setIndependent(false); setCsv(data); setFilename(file.name);
    } catch (error) { setError(errorMessage(error)); if (fileInput.current) fileInput.current.value = ''; }
    finally { setWorking(false); }
  }
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (!csv) return;
    setWorking(true); setError('');
    try {
      const runName = pendingName || name;
      const result = await prepareTraining(csv, mapping, { name: runName, question, outcomes }, independent);
      await validateDatasets(result.files);
      setName(runName); preparedName.current = runName;
      setPrepared(result); onFiles(result.files); setStep(2);
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
    const parsed = submissionSchema.safeParse({ name, acceptance: { min_accuracy: accuracy === '' ? NaN : Number(accuracy) / 100, min_brier_improvement: improvement === '' ? NaN : Number(improvement) }, allow_training_data_export: consent });
    if (!parsed.success) { setError('Check your run name, success criteria, and data-sharing permission.'); return; }
    let files = advanced ? advancedFiles : prepared?.files;
    if (!files?.train || !files.calibration || !files.test) { setError('Prepare all three dataset files before submitting.'); return; }
    if (!advanced && !reviewed) { setError('Confirm that you checked the examples before sending them for training.'); return; }
    setWorking(true);
    try {
      if (!advanced && csv && preparedName.current !== name) {
        const result = await prepareTraining(csv, mapping, { name, question, outcomes }, independent);
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
  const criteria = <>
    <details className={styles.details}><summary>Success criteria: at least {accuracy || '—'}% accuracy</summary>
      <label htmlFor="min-accuracy">Minimum accuracy (%)</label><input id="min-accuracy" type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} />
      <small>Measured on examples kept aside from training. The trained model must also improve its probability estimates over the base model.</small>
      <label htmlFor="min-brier">Minimum Brier improvement</label><input id="min-brier" type="number" required min="0" max="2" step="any" value={improvement} onChange={event => setImprovement(event.target.value)} />
      <small>An absolute Brier loss decrease from 0 to 2, not a percentage. The default is 0.01.</small>
    </details>
    <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I am authorized to use and share these examples. I permit the learning data to be copied to assigned, approved workers, whose operators can read and retain it. Confidence-check and final-evaluation data stay with the validator. This is not confidential compute.</span></label>
  </>;
  return <SheetContent className={`${styles.page} ${styles.trainingSheet}`} onCloseAutoFocus={onCloseAutoFocus} onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}>
    <div className={styles.sheetHeader}><SheetTitle>Train a model</SheetTitle><SheetDescription>Turn reviewed examples into a tested decision model.</SheetDescription></div>
    <div className={styles.sheetBody}>
      {!advanced && <ol className={styles.steps} aria-label="Training setup progress">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>}
      <h3 className={styles.stepTitle} ref={heading} tabIndex={-1}>{advanced ? 'Upload prepared files.' : stepTitles[step]}</h3>
      {(error || submissionError) && <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>{error || submissionError}</p>}
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
          <p className={styles.intakeIntro}>Choose one decision your team makes repeatedly.</p>
          <label htmlFor="decision-question">The decision</label><textarea id="decision-question" required maxLength={1000} rows={3} placeholder="Which team should handle this support ticket?" value={question} onChange={event => setQuestion(event.target.value)} />
          <label htmlFor="decision-answers">Possible answers</label><textarea id="decision-answers" required rows={3} placeholder={'Billing\nTechnical support\nAccount changes'} value={answers} onChange={event => setAnswers(event.target.value)} /><small>One answer per line. Your examples should use these exact names.</small>
          <button type="button" className={styles.textButton} onClick={useExample}>Try the support-routing example</button>
          <div className={styles.wizardActions}><button type="button" className={styles.textButton} onClick={switchMode}>Use prepared files</button><button className={styles.button}>Continue</button></div>
        </fieldset></form>}
        {step === 1 && <form onSubmit={prepare}><fieldset disabled={locked}>
          <p className={styles.intakeIntro}>Each example needs a situation and the answer your team chose.</p>
          <label htmlFor="decision-csv">Spreadsheet (.csv)</label><input ref={fileInput} id="decision-csv" type="file" accept=".csv,text/csv" onChange={event => { void readFile(event.target.files?.[0]); }} /><small>CSV UTF-8 · Up to 10 MiB or 20,000 examples</small>
          {!csv && <div className={styles.fileHelp}><a href="/training/decision-template.csv" download>Download a template</a>{outcomes.length === 3 && ['Billing', 'Technical support', 'Account changes'].every(answer => outcomes.includes(answer)) && <button type="button" className={styles.textButton} onClick={() => { void loadExample(); }}>Try sample examples</button>}</div>}
          {working && <p role="status" className={styles.localNote}>Checking your examples…</p>}
          {csv && <><p role="status" className={styles.fileReady}><strong>{csv.rows.length.toLocaleString()} examples found</strong><span>{filename}</span></p><TrainingExampleSetup csv={csv} mapping={mapping} independent={independent} onMapping={setMapping} onIndependent={setIndependent} /></>}
          {!csv && <details className={styles.details}><summary>My data doesn’t have answers yet</summary><p>Have someone who knows the task review each case and record the right answer. Use the answer names you chose in the first step.</p></details>}
          <div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={() => go(0)}>Back</button><button className={styles.button} disabled={!csv || locked}>{working ? 'Checking…' : 'Review examples'}</button></div>
        </fieldset></form>}
        {step === 2 && prepared && <form onSubmit={submit} onInvalid={event => { const details = (event.target as HTMLElement).closest('details'); if (details) details.open = true; }}><fieldset disabled={locked}>
          <p className={styles.intakeIntro}>Zils will train on your examples and check whether the result improves on the base model. A run may finish without a qualifying model.</p>
          <label htmlFor="decision-name">Run name</label><input id="decision-name" required maxLength={64} pattern="[a-z0-9]([a-z0-9]|-){0,63}" value={name} onChange={event => setName(event.target.value)} /><small>Lowercase letters, numbers, and hyphens.</small>
          <div className={styles.reviewSummary}><strong>{question}</strong><p>{prepared.total.toLocaleString()} examples from {prepared.groups.toLocaleString()} separate cases.</p></div>
          <PreparedExamples rows={prepared.preview.slice(0, 1)} />
          <details className={styles.details}><summary>More examples and evaluation details</summary>
            <PreparedExamples rows={prepared.preview.slice(1)} />
            <div className={styles.splitSummary}>{SPLITS.map(split => <div key={split}><strong>{prepared.counts[split].toLocaleString()}</strong><span>{splitNames[split]}</span></div>)}</div>
            <p>We aim for a 70/15/15 split. Related cases stay together and every answer is represented. Calibration checks confidence; final evaluation uses cases withheld from fitting.</p>
            <div className={styles.tableWrap} role="region" aria-label="Answer coverage" tabIndex={0}><table><thead><tr><th>Answer</th>{SPLITS.map(split => <th key={split}>{splitNames[split]}</th>)}</tr></thead><tbody>{prepared.distribution.map(row => <tr key={row.outcome}><th>{row.outcome}</th>{SPLITS.map(split => <td key={split}>{row[split]}</td>)}</tr>)}</tbody></table></div>
            <div className={styles.actions}>{SPLITS.map(split => <button key={split} type="button" className={styles.secondary} onClick={() => { const url = URL.createObjectURL(prepared.files[split]); const link = document.createElement('a'); link.href = url; link.download = prepared.files[split].name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download {split}</button>)}</div>
          </details>
          <label className={styles.checkLabel}><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I checked the answers and the information Zils will read. Examples from the same case are kept together.</span></label>
          {criteria}
          <div className={styles.wizardActions}><button type="button" className={styles.secondary} onClick={() => go(1)}>Back</button><button className={styles.button} disabled={locked || pending}>{busy ? 'Sending…' : 'Send for training'}</button></div>
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
