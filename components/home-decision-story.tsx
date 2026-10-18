'use client';

import { useState } from 'react';
import s from './home-decision-story.module.css';

const LANES = ['billing', 'spam', 'account', 'tech', 'sales', 'review'] as const;
type Lane = typeof LANES[number];

const EXAMPLES: { message: string; answer: string; lane: Lane }[] = [
  { message: 'Please send me a receipt.', answer: 'Billing', lane: 'billing' },
  { message: 'The app closes every time I open it.', answer: 'Technical support', lane: 'tech' },
  { message: 'I need to change my account email.', answer: 'Account changes', lane: 'account' },
];

// Illustrations of the workflow, never presented as live model predictions.
const NEW_MESSAGES: { message: string; answer: string; lane: Lane; explanation: string }[] = [
  { message: 'My invoice page keeps crashing.', answer: 'Technical support', lane: 'tech', explanation: 'It mentions an invoice, but the problem is a broken page.' },
  { message: 'I was charged twice for the same order.', answer: 'Billing', lane: 'billing', explanation: 'A payment problem, even without the word “invoice”.' },
  { message: 'Send future invoices to my new email address.', answer: 'Account changes', lane: 'account', explanation: 'The customer wants to update their details.' },
];

const chip = (lane: Lane) => ({ '--c': `var(--zs-lane-${lane})` }) as React.CSSProperties;

export function HomeDecisionStory() {
  const [selected, setSelected] = useState(0);
  const message = NEW_MESSAGES[selected];

  return (
    <section id="workflow" aria-labelledby="workflow-h" className={s.root}>
      <header className={s.head}>
        <h2 id="workflow-h">Show it what a good answer looks like.</h2>
        <p>Show Zils examples of decisions you already know how to make. It trains a model for that job, checks how well it does, and hosts it for your app to use.</p>
        <p className={s.scenario}>For example: which team should handle this customer message?</p>
      </header>

      <div className={s.cells}>
        <section className={s.step} aria-labelledby="teach-examples-heading">
          <div className={s.k}><span className={s.num}>1</span><span className={s.label}>Examples</span></div>
          <h3 id="teach-examples-heading">You show it the answers.</h3>
          <p className={s.d}>Past messages, paired with the right team.</p>
          <div className={s.viz}>
            <ul className={s.examples}>
              {EXAMPLES.map(example => <li key={example.message}>
                <p>“{example.message}”</p>
                <span className={s.chip} style={chip(example.lane)}>{example.answer}</span>
              </li>)}
            </ul>
            <p className={s.foot}>Bring your checked examples in a spreadsheet.</p>
          </div>
        </section>

        <section className={s.step} aria-labelledby="teach-model-heading">
          <div className={s.k}><span className={s.num}>2</span><span className={s.label}>Training</span></div>
          <h3 id="teach-model-heading">Zils learns the job.</h3>
          <p className={s.d}>A small model, trained on your examples. Separate examples test how well it learned. You review the results.</p>
          <div className={s.viz}>
            <div className={s.learn} aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} className={s.dot} style={{ ...chip(LANES[i % LANES.length]), '--a': `${(i / 14) * 360}deg`, '--i': i } as React.CSSProperties} />
              ))}
              <div className={s.core}><span>Zils</span></div>
            </div>
          </div>
        </section>

        <section className={s.step} aria-labelledby="teach-answer-heading">
          <div className={s.k}><span className={s.num}>3</span><span className={s.label}>In your app</span></div>
          <h3 id="teach-answer-heading">A new message comes in.</h3>
          <p className={s.d}>Your app gets the answer and can route the message.</p>
          <div className={s.viz}>
            <div className={s.incoming} aria-live="polite" aria-atomic="true">
              <div className={s.r}><span className={s.label}>Message</span><p className={s.msg}>“{message.message}”</p></div>
              <div className={s.r}><span className={s.label}>Example answer</span><p><span className={s.chip} style={chip(message.lane)}>{message.answer}</span></p></div>
              <div className={s.r}><span className={s.label}>Why</span><p className={s.why}>{message.explanation}</p></div>
            </div>
            <button type="button" className={s.again} onClick={() => setSelected(index => (index + 1) % NEW_MESSAGES.length)}>Show another message <span aria-hidden="true">↻</span></button>
          </div>
        </section>
      </div>

      <p className={s.disclaim}>Illustrated workflow, not live predictions. A few sample rows are shown; useful training needs varied examples for every answer.</p>
    </section>
  );
}
