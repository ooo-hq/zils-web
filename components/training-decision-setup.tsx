'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ImageIcon, MessageSquareText, Sparkles } from 'lucide-react';
import { parseSetupReply, type SetupMessage } from '@/lib/decision-setup';
import styles from './training-onboarding.module.css';

type Props = {
  kind: 'text' | 'images';
  question: string;
  answers: string;
  onQuestion: (value: string) => void;
  onAnswers: (value: string) => void;
  assistantConfigured?: boolean;
};
const starters = {
  text: [
    { title: 'Route support tickets', question: 'Which team should handle this support ticket?', answers: 'Billing\nTechnical support\nAccount changes' },
    { title: 'Sort customer feedback', question: 'What is this customer feedback about?', answers: 'Product quality\nDelivery\nCustomer service' },
  ],
  images: [
    { title: 'Spot visible damage', question: 'Does this product show visible damage?', answers: 'Normal\nDamaged' },
    { title: 'Organize property photos', question: 'Which room is shown in this photo?', answers: 'Kitchen\nBathroom\nBedroom\nLiving room' },
  ],
};

export function TrainingDecisionSetup({ kind, question, answers, onQuestion, onAnswers, assistantConfigured = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [clarification, setClarification] = useState<{ message: string; choices: string[] } | null>(null);
  const [reply, setReply] = useState('');
  const history = useRef<SetupMessage[]>([]);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const options = answers.split('\n').map(value => value.trim()).filter(Boolean);
  async function assist(answer?: string) {
    if (busy || !question.trim()) return;
    const controller = new AbortController(); operation.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 35000);
    const messages: SetupMessage[] = answer ? [...history.current, { role: 'user', content: answer }] : [{ role: 'user', content: `Help me set up ${kind === 'images' ? 'image' : 'text'} training. Create exactly one choice question with 2–16 short, self-contained answer labels. Ask a clarification if needed. Do not invent training examples or correct answers. My goal: ${question}${answers.trim() ? `\nPossible answers: ${answers.slice(0, 3000)}` : ''}` }];
    setBusy(true); setError(''); setNote('');
    try {
      const response = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages.length > 11 ? [messages[0], ...messages.slice(-10)] : messages }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Setup help is unavailable. You can write your decision and answers below.');
      let result;
      try { result = parseSetupReply(data); } catch { throw new Error('The setup suggestion could not be read. Your draft is unchanged; try again or continue manually.'); }
      if (controller.signal.aborted) return;
      if (result.kind === 'clarify') {
        history.current = [...messages, { role: 'assistant', content: result.message }];
        setClarification(result); setReply('');
      } else {
        if (result.draft.questions.length !== 1 || result.draft.questions[0].kind !== 'choice') throw new Error('Training needs one decision with a fixed list of answers. Your draft is unchanged; narrow the goal and try again.');
        const decision = result.draft.questions[0];
        onQuestion(decision.prompt); onAnswers(decision.options.map(option => option.label).join('\n'));
        setClarification(null); history.current = []; setNote('Setup suggested. Edit the decision and answers to match your examples.');
      }
    } catch (error) {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError(controller.signal.aborted ? 'Setup help timed out. Try again or continue with your own decision.' : error instanceof Error ? error.message : 'Could not suggest a setup. Your draft is unchanged.');
    } finally { clearTimeout(timer); if (operation.current === controller) { operation.current = null; setBusy(false); } }
  }
  function applyStarter(item: (typeof starters)[typeof kind][number]) {
    onQuestion(item.question); onAnswers(item.answers); setClarification(null); setNote('Example setup added. Replace it with your own decision whenever you like.'); setError(''); history.current = [];
  }
  return <div className={styles.setup}>
    <p className={styles.intro}>Describe one decision you make repeatedly. We’ll help turn it into a question your model can learn.</p>
    <div className={styles.starters}><p>Try a starting point:</p>{starters[kind].map(item => <button type="button" key={item.title} disabled={busy} onClick={() => applyStarter(item)}><span>{item.title}</span></button>)}</div>
    <div className={styles.composer}>
      <label htmlFor={`${kind}-decision`}>{kind === 'images' ? 'Image training decision' : 'The decision'}</label>
      <textarea id={`${kind}-decision`} required maxLength={1000} rows={3} disabled={busy} placeholder={kind === 'images' ? 'I want to spot damaged products in inspection photos…' : 'I want to send each support ticket to the right team…'} value={question} onChange={event => { onQuestion(event.target.value); setClarification(null); setNote(''); }} />
      {assistantConfigured && <div className={styles.assistBar}><span>Start in your own words.</span><button type="button" disabled={busy || !question.trim()} onClick={() => void assist()}><Sparkles size={16} aria-hidden="true" />{busy ? 'Helping with setup…' : 'Help me set this up'}</button></div>}
    </div>
    {clarification && <div className={styles.clarification}><p>{clarification.message}</p><div className={styles.suggestions}>{clarification.choices.map(choice => <button key={choice} type="button" disabled={busy} onClick={() => void assist(choice)}>{choice}</button>)}</div><label htmlFor={`${kind}-clarification`}>Your reply</label><input id={`${kind}-clarification`} value={reply} maxLength={2000} disabled={busy} onChange={event => setReply(event.target.value)} /><button type="button" disabled={busy || !reply.trim()} onClick={() => void assist(reply)}>Send reply</button></div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {note && <p role="status" className={styles.note}>{note}</p>}
    <div className={styles.answers}>
      <label htmlFor={`${kind}-answers`}>{kind === 'images' ? 'Image training answers' : 'Possible answers (optional)'}</label>
      <textarea id={`${kind}-answers`} required={kind === 'images'} rows={3} disabled={busy} value={answers} onChange={event => onAnswers(event.target.value)} placeholder={kind === 'images' ? 'Normal\nDamaged' : 'Billing\nTechnical support\nAccount changes'} />
      <small>{kind === 'images' ? 'Add 2–16 answers, one per line. Your photos will use these labels.' : 'One answer per line. Leave blank to use answers from your spreadsheet.'}</small>
    </div>
    <aside className={styles.preview} aria-label="What your model will learn"><div className={styles.previewTitle}>{kind === 'images' ? <ImageIcon size={18} aria-hidden="true" /> : <MessageSquareText size={18} aria-hidden="true" />}What your model will learn</div><p>{question || 'Your decision goes here.'}</p><div className={styles.previewFlow}><span>{kind === 'images' ? 'A photo' : 'A text example'}</span><ArrowRight size={16} aria-hidden="true" /><span>One of your answers</span></div>{options.length > 0 && <div className={styles.answerChips}>{options.slice(0, 16).map((option, index) => <span key={index}>{option}</span>)}</div>}<small>You provide examples with correct answers in the next step. Zils learns from those examples.</small></aside>

  </div>;
}
