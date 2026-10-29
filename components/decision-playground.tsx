'use client';

import { useEffect, useRef, useState } from 'react';
import { sessionHeaders } from '@/components/auth-session';
import { curlCommand } from '@/lib/model-quickstart';
import { addQuestion, editorRequest, parseResponse, PRESETS, QUESTION_TYPES, type Answer, type DecisionRequest, type DecisionResponse, type ModelOption } from '@/lib/playground';
import s from '@/components/decision-playground.module.css';

type Run = { request: DecisionRequest; response: DecisionResponse; elapsed: number };
const asText = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const BLANK = -2;
const OWN_QUESTIONS = -1;
const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;

/** One answer: every option as a probability bar, the most likely one highlighted. */
function AnswerCard({ id, question, answer }: { id: string; question: DecisionRequest['questions'][string]; answer: Answer }) {
  const rows = answer.type === 'noul'
    ? [['yes', answer.noul], ['no', 1 - answer.noul]] as const
    : Object.entries(answer.probabilities).map(([key, value]) => [answer.type === 'score' ? `${key} · ${asText(answer.legend[key])}` : key, value] as const);
  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  const headline = answer.type === 'noul' ? (answer.noul >= 0.5 ? 'yes' : 'no') : answer.type === 'choice' ? answer.choice : `${answer.score.toFixed(2)} / ${rows.length - 1}`;
  return <article className={s.answer}>
    <div className={s.answerHead}>
      <span><code>{id}</code> · {answer.type === 'noul' ? 'yes / no' : answer.type}</span>
      {answer.type !== 'noul' && <span>Confidence {percentage(answer.confidence)}</span>}
    </div>
    <h3>{question.instructions == null ? id : asText(question.instructions)}</h3>
    <dl className={s.bars}>
      {sorted.map(([label, value], index) => <div key={label} className={s.bar} data-top={index === 0}>
        <dt title={label}>{label}</dt>
        <dd aria-hidden="true" className={s.track}><div className={s.fill} style={{ width: `${value * 100}%` }} /></dd>
        <dd className={s.pct}>{percentage(value)}</dd>
      </div>)}
    </dl>
    <p className={s.verdict}>→ {headline}</p>
  </article>;
}

export function DecisionPlayground({ configured, model: selected, apiKey, apiUrl, initialRequest }: { configured: boolean; model: ModelOption; apiKey: string; apiUrl: string | null; initialRequest?: DecisionRequest }) {
  // Own models offer only their saved questions; the generic presets belong to the shared model.
  const examples = selected.own ? [] : PRESETS;
  const [preset, setPreset] = useState(initialRequest ? OWN_QUESTIONS : selected.own ? BLANK : 0);
  const [state, setState] = useState(asText(initialRequest?.state ?? (selected.own ? '' : PRESETS[0].state)));
  const [questions, setQuestions] = useState(asText(initialRequest?.questions ?? (selected.own ? {} : PRESETS[0].questions)));
  const model = selected.id;
  const [run, setRun] = useState<Run | null>(null);
  const [view, setView] = useState<'Answers' | 'JSON' | 'API'>('Answers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const active = useRef<AbortController | null>(null);
  const questionsBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => { active.current?.abort(); }, []);

  function changed() { setRun(null); setError(''); setCopied(false); }
  function selectPreset(index: number) {
    changed(); setPreset(index); setView('Answers');
    if (index === BLANK) { setState(''); setQuestions('{}'); return; }
    if (index === OWN_QUESTIONS) { setState(''); setQuestions(asText(selected.questions ?? {})); return; }
    setState(asText(PRESETS[index].state)); setQuestions(asText(PRESETS[index].questions));
  }
  function insert(id: string, question: DecisionRequest['questions'][string]) {
    let added: ReturnType<typeof addQuestion>;
    try { added = addQuestion(questions, id, question); } catch (e) { setError((e as Error).message); return; }
    changed(); setQuestions(added.text);
    // Select the new question's instructions so typing replaces them.
    const at = added.text.indexOf(`"${added.id}": {`);
    const instructions = typeof question.instructions === 'string' ? question.instructions : '';
    const start = instructions ? added.text.indexOf(JSON.stringify(instructions), at) + 1 : at;
    requestAnimationFrame(() => { questionsBox.current?.focus(); questionsBox.current?.setSelectionRange(start, start + instructions.length); });
  }

  async function decide() {
    if (active.current || !configured) return;
    let input: DecisionRequest;
    try {
      input = editorRequest(state, questions, model);
      if (new TextEncoder().encode(JSON.stringify(input)).length > 32_768) throw new Error('Keep state and questions under 32 KB.');
    } catch (e) { setError((e as Error).message); return; }
    if (selected.own && !apiKey) { setError('Paste one of your API keys to run your own model.'); return; }
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setRun(null); setView('Answers'); setCopied(false);
    const start = performance.now();
    try {
      const response = await fetch('/api/playground', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...await sessionHeaders(), ...(selected.own ? { 'X-Zils-Api-Key': apiKey } : {}) }, body: JSON.stringify(input),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The request failed. Try again.');
      if (!controller.signal.aborted) setRun({ request: input, response: parseResponse(result, input), elapsed: performance.now() - start });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error && e.name === 'TimeoutError' ? 'The model took too long. Try again later.' : e instanceof Error ? e.message : 'Could not reach the model. Try again.');
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }

  let requestCode = apiUrl ? 'Fix the questions JSON to generate an API request.' : 'The Zils API address is not configured for this site.';
  try { if (apiUrl) requestCode = curlCommand(apiUrl, editorRequest(state, questions, model)); }
  catch { /* The editor error is shown when Run is pressed. */ }
  const code = view === 'API' ? requestCode : run ? JSON.stringify(run.response, null, 2) : '';

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setError('Clipboard access is unavailable. Select and copy the code directly.'); }
  }

  const status = busy ? 'Running · times out after 60 s' : run ? `${Object.keys(run.response.answers).length} answers` : configured ? 'Ready' : 'Not connected';
  const tone = busy ? 'busy' : configured ? 'ready' : 'off';

  return <div className={s.layout}>
    <form className={`${s.pane} ${s.editor}`} onSubmit={e => { e.preventDefault(); void decide(); }} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void decide(); } }}>
      <div className={s.modelLine}>
        <strong><span className={s.dot} data-tone={configured ? 'ready' : 'off'} aria-hidden="true" />{selected.label}</strong>
        <span>{selected.own ? 'Your model · runs with your API key' : 'Shared model'}</span>
      </div>
      <fieldset disabled={busy}>
        <div className={s.field}>
          <label htmlFor="decision-example" className={`${s.label} ${s.labelRow}`}>Example</label>
          <select id="decision-example" className={s.select} value={preset} onChange={e => selectPreset(Number(e.target.value))}>
            {selected.questions && <option value={OWN_QUESTIONS}>Your model’s questions</option>}
            {examples.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
            <option value={BLANK}>Start blank</option>
          </select>
          {preset >= 0 ? <p className={s.hint}>{PRESETS[preset].description}</p> : preset === BLANK ? <p className={s.hint}>Paste your own context, then add questions below.</p> : selected.questions && <p className={s.hint}>The questions this model learned. Paste an input like the ones it was trained on.</p>}
        </div>
        <div className={s.field}>
          <label htmlFor="decision-state" className={`${s.label} ${s.labelRow}`}>Context <span>text or JSON the model reads</span></label>
          <textarea id="decision-state" spellCheck={false} value={state} onChange={e => { changed(); setState(e.target.value); }} className={`${s.textarea} ${s.context}`} />
        </div>
        <div className={s.field}>
          <div className={s.labelRow}>
            <label htmlFor="decision-questions" className={s.label}>Decisions <span>yes/no, choice, or score</span></label>
            <button type="button" className={s.textButton} onClick={() => {
              try { setQuestions(JSON.stringify(JSON.parse(questions), null, 2)); setError(''); } catch { setError('Questions must be valid JSON before formatting.'); }
            }}>Format JSON</button>
          </div>
          <div className={s.picker} role="group" aria-label="Add a question">
            <span>Add a question</span>
            {Object.entries(selected.questions ?? {}).map(([id, q]) => <button type="button" key={id} className={s.chip} data-own title="A question this model learned" onClick={() => insert(id, q)}>+ {id}</button>)}
            {QUESTION_TYPES.map(t => <button type="button" key={t.id} className={s.chip} title={t.hint} onClick={() => insert(t.id, t.template)}>+ {t.label}</button>)}
          </div>
          <textarea ref={questionsBox} id="decision-questions" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={questions} onChange={e => { changed(); setQuestions(e.target.value); }} className={`${s.textarea} ${s.questions}`} />
        </div>
      </fieldset>
      {error && <p role="alert" className={s.error}>{error}</p>}
      <div className={s.actions}>
        <button type="submit" disabled={busy || !configured} className={s.run}>{busy ? 'Deciding…' : 'Run decisions'}<kbd aria-hidden="true">⌘ ↵</kbd></button>
        {busy && <button type="button" className={s.secondary} onClick={() => { active.current?.abort(); setError('Request canceled.'); }}>Cancel</button>}
      </div>
      <p className={s.note}>Run sends your input to Zils’s model server. Use non-sensitive examples.</p>
    </form>

    <section aria-label="Decision results" aria-busy={busy} className={`${s.pane} ${s.results}`}>
      <div className={s.resultsHeader}>
        <div role="tablist" aria-label="Result view" className={s.tabs}>{(['Answers', 'JSON', 'API'] as const).map(tab => <button type="button" role="tab" key={tab} aria-selected={view === tab} className={s.tab} onClick={() => { setView(tab); setCopied(false); }}>{tab}</button>)}</div>
        {code && view !== 'Answers' ? <button type="button" className={s.textButton} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
          : <p role="status" className={s.status}><span className={s.dot} data-tone={tone} aria-hidden="true" />{status}</p>}
      </div>
      <div className={s.resultsBody}>
        {view === 'API' ? <>
          <p className={s.lead}>Send the same context and typed decisions from your own code. Set <code>ZILS_API_KEY</code> to one of your API keys.</p>
          <pre className={s.code}><code>{requestCode}</code></pre>
        </> : run ? <>
          <p className={s.meta}>
            <span>{run.response.model}</span>{run.response.latency_ms !== undefined && <span>{Math.round(run.response.latency_ms).toLocaleString()} ms model time</span>}<span>{run.response.usage.input_tokens.toLocaleString()} input tokens</span><span>{(run.elapsed / 1000).toFixed(1)} s total</span>
          </p>
          {view === 'JSON' ? <pre className={s.code}><code>{code}</code></pre> : <>
            {Object.entries(run.response.answers).map(([id, answer]) => <AnswerCard key={id} id={id} question={run.request.questions[id]} answer={answer} />)}
            <p className={s.footnote}>Bars show each option’s probability. Confidence is a separate model statistic, not a guarantee of correctness.</p>
          </>}
        </> : <div className={s.empty}>
          <div>
            <h2>{busy ? 'Reading your decisions…' : configured ? 'No answers yet' : 'The Zils endpoint isn’t connected'}</h2>
            <p>{busy ? 'Answers appear here when the model finishes.' : configured ? 'Pick an example or write your own, then run it to see the probability of every option.' : 'You can still explore the examples and copy the API request. Live answers appear once the model endpoint is connected.'}</p>
          </div>
        </div>}
      </div>
    </section>
  </div>;
}
