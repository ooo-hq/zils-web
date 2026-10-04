'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CSV_BYTES, parseCsv, prepareTraining, type ColumnMapping, type CsvData, type PreparedTraining } from '@/lib/training-csv';
import { MAX_DATASET_BYTES, SPLITS, submissionSchema, validateDatasets, type Split, type Submission } from '@/lib/training';
import styles from '@/app/(home)/train/train.module.css';

type Props = {
  busy: boolean;
  onSubmit: (input: Submission, files: Record<Split, File>) => Promise<void>;
  onFiles: (files: Partial<Record<Split, File>>) => void;
  pending?: boolean;
};
const steps = ['Your decision', 'Your examples', 'Match columns', 'Review & submit'];
const splitNames = { train: 'Learning', calibration: 'Confidence check', test: 'Final evaluation' };
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
    if (outcomes.length < 2 || outcomes.length > 50 || new Set(outcomes).size !== outcomes.length || outcomes.some(value => value.length > 100)) { setError('Enter 2–50 different possible answers, one per line, up to 100 characters each.'); return; }
    go(1);
  }
  async function readFile(file: File | undefined) {
    setCsv(null); setFilename(''); setPrepared(null); setError(''); onFiles({});
    if (!file) return;
    setWorking(true);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Export your spreadsheet as a comma-separated .csv file. Excel workbooks and PDFs are not supported here.');
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 10 MiB, or use advanced JSONL upload.');
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
    if (!advanced && !reviewed) { setError('Review the information columns and answers before submitting.'); return; }
    await onSubmit(parsed.data, { train: files.train, calibration: files.calibration, test: files.test });
  }
  function switchMode() {
    setAdvanced(value => !value); setError(''); setConsent(false); setReviewed(false);
    onFiles(advanced ? (prepared?.files || {}) : advancedFiles);
  }
  const criteria = <>
    <label htmlFor="min-accuracy">Minimum correct decisions (%)</label>
    <input id="min-accuracy" type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => setAccuracy(event.target.value)} />
    <small>Your target on the final evaluation set. Choose a standard suitable for this decision; 80% is only a starting value.</small>
    <details className={styles.details}><summary>Advanced evaluation settings</summary>
      <label htmlFor="min-brier">Minimum Brier improvement</label><input id="min-brier" type="number" required min="0" max="2" step="any" value={improvement} onChange={event => setImprovement(event.target.value)} />
      <p>The model must improve its probability estimates over the starting model. This is an absolute Brier loss decrease from 0 to 2, not a percentage. The starting value is 0.01.</p>
    </details>
    <p className={styles.help}>A finished run may find no model that meets your criteria. An accepted result is a downloadable model artifact; it does not create a live prediction API.</p>
    <label className={styles.consent}><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I am authorized to use and share these examples. I permit the learning data to be copied to assigned, approved workers, whose operators can read and retain it. Confidence-check and final-evaluation data stay with the validator. This is not confidential compute.</span></label>
  </>;
  return <section className={styles.panel} aria-label="Prepare a training job">
    <div className={styles.intakeHeader}><h2>Teach Zils your decision.</h2><button type="button" className={styles.textButton} onClick={switchMode} disabled={locked}>{advanced ? 'Use guided CSV setup' : 'Advanced JSONL upload'}</button></div>
    {!advanced && <ol className={styles.steps} aria-label="Training setup progress">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{title}</li>)}</ol>}
    {error && <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
    {pending && <p className={styles.notice}>This job is already saved. Use “Resume missing uploads” or “Retry submission” in Your training jobs. Cancel that job before creating another from this form.</p>}
    {!advanced && <h3 className={styles.stepTitle} ref={heading} tabIndex={-1}>{steps[step]}</h3>}
    {advanced ? <form onSubmit={submit}><fieldset disabled={locked}>
      <p>Already prepared learning, calibration, and test files? Submit them directly. Keep related source records and duplicate prompts within one set.</p>
      <label htmlFor="advanced-name">Project name</label><input id="advanced-name" required pattern="[a-z0-9][a-z0-9-]{0,63}" maxLength={64} placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} />
      <small>Use lowercase letters, numbers, and hyphens. Change the version when you change the examples.</small>
      {SPLITS.map(split => <div key={split} className={styles.file}><label htmlFor={`dataset-${split}`}>{split} dataset</label><input id={`dataset-${split}`} type="file" accept=".jsonl,application/jsonl,application/x-ndjson" required onChange={event => {
        const file = event.target.files?.[0]; const files = { ...advancedFiles, [split]: file }; setAdvancedFiles(files); onFiles(files);
        if (file && file.size > MAX_DATASET_BYTES) setError(`${split}: maximum file size is 128 MiB.`);
      }} /><small>JSONL · 128 MiB maximum{advancedFiles[split] ? ` · ${advancedFiles[split]!.name}` : ''}</small></div>)}
      <details className={styles.details}><summary>JSONL format</summary><p>Each line is a JSON object with id, group_id, family, state, question, and label. IDs must be unique across all files. Calibration and test must have the same families, all present in training.</p><pre>{'{"id":"ticket-001","group_id":"conversation-001","family":"support-routing","state":{"message":"Please send my invoice."},"question":{"type":"choice","criteria":{"billing":"Billing","technical":"Technical support"}},"label":"billing"}'}</pre><p>Questions also support noul (true/false) and score (an ordered list of outcomes). Server validation runs again after submission.</p></details>
      {criteria}<button className={styles.button} disabled={locked || pending}>{busy ? 'Submitting…' : 'Submit training job'}</button>
    </fieldset></form> : <>
      {step === 0 && <form onSubmit={nextDecision}><fieldset disabled={locked}>
        <p>Choose one decision with a fixed set of answers. Start with something your team already handles and can check for correctness.</p>
        <button type="button" className={styles.secondary} onClick={useExample}>Use the support-routing example</button>
        <label htmlFor="decision-name">Project name</label><input id="decision-name" required maxLength={64} pattern="[a-z0-9][a-z0-9-]{0,63}" placeholder="support-routing-v1" value={name} onChange={event => setName(event.target.value)} /><small>Lowercase letters, numbers, and hyphens. Use a new version for changed data.</small>
        <label htmlFor="decision-question">What should Zils decide?</label><textarea id="decision-question" required maxLength={1000} rows={2} placeholder="Which team should handle this support ticket?" value={question} onChange={event => setQuestion(event.target.value)} />
        <label htmlFor="decision-answers">Possible answers, one per line</label><textarea id="decision-answers" required rows={4} placeholder={'Billing\nTechnical support\nAccount changes'} value={answers} onChange={event => setAnswers(event.target.value)} /><small>Your spreadsheet’s correct answers must match these names, including capitalization.</small>
        <div className={styles.actions}><button className={styles.button}>Continue to examples</button></div>
      </fieldset></form>}
      {step === 1 && <fieldset disabled={locked}>
        <p>Export a spreadsheet of past cases with their reviewed correct answers. Include only information available before the decision—not the answer itself or a later resolution.</p>
        <div className={styles.actions}><a className={styles.secondary} href="/training/decision-template.csv" download>Download blank CSV</a><a className={styles.textButton} href="/training/support-routing-example.csv" download>Download example CSV</a><button type="button" className={styles.textButton} onClick={() => { void loadExample(); }}>Try the example file</button></div>
        <label htmlFor="decision-csv">Choose your CSV</label><input ref={fileInput} id="decision-csv" type="file" accept=".csv,text/csv" onChange={event => { void readFile(event.target.files?.[0]); }} /><small>UTF-8 comma-separated CSV with a header row · up to 10 MiB, 20,000 examples, and 64 columns.</small>
        <p className={styles.localNote}>Preparation happens in this browser. Nothing is uploaded until you review and submit. Keep your source file; this draft is not saved if you leave or reload.</p>
        {working && <p role="status">Reading your CSV…</p>}
        {csv && <p role="status" className={styles.notice}>{filename}: {csv.rows.length.toLocaleString()} examples, {csv.headers.length} columns. Next, choose what each column means.</p>}
        <details className={styles.details}><summary>My data doesn’t have correct answers yet</summary><p>Add a correct_decision column. Ask someone who knows the task to review each case and choose one of your possible answers. Resolve disagreements before uploading; the model learns from the answers you provide.</p></details>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(0)}>Back</button><button type="button" className={styles.button} disabled={!csv || locked} onClick={() => go(2)}>Match columns</button></div>
      </fieldset>}
      {step === 2 && csv && <form onSubmit={prepare}><fieldset disabled={locked}>
        <p>Choose the information Zils should see and the answer it should learn. We never include the answer column in the model’s input.</p>
        <label htmlFor="answer-column">Which column contains the correct answer?</label><select id="answer-column" required value={mapping.answer} onChange={event => { const answer = event.target.value; setMapping(previous => ({ ...previous, answer, group: previous.group === answer ? '' : previous.group, inputs: previous.inputs.filter(name => name !== answer) })); }}><option value="">Choose a column</option>{csv.headers.map(header => <option key={header}>{header}</option>)}</select>
        <fieldset className={styles.columnChoices}><legend>Which columns are available before the decision?</legend>{csv.headers.map(header => <label key={header} className={styles.checkLabel}><input type="checkbox" disabled={header === mapping.answer || header === mapping.group} checked={mapping.inputs.includes(header)} onChange={event => setMapping(previous => ({ ...previous, inputs: event.target.checked ? [...previous.inputs, header] : previous.inputs.filter(name => name !== header) }))} /><span>{header}<small>{header === mapping.answer ? 'Correct answer — excluded from inputs' : header === mapping.group ? 'Source group — used only to keep records together' : `Example: ${csv.rows[0][csv.headers.indexOf(header)].slice(0,160) || '(empty)'}`}</small></span></label>)}</fieldset>
        <label htmlFor="group-column">Which column identifies related records?</label><select id="group-column" value={mapping.group} onChange={event => { const group = event.target.value; setMapping(previous => ({ ...previous, group, inputs: previous.inputs.filter(name => name !== group) })); setIndependent(false); }}><option value="">Each row is an independent case</option>{csv.headers.filter(header => header !== mapping.answer).map(header => <option key={header}>{header}</option>)}</select>
        <small>Use a conversation, document, order, or other source ID. All rows from the same source stay together so evaluation cannot reuse related training information.</small>
        {!mapping.group && <label className={styles.checkLabel}><input type="checkbox" required checked={independent} onChange={event => setIndependent(event.target.checked)} /><span>I checked that rows do not share a conversation, document, or another related source.</span></label>}
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(1)}>Back</button><button className={styles.button}>{working ? 'Checking and preparing…' : 'Prepare & review'}</button></div>
      </fieldset></form>}
      {step === 3 && prepared && <form onSubmit={submit}><fieldset disabled={locked}>
        <p><strong>{question}</strong><br />{prepared.total.toLocaleString()} examples from {prepared.groups.toLocaleString()} independent source groups.</p>
        <div className={styles.splitSummary}>{SPLITS.map(split => <div key={split}><strong>{prepared.counts[split].toLocaleString()}</strong><span>{splitNames[split]}</span></div>)}</div>
        <p className={styles.help}>We aim for 70% learning, 15% confidence checks, and 15% final evaluation. Actual sizes vary to keep source groups together and every answer represented. Confidence checks tune probability estimates; final evaluation measures performance on cases withheld from fitting.</p>
        <div className={styles.tableWrap} role="region" aria-label="Answer coverage" tabIndex={0}><table><caption>Every answer appears in all three sets.</caption><thead><tr><th>Answer</th>{SPLITS.map(split => <th key={split}>{splitNames[split]}</th>)}</tr></thead><tbody>{prepared.distribution.map(row => <tr key={row.outcome}><th>{row.outcome}</th>{SPLITS.map(split => <td key={split}>{row[split]}</td>)}</tr>)}</tbody></table></div>
        <h4>What the model will see</h4><p className={styles.help}>First {prepared.preview.length} examples. Correct answers are kept separate from the input.</p>
        <div className={styles.previewRows}>{prepared.preview.map((row, index) => <div key={index}><dl>{Object.entries(row.information).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p><span>Correct answer</span><strong>{row.answer}</strong></p></div>)}</div>
        <p className={styles.help}>Small datasets can produce misleading results. These checks catch exact duplicates, not paraphrases, poor labels, or future-information leakage. Keep an independent final evaluation for real deployment decisions.</p>
        <label className={styles.checkLabel}><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I reviewed the answers and selected only information available before the decision. Related records are grouped correctly.</span></label>
        {criteria}
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => go(2)}>Back</button><button className={styles.button} disabled={locked || pending}>{busy ? 'Submitting…' : 'Submit training job'}</button></div>
        <details className={styles.details}><summary>Keep the prepared files</summary><p>Download these private files for inspection or to resume an interrupted upload. Keep them with your original CSV.</p><div className={styles.actions}>{SPLITS.map(split => <button key={split} type="button" className={styles.secondary} onClick={() => {
          const url = URL.createObjectURL(prepared.files[split]); const link = document.createElement('a'); link.href = url; link.download = prepared.files[split].name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download {split}</button>)}</div></details>
      </fieldset></form>}
    </>}
  </section>;
}
