'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SetupDraft } from '@/lib/decision-setup';
import s from './home-decision-starter.module.css';

type Starter = { id: string; name: string; description: string; goal: string; draft: SetupDraft };

/** Preview real starter questions; running the model remains an explicit playground action. */
export function HomeDecisionStarter({ starters }: { starters: Starter[] }) {
  const [selected, setSelected] = useState(0);
  const starter = starters[selected];

  return (
    <section aria-labelledby="try-decision-heading" className={s.root}>
      <div className={s.invitation}>
        <h3 id="try-decision-heading">Try a decision<br />of your own.</h3>
        <p>Start with an everyday task. Make the questions yours, then try a message in the playground.</p>
        <div className={s.choices} role="group" aria-label="Choose a starting point">
          {starters.map((item, index) => (
            <button key={item.id} type="button" aria-pressed={selected === index} aria-controls="decision-starter-preview" onClick={() => setSelected(index)}>
              <span>{item.draft.title}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
        <Link href="/playground" className={s.ownTask}>Have a different task? Describe it in your own words.</Link>
      </div>
      <div className={s.preview} id="decision-starter-preview">
        <div aria-live="polite" aria-atomic="true">
          <p className={s.goal}>“{starter.goal}”</p>
          <div className={s.questions}>
            {starter.draft.questions.map(question => (
              <div key={question.id} className={s.question}>
                <p>{question.prompt}</p>
                <div className={s.answers} aria-label="Possible answers">
                  {(question.kind === 'yes_no' ? ['Yes', 'No'] : question.options.map(option => option.label)).map(answer => <span key={answer}>{answer}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.action}>
          <p>These are starting questions.<br />You can change every word.</p>
          <Link href={`/playground?starter=${starter.id}`} className={s.cta}>Make this decision yours</Link>
        </div>
      </div>
    </section>
  );
}
