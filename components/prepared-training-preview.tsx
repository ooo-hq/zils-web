'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCheck, FileCheck2 } from 'lucide-react';
import { acceptanceSchema, MAX_DATASET_BYTES, SPLITS, submissionSchema, validateDatasets, type Split } from '@/lib/training';
import s from './teach-by-example.module.css';

const names = {train:'Training',calibration:'Calibration',test:'Evaluation'};
export function PreparedTrainingPreview({ onGuided }: { onGuided: () => void }) {
  const [files,setFiles] = useState<Partial<Record<Split,File>>>({});
  const [name,setName] = useState('');
  const [accuracy,setAccuracy] = useState('80'), [improvement,setImprovement] = useState('0.01');
  const [counts,setCounts] = useState<Record<Split,number> | null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  function invalidate() { setCounts(null); setError(''); }
  async function validate(event: FormEvent) {
    event.preventDefault(); setBusy(true); invalidate();
    try {
      submissionSchema.shape.name.parse(name);
      acceptanceSchema.parse({min_accuracy:Number(accuracy)/100,min_brier_improvement:Number(improvement)});
      if (SPLITS.some(split => !files[split])) throw new Error('Choose all three prepared datasets.');
      setCounts(await validateDatasets(files as Record<Split,File>));
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not validate these datasets.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Prepared training" aria-busy={busy}>
    <div className={s.progressLine}><span>Direct training</span><span>Prepared datasets</span></div>
    <h1>Bring your data. Skip the walkthrough.</h1>
    <p className={s.intro}>Already have reviewed examples and separate test sets? Check your files and run settings here.</p>
    <form onSubmit={validate}><fieldset disabled={busy}>
      <div className={s.pairFields}><div><label htmlFor="prepared-run-name">Run name</label><input id="prepared-run-name" required pattern="[a-z0-9][a-z0-9-]{0,63}" maxLength={64} placeholder="support-routing-v1" value={name} onChange={event => {setName(event.target.value);invalidate();}} /></div><div className={s.preparedModel}><span>Training type</span><strong>Text decisions</strong><small>The connected training service selects the starting model.</small></div></div>
      <div className={s.preparedFiles}>{SPLITS.map(split => <div key={split}><FileCheck2 size={19} /><label htmlFor={`prepared-${split}`}>{names[split]} dataset</label><p>{split === 'train' ? 'Examples the model learns from.' : split === 'calibration' ? 'Independent confidence checks.' : 'Unseen cases for the final test.'}</p><input id={`prepared-${split}`} type="file" accept=".jsonl,.ndjson" required={!files[split]} onChange={event => { const file=event.target.files?.[0]; setFiles(previous => ({...previous,[split]:file})); invalidate(); if(file && file.size > MAX_DATASET_BYTES) setError(`${names[split]}: choose a file smaller than 128 MiB.`); }} /><small>{files[split]?.name || 'JSONL / NDJSON · Up to 128 MiB'}</small></div>)}</div>
      <details className={s.details}><summary>Prepared dataset format</summary><p className={s.hint}>One reviewed case per line, with id, group_id, family, state, question, and label. IDs must be unique. Related cases and identical prompts must stay within one dataset.</p><pre className={s.formatExample}>{'{"id":"case-1","group_id":"ticket-1","family":"routing","state":{"message":"Send my invoice"},"question":{"type":"choice","criteria":{"billing":"Payments","support":"Product issues"}},"label":"billing"}'}</pre><button type="button" className={s.textButton} onClick={onGuided}>Have CSV, Excel, or JSON? Prepare examples with the guided flow.</button></details>
      <div className={s.pairFields}><div><label htmlFor="prepared-accuracy">Minimum accuracy (%)</label><input id="prepared-accuracy" type="number" required min="0" max="100" step="any" value={accuracy} onChange={event => {setAccuracy(event.target.value);invalidate();}} /></div><div><label htmlFor="prepared-improvement">Minimum Brier improvement</label><input id="prepared-improvement" type="number" required min="0" max="2" step="any" value={improvement} onChange={event => {setImprovement(event.target.value);invalidate();}} /></div></div>
      <p className={s.hint}>A lower Brier loss means better probability estimates. The trained model must meet both thresholds on separate evaluation data.</p>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.actions}><span className={s.hint}>Validation runs locally. No uploads or charges.</span><button className={s.primary}>{busy ? 'Checking datasets…' : 'Validate and review'}<ArrowRight size={16} /></button></div>
    </fieldset></form>
    {counts && <section aria-label="Prepared run review" className={s.preparedReview}>
      <div className={s.ready} role="status"><CheckCheck size={21} /><div><strong>Your files pass the dataset checks.</strong><p>Format, labels, source groups, and overlap checked. This does not measure model quality or verify the answers themselves.</p></div></div>
      <div className={s.splitOverview}>{SPLITS.map(split => <div key={split}><strong>{counts[split]}</strong><span>{names[split]} examples</span></div>)}</div>
      <dl className={s.runSummary}><div><dt>Run</dt><dd>{name}</dd></div><div><dt>Minimum accuracy</dt><dd>{accuracy}%</dd></div><div><dt>Minimum Brier improvement</dt><dd>{improvement}</dd></div><div><dt>Price and starting model</dt><dd>Available when connected to training</dd></div></dl>
      <p className={s.hint}>This local preview stops before sign-in, pricing, and job submission. Opening the training dashboard does not transfer these files or start a run.</p>
      <Link className={s.secondary} href="/train" target="_blank" rel="noreferrer">Open training dashboard <ArrowRight size={15} /></Link>
    </section>}
  </section>;
}
