'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ZilsWordmark } from '@/components/zils-wordmark';
import s from './home-decision-story.module.css';

const EXAMPLES = [
  { message: 'Please send me a receipt.', answer: 'Billing' },
  { message: 'The app closes every time I open it.', answer: 'Technical support' },
  { message: 'I need to change my account email.', answer: 'Account changes' },
];

// Illustrations of the workflow, never presented as live model predictions.
const NEW_MESSAGES = [
  { message: 'My invoice page keeps crashing.', answer: 'Technical support', explanation: 'It mentions an invoice, but the problem is a broken page.' },
  { message: 'I was charged twice for the same order.', answer: 'Billing', explanation: 'A payment problem, even without the word “invoice”.' },
  { message: 'Send future invoices to my new email address.', answer: 'Account changes', explanation: 'The customer wants to update their details.' },
];

export function HomeDecisionStory() {
  const [selected, setSelected] = useState(0);
  const message = NEW_MESSAGES[selected];

  return (
    <div className={s.root} id="try-decision-heading">
      <header className={s.heading}>
        <h2 id="workflow-h">Show it what a good answer looks like.</h2>
        <p>Show Zils examples of decisions you already know how to make. It trains a model for that job, checks how well it does, and hosts it for your app to use.</p>
      </header>

      <p className={s.scenario}>For example: which team should handle this customer message?</p>
      <div className={s.story}>
        <section className={s.teach} aria-labelledby="teach-examples-heading">
          <h3 id="teach-examples-heading">You show it the answers.</h3>
          <p className={s.stageIntro}>Past messages, paired with the right team.</p>
          <ul className={s.examples}>
            {EXAMPLES.map(example => <li key={example.message}>
              <p>“{example.message}”</p>
              <span>{example.answer}</span>
            </li>)}
          </ul>
          <p className={s.stageNote}>Bring your checked examples in a spreadsheet.</p>
        </section>

        <section className={s.learn} aria-labelledby="teach-model-heading">
          <h3 id="teach-model-heading">Zils learns the job.</h3>
          <div className={s.model} aria-hidden="true">
            <svg viewBox="0 0 208 176" fill="none" focusable="false">
              <path className={s.modelBack} d="m32 32 153-14-17 132-148 8Z" />
              <path className={s.modelFront} d="m20 23 158 10-10 122L28 141Z" />
              <path className={s.modelLine} d="M2 90h22m146 0h36m-8-7 8 7-8 7" />
              <path className={s.spark} d="m166 4 3 10 11-1-7 8 7 9-11-2-4 11-3-11-11 1 7-8-6-9 10 2Z" />
            </svg>
            <ZilsWordmark className={s.modelMark} />
          </div>
          <p>A small model,<br />trained on your examples.</p>
          <p className={s.stageNote}>Separate examples test how well it learned. You review the results.</p>
        </section>

        <section className={s.use} aria-labelledby="teach-answer-heading">
          <h3 id="teach-answer-heading">A new message comes in.</h3>
          <div className={s.message} aria-live="polite" aria-atomic="true">
            <p className={s.newMessage}>“{message.message}”</p>
            <div className={s.answer}>
              <span>Example answer</span>
              <strong>{message.answer}</strong>
              <p>{message.explanation}</p>
            </div>
          </div>
          <button type="button" className={s.next} onClick={() => setSelected(index => (index + 1) % NEW_MESSAGES.length)}>Show another message <span aria-hidden="true">↻</span></button>
          <p className={s.stageNote}>Your app gets the answer and can route the message.</p>
        </section>
      </div>

      <p className={s.caption}>Illustrated workflow, not live predictions. A few sample rows are shown; useful training needs varied examples for every answer.</p>
      <div className={s.closing}>
        <p>Same idea, different jobs.<br /><span>Choose a team. Flag a problem. Score a match.</span></p>
        <div className={s.actions}>
          <Link href="/train" className={s.primary}>Train your own model</Link>
          <Link href="/playground?starter=customer-routing" className={s.secondary}>Try the shared model</Link>
        </div>
      </div>
    </div>
  );
}
