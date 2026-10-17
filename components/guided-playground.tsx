'use client';

import { sessionHeaders } from '@/components/auth-session';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, MessageSquare, ListFilter, SlidersHorizontal, Bookmark, Code2 } from 'lucide-react';
import { curlCommand } from '@/lib/model-quickstart';
import { CopyField } from './trained-model-quickstart';
import { parseResponse, type DecisionRequest, type DecisionResponse, type ModelOption } from '@/lib/playground';
import { parseSetup, parseSetupReply, setupRequest, STARTERS, type SetupDraft, type SetupMessage, type SetupReply } from '@/lib/decision-setup';
import { DecisionPlayground } from './decision-playground';
import { SetupQuestionEditor } from './setup-question-editor';
import { SetupDictation } from './setup-dictation';
import { SetupResults } from './setup-results';
import { ZilsSymbol } from './zils-symbol';
import s from './guided-playground.module.css';

const SAVED = 'zils-saved-decision-setup-v1';
const STAGES = ['Describe', 'Review questions', 'Try an example'];

export function GuidedPlayground({ configured, assistantConfigured, models: shared, apiUrl, initialStarterId }: { configured: boolean; assistantConfigured: boolean; models: ModelOption[]; apiUrl: string | null; initialStarterId?: string }) {
  const [models, setModels] = useState(shared);
  const [modelId, setModelId] = useState(shared[0].id);
  // The customer's own key lives only in this component's memory: never stored, logged or put in a URL.
  const [apiKey, setApiKey] = useState('');
  const [ran, setRan] = useState<DecisionRequest | null>(null);
  const model = models.find(m => m.id === modelId) ?? models[0];
  const initialStarter = STARTERS.find(starter => starter.id === initialStarterId);
  const [stage, setStage] = useState(initialStarter ? 1 : 0);
  const [goal, setGoal] = useState(initialStarter?.goal ?? '');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<SetupMessage[]>([]);
  const [clarification, setClarification] = useState<Extract<SetupReply, { kind: 'clarify' }> | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(() => initialStarter ? structuredClone(initialStarter.draft) : null);
  const [source, setSource] = useState(initialStarter ? 'Starter template' : '');
  const [revision, setRevision] = useState('');
  const [example, setExample] = useState(initialStarter?.example ?? '');
  const [sample, setSample] = useState(initialStarter?.example ?? '');
  const [response, setResponse] = useState<DecisionResponse | null>(null);
  const [busy, setBusy] = useState<'assistant' | 'model' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [advancedInput, setAdvancedInput] = useState<{ version: number; request?: DecisionRequest } | null>(null);
  const active = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const visited = useRef(false);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await fetch('/api/playground', { headers: await sessionHeaders(), signal: controller.signal });
        const body = await result.json();
        if (result.ok && Array.isArray(body.models) && body.models.length) setModels(body.models);
      } catch { /* The shared model stays available. */ }
    })();
    return () => controller.abort();
  }, []);
  useEffect(() => { if (visited.current) heading.current?.focus(); visited.current = true; }, [stage]);

  function move(next: number) { setStage(next); setError(''); setNotice(''); }
  function edit(value: SetupDraft) { setDraft(value); setResponse(null); setError(''); setNotice(''); }
  function selectStarter(index: number) {
    const starter = STARTERS[index];
    setDraft(structuredClone(starter.draft)); setGoal(starter.goal);
    setExample(starter.example); setSample(starter.example); setSource('Starter template');
    setMessages([]); setClarification(null); setReply(''); setResponse(null); setRevision(''); move(1);
  }
  function review() {
    try { setDraft(parseSetup(draft)); move(2); }
    catch (e) { setError((e as Error).message); }
  }
  function save() {
    try {
      const valid = parseSetup(draft);
      localStorage.setItem(SAVED, JSON.stringify({ version: 1, draft: valid }));
      setNotice('Saved on this browser. Your example and conversation were not saved.'); setError('');
    } catch (e) { setError(e instanceof DOMException ? 'Browser storage is unavailable. Your current questions are still here.' : (e as Error).message); }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(SAVED);
      if (!raw) { setNotice('No saved setup yet. Choose a starter or describe your goal.'); return; }
      const saved = JSON.parse(raw);
      if (saved.version !== 1) throw new Error('Saved setup is not compatible. Start with a template.');
      setDraft(parseSetup(saved.draft)); setSource('Saved setup'); setGoal('');
      setExample(''); setSample(''); setMessages([]); setClarification(null); setResponse(null); move(1);
    } catch { setError('Could not open the saved setup. Choose a starter to begin again.'); }
  }
  function cancel() {
    active.current?.abort(); active.current = null; setBusy(null); setNotice('Canceled. Your questions are unchanged.');
  }

  async function suggest(content: string, revising = false, fresh = false) {
    if (active.current || !assistantConfigured) return;
    if (!content.trim()) { setError('Describe what you would like help with.'); return; }
    let currentDraft;
    if (draft && (revising || clarification)) {
      try { currentDraft = parseSetup(draft); } catch (e) { setError((e as Error).message); return; }
    }
    const history: SetupMessage[] = fresh ? [] : revising ? [{ role: 'user', content: goal || draft!.title }] : messages;
    const next: SetupMessage[] = [...history, { role: 'user', content: content.trim() }];
    if (next.length > 12) { setError('This conversation is full. Start again with a more specific goal; your draft is preserved.'); return; }
    const controller = new AbortController(); active.current = controller;
    setBusy('assistant'); setError(''); setNotice('');
    try {
      const result = await fetch('/api/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...await sessionHeaders() },
        body: JSON.stringify({ messages: next, ...(currentDraft ? { draft: currentDraft } : {}) }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The assistant could not finish. Try again.');
      const answer = parseSetupReply(body);
      if (controller.signal.aborted) return;
      setMessages([...next, { role: 'assistant', content: answer.message }]); setReply('');
      if (answer.kind === 'clarify') { setClarification(answer); setStage(0); }
      else {
        setDraft(answer.draft); setSource('AI suggestion · review before use'); setClarification(null);
        setResponse(null); setRevision(''); setStage(1); setNotice(answer.message);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error && e.name === 'TimeoutError' ? 'The assistant took too long. Try again or choose a starter.' : e instanceof Error ? e.message : 'The assistant could not finish. Your questions are unchanged.');
    } finally { if (active.current === controller) { active.current = null; setBusy(null); } }
  }
  async function run(event: FormEvent) {
    event.preventDefault();
    if (active.current || !configured) return;
    let input;
    try { input = setupRequest(draft, example, model.id); }
    catch (e) { setError((e as Error).message); return; }
    if (model.own && !apiKey) { setError('Paste one of your API keys to run your own model.'); return; }
    const controller = new AbortController(); active.current = controller;
    setBusy('model'); setError(''); setNotice(''); setResponse(null);
    try {
      const result = await fetch('/api/playground', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...await sessionHeaders(), ...(model.own ? { 'X-Zils-Api-Key': apiKey } : {}) }, body: JSON.stringify(input),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The model could not finish. Try again.');
      if (body.model !== input.model) throw new Error('The connected model returned a different model identifier. Try again later.');
      const resultData = parseResponse(body, input);
      if (!controller.signal.aborted) { setResponse(resultData); setRan(input); setNotice('Your example is ready to review.'); }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error && e.name === 'TimeoutError' ? 'The model took too long. Try a shorter example.' : e instanceof Error ? e.message : 'The model could not finish. Try again.');
    } finally { if (active.current === controller) { active.current = null; setBusy(null); } }
  }
  function openAdvanced() {
    try {
      const request = draft ? setupRequest(draft, example || 'Paste your example here.', model.id) : undefined;
      setAdvancedInput({ version: Date.now(), request }); setAdvanced(true); setError('');
    } catch (e) { setError((e as Error).message); }
  }

  return <div className={s.root}>
    <div className={s.workspaceBar}>
      <span className={s.workspaceTitle}><span className={s.zilMark}><ZilsSymbol /></span>{advanced ? 'Advanced playground' : 'Build a decision'}</span>
      <button type="button" disabled={Boolean(busy)} className={s.quietButton} onClick={advanced ? () => setAdvanced(false) : openAdvanced}><Code2 size={16} />{advanced ? 'Back to guided setup' : 'Advanced editor'}</button>
    </div>
    <div className={s.modelBar}>
      <div><label className={s.label} htmlFor="playground-model">Model</label>
        <select id="playground-model" className={s.input} value={model.id} disabled={Boolean(busy)} onChange={e => { setModelId(e.target.value); setResponse(null); setError(''); }}>
          {models.map(m => <option key={m.id} value={m.id}>{m.own ? `${m.label} · your model` : m.label}</option>)}
        </select></div>
      {model.own && <div><label className={s.label} htmlFor="playground-key">Your API key</label>
        <input id="playground-key" className={s.input} type="password" autoComplete="off" spellCheck={false} placeholder="zils_sk_…" value={apiKey} disabled={Boolean(busy)} onChange={e => setApiKey(e.target.value.trim())} />
        <p className={s.helper}>Used for this tab only and never saved. <Link href="/keys">Create a key</Link></p></div>}
    </div>
    <div hidden={advanced}>
      <nav aria-label="Setup progress" className={s.steps}>{STAGES.map((label, i) => <button type="button" key={label} aria-current={stage === i ? 'step' : undefined} disabled={Boolean(busy) || i > stage && (!draft || i === 2)} onClick={() => move(i)}>
        <span>{i < stage ? <Check size={14} /> : i + 1}</span>{label}
      </button>)}</nav>
      <div className={s.layout}>
        <section className={s.main} aria-busy={Boolean(busy)}>
          <h2 ref={heading} tabIndex={-1} className={s.stageTitle}>{stage === 0 ? clarification ? 'One detail will help.' : 'Tell us what you have in mind.' : stage === 1 ? 'Make these questions yours.' : 'Try your questions on one example.'}</h2>
          <p className={s.intro}>{stage === 0 ? 'Describe a task the way you would explain it to a teammate.' : stage === 1 ? 'Edit the wording and answers. You know your work best.' : 'Paste something Zils would see in your day-to-day work.'}</p>

          {stage === 0 && <>
            {clarification ? <div className={s.clarification}>
              <p className={s.previousGoal}>{goal}</p><p className={s.followup}>{clarification.message}</p>
              <div className={s.chips}>{clarification.choices.map(choice => <button type="button" key={choice} disabled={Boolean(busy)} onClick={() => void suggest(choice)}>{choice}</button>)}</div>
              <form onSubmit={e => { e.preventDefault(); void suggest(reply); }}>
                <label className={s.label} htmlFor="setup-reply">Your answer</label>
                <input id="setup-reply" className={s.input} value={reply} maxLength={6000} disabled={Boolean(busy)} onChange={e => setReply(e.target.value)} placeholder="Or tell us in your own words" />
                <button className={s.primary} disabled={Boolean(busy) || !reply.trim()}>{busy ? 'Thinking…' : 'Continue'}<ArrowRight size={17} /></button>
              </form>
              <button type="button" disabled={Boolean(busy)} className={s.textButton} onClick={() => { setMessages([]); setClarification(null); setError(''); }}>Start again with my goal</button>
            </div> : <form onSubmit={e => { e.preventDefault(); void suggest(goal, false, true); }}>
              <div className={s.composer}>
                <label className={s.srOnly} htmlFor="setup-goal">What would you like Zils to help with?</label>
                <textarea id="setup-goal" maxLength={6000} rows={4} disabled={Boolean(busy)} placeholder="I want to sort customer emails and flag anything urgent…" value={goal} onChange={e => setGoal(e.target.value)} />
                <SetupDictation disabled={Boolean(busy)} onText={text => setGoal(value => `${value}${value ? ' ' : ''}${text}`.slice(0, 6000))} />
              </div>
              <div className={s.composerActions}><button className={s.primary} disabled={!assistantConfigured || Boolean(busy) || !goal.trim()}>{busy === 'assistant' ? 'Thinking…' : 'Suggest my questions'}<ArrowRight size={17} /></button>
                <span className={s.helper}>{assistantConfigured ? 'Your description goes to the setup assistant.' : 'Assistant not connected. Start with a template below.'}</span></div>
            </form>}

            <div className={s.starters}>
              <h3>Or start with something familiar</h3>
              {STARTERS.map((starter, i) => <button type="button" key={starter.name} disabled={Boolean(busy)} onClick={() => selectStarter(i)}>
                <span className={s.starterIcon}>{i === 0 ? <MessageSquare size={19} /> : i === 1 ? <ListFilter size={19} /> : <SlidersHorizontal size={19} />}</span>
                <span><strong>{starter.name}</strong><small>{starter.description}</small></span><ArrowRight size={17} />
              </button>)}
              <button type="button" className={s.restore} disabled={Boolean(busy)} onClick={restore}><Bookmark size={16} />Open saved setup</button>
            </div>
          </>}

          {stage === 1 && draft && <>
            <div className={s.source}>{source}</div>
            <SetupQuestionEditor draft={draft} onChange={edit} disabled={Boolean(busy)} />
            {assistantConfigured && <form className={s.revision} onSubmit={e => { e.preventDefault(); void suggest(revision, true); }}>
              <label className={s.label} htmlFor="setup-revision">Describe a change</label>
              <textarea id="setup-revision" rows={2} className={s.input} disabled={Boolean(busy)} value={revision} maxLength={6000} onChange={e => setRevision(e.target.value)} placeholder="For example, urgent means the customer cannot use the product." />
              <button className={s.secondary} disabled={Boolean(busy) || !revision.trim()}>{busy === 'assistant' ? 'Updating…' : 'Update suggestions'}</button>
            </form>}
            <div className={s.actions}><button type="button" className={s.primary} disabled={Boolean(busy)} onClick={review}>Try an example<ArrowRight size={17} /></button><button type="button" disabled={Boolean(busy)} className={s.quietButton} onClick={save}><Bookmark size={16} />Save setup</button></div>
            <p className={s.helper}>Saving keeps the questions on this browser. It does not train or publish a model.</p>
          </>}

          {stage === 2 && draft && <>
            <form onSubmit={run}>
              <label className={s.label} htmlFor="setup-example">Example to read</label>
              <textarea id="setup-example" className={`${s.input} ${s.example}`} rows={7} maxLength={32768} disabled={Boolean(busy)} value={example} placeholder="Paste a customer message or another real situation…" onChange={e => { setExample(e.target.value); setResponse(null); setError(''); setNotice(''); }} />
              <div className={s.exampleMeta}><span className={s.helper}>{model.label}</span>{sample && <button type="button" disabled={Boolean(busy)} className={s.textButton} onClick={() => { setExample(sample); setResponse(null); setError(''); }}>Use sample message</button>}</div>
              {!configured && <p className={s.connection}>Live predictions are not connected in this preview. You can edit and save your setup.</p>}
              <div className={s.actions}><button className={s.primary} disabled={!configured || Boolean(busy) || !example.trim()}>{busy === 'model' ? 'Reading your example…' : 'Run example'}<ArrowRight size={17} /></button><button type="button" disabled={Boolean(busy)} className={s.quietButton} onClick={() => move(1)}>Edit questions</button></div>
              <p className={s.helper}>Running sends this example and your questions to Zils. Use a non-sensitive example.</p>
            </form>
            {response && <><SetupResults draft={draft} response={response} />
              {ran && apiUrl && <div className={s.curl}><h3>Call this from your code</h3><p className={s.helper}>The same request against the Zils API. Set <code>ZILS_API_KEY</code> to one of your API keys.</p><CopyField label="Request as curl" value={curlCommand(apiUrl, ran)} language="bash" /></div>}<div className={s.actions}><button type="button" className={s.primary} onClick={save}>Looks right · Save setup<Check size={17} /></button><button type="button" className={s.secondary} onClick={() => move(1)}>Adjust setup</button></div></>}
          </>}
          {busy && <button type="button" className={s.textButton} onClick={cancel}>Cancel request</button>}
          {error && <p role="alert" aria-label="Setup error" className={s.error}>{error}</p>}
          <p role="status" className={s.notice}>{notice || (busy ? busy === 'assistant' ? 'The assistant is preparing your questions…' : 'Zils is reading your example…' : '')}</p>
        </section>

        <aside className={s.aside} aria-label="Setup summary">
          <div className={s.preview}>
            <div className={s.previewHeading}><span className={s.smallMark}><ZilsSymbol /></span><span>{draft ? 'Your decision setup' : 'A sentence becomes a setup'}</span></div>
            {!draft && <p className={s.exampleGoal}>“Help me sort customer emails.”</p>}
            <h3>{draft ? draft.title || 'Untitled setup' : 'Customer message routing'}</h3>
            {(draft?.questions || STARTERS[0].draft.questions).map((q, i) => <div className={s.previewQuestion} key={q.id}><span>{i + 1}</span><div><p>{q.prompt || 'Your question goes here'}</p><div className={s.previewOptions}>{(q.kind === 'yes_no' ? ['Yes', 'No'] : q.options.map(o => o.label || 'Answer')).map((label, j) => <span key={j}>{label}</span>)}</div></div></div>)}
            <div className={s.previewFooter}><Check size={15} />{draft ? 'You can change every question and answer.' : 'Questions and answers you can edit.'}</div>
          </div>
          <div className={s.asideNote}><h3>{stage === 2 ? 'One example is a starting point.' : 'No special wording needed.'}</h3><p>{stage === 2 ? 'Try several different cases, including tricky ones. A good result on one example does not establish model quality.' : 'Zils works with yes/no decisions, named choices, and scales. Start with the task you already do.'}</p></div>
        </aside>
      </div>
    </div>
    {advancedInput && <div hidden={!advanced} className={s.advanced}>
      <p className={s.helper}>This editor starts with your guided questions. Changes here stay in the advanced editor until you open it again from guided setup.</p>
      <DecisionPlayground key={advancedInput.version} configured={configured} model={model} apiKey={apiKey} apiUrl={apiUrl} initialRequest={advancedInput.request} />
    </div>}
  </div>;
}
