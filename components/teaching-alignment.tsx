'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { assignTeachingSplits, selectTeachingBatch, teachingAccuracy, type TeachingExample, type TeachingPrediction, type TeachingTask } from '@/lib/teach-by-example';
import s from './teach-by-example.module.css';

const sampleAnswers: Record<string, string> = {
  'Could you send me the invoice for last month?': 'Billing',
  'I was charged twice for my subscription.': 'Billing',
  'Where can I update my payment card?': 'Billing',
  'The app crashes whenever I open a file.': 'Technical support',
  'My upload has been stuck for an hour.': 'Technical support',
  'The latest update will not install.': 'Technical support',
  'Please change the email address on my profile.': 'Account changes',
  'I want to update my display name.': 'Account changes',
  'How do I close my account?': 'Account changes',
};

function samplePredictions(rows: TeachingExample[], answers: string[], revised = false): TeachingPrediction[] {
  return rows.map(row => {
    const answer = sampleAnswers[row.input];
    const ambiguous = /invoice|payment card|charged twice/.test(row.input);
    const choice = ambiguous && !revised ? 'Account changes' : answer;
    return { id: row.id, choice, probabilities: Object.fromEntries(answers.map(label => [label, label === choice ? ambiguous && !revised ? .4 : .8 : ambiguous && !revised ? .3 : .1])) };
  });
}

type Session = { sample: boolean; pool: TeachingExample[]; predictions: TeachingPrediction[]; batch: ReturnType<typeof selectTeachingBatch> };
type Proposal = { rules: string; explanation: string; predictions: TeachingPrediction[]; feedback: string };
type Props = {
  task: TeachingTask; examples: TeachingExample[]; independent: boolean;
  onIndependent: () => void; onFreeze: (rows: TeachingExample[]) => void;
  onUpdate: (id: string, patch: Partial<TeachingExample>) => void;
  onApply: (rules: string) => void; onManual: () => void;
};

export function TeachingAlignment({ task, examples, independent, onIndependent, onFreeze, onUpdate, onApply, onManual }: Props) {
  const [config, setConfig] = useState<{ decision: boolean; reflection: boolean; model: { label: string } } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const configController = new AbortController();
    fetch('/api/teaching/align', { signal: configController.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setConfig).catch(() => {});
    return () => { configController.abort(); controller.current?.abort(); };
  }, []);
  const learning = examples.filter(row => row.split === 'train' && !row.excluded);
  const feedback = JSON.stringify(learning.filter(row => row.reviewed).map(row => [row.id, row.output, row.rationale || '']));
  const validProposal = proposal?.feedback === feedback ? proposal : null;
  const active = examples.find(row => row.id === activeId);
  const prediction = session?.predictions.find(p => p.id === activeId);
  const batchDone = Boolean(session?.batch.length && session.batch.every(item => examples.find(row => row.id === item.id)?.reviewed));
  const sampleAvailable = examples.length > 0 && examples.every(row => row.source === 'Sample example' && Object.hasOwn(sampleAnswers, row.input)) && task.answers.length === 3 && ['Billing', 'Technical support', 'Account changes'].every(answer => task.answers.includes(answer));
  const ready = task.goal.trim() && task.answers.length >= 2 && task.answers.length <= 16 && new Set(task.answers).size === task.answers.length && task.answers.every(answer => answer.trim()) && (independent || examples.filter(row => !row.excluded).every(row => row.group.trim()));

  async function call(body: unknown, signal: AbortSignal) {
    const response = await fetch('/api/teaching/align', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not finish this review.');
    return data;
  }
  async function scan(sample: boolean) {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy('Finding examples to review…'); setError(''); setNotice('');
    try {
      const assigned = assignTeachingSplits(examples);
      // Reserve before sending any input, even if a provider later fails or the user cancels.
      onFreeze(assigned);
      const candidates = assigned.filter(row => row.split === 'train' && !row.excluded && !row.reviewed);
      if (!candidates.length) throw new Error('All learning examples are reviewed. Continue to all examples to check the reserved cases.');
      const pool: TeachingExample[] = [];
      let bytes = 0;
      for (const row of candidates.slice(0, 24)) {
        const size = new TextEncoder().encode(JSON.stringify({ id: row.id, input: row.input })).length;
        if (pool.length && bytes + size > 48000) break;
        pool.push(row); bytes += size;
      }
      const predictions: TeachingPrediction[] = sample ? samplePredictions(pool, task.answers) : (await call({ action: 'evaluate', task, examples: pool.map(({ id, input }) => ({ id, input })) }, abort.signal)).predictions;
      if (abort.signal.aborted) return;
      const batch = selectTeachingBatch(assigned, predictions);
      setSession({ sample, pool, predictions, batch }); setActiveId(batch[0]?.id || ''); setProposal(null);
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Could not start assisted review.'); }
    finally { if (controller.current === abort) { controller.current = null; setBusy(''); } }
  }
  async function propose() {
    if (!session || controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy('Proposing rules and comparing decisions…'); setError(''); setNotice('');
    try {
      const reviewed = learning.filter(row => row.reviewed && session.pool.some(p => p.id === row.id));
      const candidate: { rules: string; explanation: string } = session.sample ? {
        rules: 'Use Billing for invoices, duplicate charges, and payment-card changes. Use Technical support for crashes, stuck uploads, and installation problems. Use Account changes for profile details and closing an account. Route by the requested action, not just words such as “update” or “account”.',
        explanation: 'Sample proposal: makes payment-card changes and invoice requests explicit.',
      } : await call({ action: 'propose', task, examples: reviewed.map(row => ({ id: row.id, input: row.input, output: row.output, rationale: row.rationale || '', reviewed: true, split: 'train' })) }, abort.signal);
      const predictions: TeachingPrediction[] = session.sample ? samplePredictions(session.pool, task.answers, true) : (await call({ action: 'evaluate', task: { ...task, rules: candidate.rules }, examples: session.pool.map(({ id, input }) => ({ id, input })) }, abort.signal)).predictions;
      if (!abort.signal.aborted) setProposal({ ...candidate, predictions, feedback });
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Could not propose rules.'); }
    finally { if (controller.current === abort) { controller.current = null; setBusy(''); } }
  }
  function review() {
    if (!active || !task.answers.includes(active.output)) { setError('Choose the answer you would give.'); return; }
    onUpdate(active.id, { reviewed: true }); setError('');
    const next = session?.batch.find(item => item.id !== active.id && !examples.find(row => row.id === item.id)?.reviewed);
    if (next) setActiveId(next.id);
    else setNotice('This batch is reviewed. You can now compare a rule suggestion.');
  }
  const before = teachingAccuracy(examples, session?.predictions || []);
  const after = teachingAccuracy(examples, validProposal?.predictions || []);

  return <section className={s.alignment} aria-label="Assisted teaching">
    <div className={s.alignmentHeading}><Sparkles size={20} /><div><h2>Review a few cases together</h2><p>A few decisions from you can make the task clearer before training.</p></div></div>
    {!session && <>
      <p className={s.hint}>A base model looks at up to 24 learning examples per pass. You review two ambiguous cases and one random check. Calibration and final-test cases stay out of this loop.</p>
      {!independent && examples.some(row => !row.excluded && !row.group.trim()) && <label className={s.checkLabel}><input type="checkbox" onChange={onIndependent} /><span>I checked: each example without a case reference is a separate case.</span></label>}
      {!task.answers.length && <p className={s.hint}>Add the possible answers above to begin.</p>}
      <div className={s.alignmentActions}><button type="button" className={s.primary} disabled={!config?.decision || !ready || Boolean(busy)} onClick={() => void scan(false)}>Find examples to review <ArrowRight size={16} /></button><button type="button" className={s.textButton} disabled={Boolean(busy)} onClick={onManual}>Review manually</button></div>
      <p className={s.hint}>{config?.decision ? `Uses ${config.model.label}. Starting sends learning examples and task instructions to the configured model service. Rule suggestions also send your reviewed answers and explanations to the configured assistant. Provider usage may apply.` : 'Live assisted review needs a connected decision model. Manual review is available.'}</p>
      {sampleAvailable && <button type="button" className={s.secondary} disabled={!ready || Boolean(busy)} onClick={() => void scan(true)}>Try the sample review</button>}
    </>}
    {session && <>
      <div className={s.demoLabel}>{session.sample ? 'Sample walkthrough · fixed predictions and rules, no model calls' : `Live decisions · ${config?.model.label || 'Configured model'}`}</div>
      <p className={s.hint}>{session.pool.length} learning examples scanned · {examples.filter(row => row.split && row.split !== 'train' && !row.excluded).length} examples held aside. “Ambiguous” means the model’s top choices are close; it does not prove an answer is wrong.</p>
      <div className={s.reviewProgress}><strong>{session.batch.filter(item => examples.find(row => row.id === item.id)?.reviewed).length} of {session.batch.length} reviewed</strong><span>No model has been trained yet.</span></div>
      <div className={s.alignmentQueue} aria-label="Review batch">{session.batch.map((item, i) => <button type="button" key={item.id} aria-pressed={activeId === item.id} disabled={Boolean(busy)} onClick={() => setActiveId(item.id)}>{examples.find(row => row.id === item.id)?.reviewed && <Check size={14} />} {i + 1}. {item.reason === 'audit' ? 'Random check' : 'Ambiguous case'}</button>)}</div>
      {active && <div className={s.alignmentExample}>
        <span className={s.hint}>What the model receives</span><p className={s.alignmentInput}>{active.input}</p>
        <p className={s.hint}>Model suggestion: <strong>{prediction?.choice}</strong> · {prediction && Object.entries(prediction.probabilities).map(([label, value]) => `${label} ${Math.round(value * 100)}%`).join(' / ')}</p>
        <label htmlFor="alignment-answer">What is the right answer?</label><select id="alignment-answer" value={active.output} disabled={Boolean(busy)} onChange={e => onUpdate(active.id, { output: e.target.value })}><option value="">Choose an answer</option>{!task.answers.includes(active.output) && active.output && <option value={active.output}>{active.output} — check this answer</option>}{task.answers.map(answer => <option key={answer}>{answer}</option>)}</select>
        <label htmlFor="alignment-rationale">Why? <span className={s.optional}>Optional</span></label><textarea id="alignment-rationale" rows={2} maxLength={1000} disabled={Boolean(busy)} value={active.rationale || ''} onChange={e => onUpdate(active.id, { rationale: e.target.value, reviewed: false })} placeholder="What makes this answer right, even if the example is unclear?" />
        <button type="button" className={s.secondary} disabled={Boolean(busy) || active.reviewed} onClick={review}><Check size={16} />{active.reviewed ? 'Reviewed' : 'Confirm this answer'}</button>
      </div>}
      {batchDone && !validProposal && <div className={s.alignmentActions}><button type="button" className={s.primary} disabled={Boolean(busy) || (!session.sample && !config?.reflection)} onClick={() => void propose()}>Suggest clearer rules <Sparkles size={16} /></button><button type="button" className={s.textButton} disabled={Boolean(busy)} onClick={() => { const batch = selectTeachingBatch(examples, session.predictions); if (batch.length) { setSession({ ...session, batch }); setActiveId(batch[0].id); setProposal(null); setNotice(''); } else void scan(session.sample); }}>Review another batch</button></div>}
      {batchDone && !session.sample && !config?.reflection && <p className={s.hint}>The rules assistant is not connected. Your reviewed answers can still be used for training preparation.</p>}
      {validProposal && <section className={s.ruleProposal} aria-label="Proposed decision rules"><h2>Review the proposed rules</h2><p className={s.hint}>{validProposal.explanation}</p><div className={s.demoComparison}><div><span>Current rules</span><p>{task.rules || 'No rules yet.'}</p></div><div><span>Proposed rules</span><p>{validProposal.rules}</p></div></div>
        <p><strong>{before.correct}/{before.total} → {after.correct}/{after.total}</strong> match your reviewed answers.</p><p className={s.hint}>{session.sample ? 'These are simulated results. ' : ''}This is a check on examples used to write the rules, not an independent quality estimate. The final test is still untouched. A better score never applies rules automatically.</p>
        <div className={s.alignmentActions}><button type="button" className={s.primary} onClick={() => onApply(validProposal.rules)}>Use these rules <Check size={16} /></button><button type="button" className={s.secondary} onClick={() => { setProposal(null); setNotice('Proposal rejected. Your original rules are unchanged.'); }}>Keep my current rules</button></div>
      </section>}
      <div className={s.alignmentActions}><button type="button" className={s.textButton} disabled={Boolean(busy)} onClick={onManual}>Continue to all examples <ArrowRight size={16} /></button></div>
    </>}
    {busy && <div className={s.alignmentActions}><span role="status">{busy}</span><button type="button" className={s.secondary} onClick={() => { controller.current?.abort(); controller.current = null; setBusy(''); setNotice('Stopped. Your examples and current rules are preserved.'); }}>Stop</button></div>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    {notice && <p role="status" className={s.hint}>{notice}</p>}
  </section>;
}
