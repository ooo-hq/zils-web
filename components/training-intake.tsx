'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CSV_BYTES, parseCsv, prepareTraining, type ColumnMapping, type CsvData, type PreparedTraining } from '@/lib/training-csv';
import { MAX_DATASET_BYTES, SPLITS, submissionSchema, validateDatasets, type Split, type Submission } from '@/lib/training';
import { TrainingExampleSetup } from '@/components/training-example-setup';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  busy: boolean;
  onSubmit: (input: Submission, files: Record<Split, File>) => Promise<void>;
  onFiles: (files: Partial<Record<Split, File>>) => void;
  pending?: boolean;
};
const steps = ['Decision', 'Examples', 'Teach', 'Review'];
const stepTitles = ['Choose a decision to teach', 'Bring examples with known answers', 'Explain an example to Zils', 'Check what you’re sending'];
const splitNames = { train: 'Learn patterns', calibration: 'Check confidence', test: 'Test decisions' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not prepare the file. Try exporting it as CSV again.';

export function TrainingIntake({ busy, onSubmit, onFiles, pending = false }: Props) {
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
  const locked = busy || working || pending;
  const outcomes = answers.split('\n').map(value => value.trim()).filter(Boolean);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  function go(next: number) {
    setStep(next); setError('');
    if (next < 3) { setPrepared(null); setConsent(false); setReviewed(false); onFiles({}); }
    requestAnimationFrame(() => heading.current?.focus());
  }
  function useExample() {
    setName('support-routing-v1'); setQuestion('Which team should handle this support ticket?');
    setAnswers('Billing\nTechnical support\nAccount changes');
  }
  function nextDecision(event: FormEvent) {
    event.preventDefault();
    if (outcomes.length < 2 || outcomes.length > 16 || new Set(outcomes).size !== outcomes.length || outcomes.some(value => value.length > 100)) { setError('Enter 2–16 different possible answers, one per line, up to 100 characters each.'); return; }
    go(1);
  }
  async function readFile(file: File | undefined) {
    setCsv(null); setFilename(''); setPrepared(null); setError(''); onFiles({});
    if (!file) return;
    setWorking(true);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Export your spreadsheet as a comma-separated .csv file. Excel workbooks and PDFs are not supported here.');
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 10 MiB, or choose “Advanced: prepared files.”');
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
      const result = await prepareTraining(csv, mapping, { name, question, outcomes }, independent);
      await validateDatasets(result.files);
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
    const parsed = submissionSchema.safeParse({ name, acceptance: { min_accuracy: accuracy === '' ? NaN : Number(accuracy) / 100, min_brier_improvement: improvement === '' ? NaN : Number(improvement) }, allow_training_data_export: consent });
    if (!parsed.success) { setError('Check your project name, success criteria, and data-sharing permission.'); return; }
    const files = advanced ? advancedFiles : prepared?.files;
    if (!files?.train || !files.calibration || !files.test) { setError('Prepare all three dataset files before submitting.'); return; }
    if (!advanced && !reviewed) { setError('Review what Zils will read and the answers it should learn before sending your examples.'); return; }
    await onSubmit(parsed.data, { train: files.train, calibration: files.calibration, test: files.test });
  }
  function switchMode() {
    setAdvanced(value => !value); setError(''); setConsent(false); setReviewed(false);
    onFiles(advanced ? (prepared?.files || {}) : advancedFiles);
  }
  const criteria = <>
    <label htmlFor="min-accuracy">How often should Zils get it right? (%)</label>
    <input id="min-accuracy" type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} />
    <small>80% means 80 correct decisions out of 100. Choose a target that makes sense for your task; we measure it on examples Zils did not learn from.</small>
    <details className={styles.details}><summary>Advanced evaluation settings</summary>
      <label htmlFor="min-brier">Minimum Brier improvement</label><input id="min-brier" type="number" required min="0" max="2" step="any" value={improvement} onChange={event => setImprovement(event.target.value)} />
      <p>The model must improve its probability estimates over the starting model. This is an absolute Brier loss decrease from 0 to 2, not a percentage. The starting value is 0.01.</p>
    </details>
    <p className={styles.help}>We compare the trained model with the starting model. You receive a model download only if it improves and meets your target. Training does not automatically connect it to your software.</p>
    <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I am authorized to use and share these examples. I permit the learning data to be copied to assigned, approved workers, whose operators can read and retain it. Confidence-check and final-evaluation data stay with the validator. This is not confidential compute.</span></label>
  </>;
  return <section className={styles.panel} aria-label="Prepare a training job">
    <div className={styles.intakeHeader}><h2>Teach Zils your decision.</h2><button type="button" className={styles.textButton} onClick={switchMode} disabled={locked}>{advanced ? 'Back to guided setup' : 'Advanced: prepared files'}</button></div>
    {!advanced && <ol className={styles.steps} aria-label="Training setup progress">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>}
    {error && <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
    {pending && <p className={styles.notice}>This job is already saved. Use “Resume missing uploads” or “Retry submission” in Your training runs. Cancel that job before creating another from this form.</p>}
    {!advanced && <h3 className={styles.stepTitle} ref={heading} tabIndex={-1}>{stepTitles[step]}</h3>}
    {advanced ? <form onSubmit={submit}><fieldset disabled={locked}>
      <p>Already prepared learning, calibration, and test files? Submit them directly. Keep related source records and duplicate prompts within one set.</p>
      <label htmlFor="advanced-name">Project name</label><input id="advanced-name" required pattern="[a-z0-9][a-z0-9-]{0,63}" maxLength={64} placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} />
      <small>Use lowercase letters, numbers, and hyphens. Change the version when you change the examples.</small>
      {SPLITS.map(split => <div key={split} className={styles.file}><label htmlFor={`dataset-${split}`}>{split} dataset</label><input id={`dataset-${split}`} type="file" accept=".jsonl,application/jsonl,application/x-ndjson" required onChange={event => {
        const file = event.target.files?.[0]; const files = { ...advancedFiles, [split]: file }; setAdvancedFiles(files); onFiles(files);
        if (file && file.size > MAX_DATASET_BYTES) setError(`${split}: maximum file size is 128 MiB.`);
      }} /><small>JSONL · 128 MiB maximum{advancedFiles[split] ? ` · ${advancedFiles[split]!.name}` : ''}</small></div>)}
      <details className={styles.details}><summary>JSONL format</summary><p>Each line is a JSON object with id, group_id, family, state, question, and label. IDs must be unique across all files. Calibration and test must have the same families, all present in training.</p><pre>{'{"id":"ticket-001","group_id":"conversation-001","family":"support-routing","state":{"message":"Please send my invoice."},"question":{"type":"choice","criteria":{"billing":"Billing","technical":"Technical support"}},"label":"billing"}'}</pre><p>Questions also support noul (true/false) and score (an ordered list of outcomes). Server validation runs again after submission.</p></details>
      {criteria}<button className={styles.button} disabled={locked || pending}>{busy ? 'Sending…' : 'Send for training'}</button>
    </fieldset></form> : <>
      {step === 0 && <form onSubmit={nextDecision}><fieldset disabled={locked}>
        <p>Think of a question your team answers repeatedly. For example: which team should handle a support ticket? List the answers Zils can choose from.</p>
        <button type="button" className={styles.secondary} onClick={useExample}>Use the support-routing example</button>
        <label htmlFor="decision-name">Project name</label><input id="decision-name" required maxLength={64} pattern="[a-z0-9][a-z0-9-]{0,63}" placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} /><small>Lowercase letters, numbers, and hyphens. Use a new version for changed data.</small>
        <label htmlFor="decision-question">What should Zils decide?</label><textarea id="decision-question" required maxLength={1000} rows={2} placeholder="Which team should handle this support ticket?" value={question} onChange={event => setQuestion(event.target.value)} />
        <label htmlFor="decision-answers">Possible answers, one per line</label><textarea id="decision-answers" required rows={4} placeholder={'Billing\nTechnical support\nAccount changes'} value={answers} onChange={event => setAnswers(event.target.value)} /><small>Use these same answer names in your examples, including capitalization.</small>
        <div className={styles.actions}><button className={styles.button}>Continue to examples</button></div>
      </fieldset></form>}
      {step === 1 && <fieldset disabled={locked}>
        <p>Bring a spreadsheet of past cases where you already know the right answer. Each row should describe one case and the answer your team checked.</p>
        <div className={styles.actions}><a className={styles.secondary} href="/training/decision-template.csv" download>Download a template</a><a className={styles.textButton} href="/training/support-routing-example.csv" download>Download filled-in example</a><button type="button" className={styles.textButton} onClick={() => { void loadExample(); }}>Try with the example file</button></div>
        <label htmlFor="decision-csv">Choose your spreadsheet file (.csv)</label><input ref={fileInput} id="decision-csv" type="file" accept=".csv,text/csv" onChange={event => { void readFile(event.target.files?.[0]); }} /><small>Save or download your spreadsheet as CSV UTF-8 first. Maximum file size: 10 MiB; up to 20,000 examples.</small>
        <p className={styles.localNote}>Your file stays in this browser until you choose “Send for training.” Keep a copy: leaving or refreshing this page clears your draft.</p>
        {working && <p role="status">Reading your CSV…</p>}
        {csv && <p role="status" className={styles.notice}>{filename}: {csv.rows.length.toLocaleString()} examples found. Next, show Zils what to read and which part is the right answer.</p>}
        <details className={styles.details}><summary>My data doesn’t have correct answers yet</summary><p>Ask someone who knows the task to review each case and record the right answer next to it. Use one of the answer names you chose earlier. Resolve disagreements before training; Zils learns from the answers you provide.</p></details>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(0)}>Back</button><button type="button" className={styles.button} disabled={!csv || locked} onClick={() => go(2)}>Explain an example</button></div>
      </fieldset>}
      {step === 2 && csv && <form onSubmit={prepare}><fieldset disabled={locked}>
        <TrainingExampleSetup csv={csv} mapping={mapping} independent={independent} onMapping={setMapping} onIndependent={setIndependent} />
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(1)}>Back</button><button className={styles.button}>{working ? 'Checking your examples…' : 'Review my examples'}</button></div>
      </fieldset></form>}
      {step === 3 && prepared && <form onSubmit={submit}><fieldset disabled={locked}>
        <p><strong>{question}</strong><br />{prepared.total.toLocaleString()} examples from {prepared.groups.toLocaleString()} separate cases.</p>
        <div className={styles.splitSummary}>{SPLITS.map(split => <div key={split}><strong>{prepared.counts[split].toLocaleString()}</strong><span>{splitNames[split]}</span></div>)}</div>
        <p className={styles.help}>Some examples teach Zils the patterns. Others are kept aside to check how sure it is and test its decisions on cases it hasn’t learned from.</p>
        <details className={styles.details}><summary>How your examples are separated</summary>
        <p className={styles.help}>We aim for 70% learning, 15% confidence checks, and 15% final evaluation. Actual sizes vary to keep source groups together and every answer represented. Confidence checks tune probability estimates; final evaluation measures performance on cases withheld from fitting.</p>
        <div className={styles.tableWrap} role="region" aria-label="Answer coverage" tabIndex={0}><table><caption>Every answer appears in all three sets.</caption><thead><tr><th>Answer</th>{SPLITS.map(split => <th key={split}>{splitNames[split]}</th>)}</tr></thead><tbody>{prepared.distribution.map(row => <tr key={row.outcome}><th>{row.outcome}</th>{SPLITS.map(split => <td key={split}>{row[split]}</td>)}</tr>)}</tbody></table></div>
        </details>
        <h4>A final look at what you’re teaching</h4><p className={styles.help}>Check these examples: Zils reads the information, then learns the right answer shown beside it.</p>
        <PreparedExamples rows={prepared.preview.slice(0, 1)} />
        {prepared.preview.length > 1 && <details className={styles.details}><summary>Check {prepared.preview.length - 1} more examples</summary><PreparedExamples rows={prepared.preview.slice(1)} /></details>}
        <p className={styles.help}>More varied, well-reviewed examples make this a more useful test. We can spot exact duplicates, but you still need to check the answers and remove details that would only be known after deciding.</p>
        <label className={styles.checkLabel}><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I checked the answers and the information Zils will read. Examples from the same case are kept together.</span></label>
        {criteria}
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(2)}>Back</button><button className={styles.button} disabled={locked || pending}>{busy ? 'Sending…' : 'Send for training'}</button></div>
        <details className={styles.details}><summary>Keep the prepared files</summary><p>Download these private files for inspection or to resume an interrupted upload. Keep them with your original CSV.</p><div className={styles.actions}>{SPLITS.map(split => <button key={split} type="button" className={styles.secondary} onClick={() => {
          const url = URL.createObjectURL(prepared.files[split]); const link = document.createElement('a'); link.href = url; link.download = prepared.files[split].name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download {split}</button>)}</div></details>
      </fieldset></form>}
    </>}
  </section>;
}

function PreparedExamples({ rows }: { rows: PreparedTraining['preview'] }) {
  return <div className={styles.previewRows}>{rows.map((row, index) => <div key={index}>
    <dl>{Object.entries(row.information).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <p><span>Should answer</span><strong>{row.answer}</strong></p>
  </div>)}</div>;
}
