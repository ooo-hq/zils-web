'use client';

import type { SetupDraft, SetupQuestion } from '@/lib/decision-setup';
import s from './guided-playground.module.css';

export function SetupQuestionEditor({ draft, onChange, disabled }: { draft: SetupDraft; onChange: (draft: SetupDraft) => void; disabled: boolean }) {
  function update(index: number, change: Partial<SetupQuestion>) {
    onChange({ ...draft, questions: draft.questions.map((q, i) => i === index ? { ...q, ...change } : q) });
  }
  return <fieldset disabled={disabled} className={s.editor}>
    <label className={s.label} htmlFor="setup-title">Setup name</label>
    <input id="setup-title" className={s.input} value={draft.title} maxLength={100} onChange={e => onChange({ ...draft, title: e.target.value })} />
    {draft.questions.map((q, index) => <section className={s.question} key={q.id} aria-label={`Question ${index + 1} settings`}>
      <div className={s.questionHeader}>
        <span className={s.questionNumber}>{index + 1}</span>
        <select aria-label={`Answer type for question ${index + 1}`} className={s.typeSelect} value={q.kind} onChange={e => {
          const kind = e.target.value as SetupQuestion['kind'];
          update(index, { kind, options: kind === 'yes_no' ? [] : q.options.length >= 2 ? q.options : [{ label: '', description: '' }, { label: '', description: '' }] });
        }}>
          <option value="choice">Choose an answer</option><option value="yes_no">Yes or no</option><option value="score">Rate on a scale</option>
        </select>
        <button type="button" className={s.quietButton} aria-label={`Remove question ${index + 1}`} onClick={() => onChange({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>Remove</button>
      </div>
      <label className={s.srOnly} htmlFor={`prompt-${q.id}`}>Question {index + 1}</label>
      <textarea id={`prompt-${q.id}`} className={s.questionPrompt} rows={2} placeholder="What would you like to know?" maxLength={1000} value={q.prompt} onChange={e => update(index, { prompt: e.target.value })} />
      {q.kind === 'yes_no' ? <div className={s.answerPills}><span>Yes</span><span>No</span><p>Include what counts as “yes” in your question.</p></div> : <>
        <p className={s.helper}>{q.kind === 'score' ? 'Scale from lowest to highest. The order matters.' : 'Give each possible answer a clear meaning.'}</p>
        <div className={s.options}>
          {q.options.map((option, optionIndex) => <div className={s.option} key={optionIndex}>
            <span className={s.optionMarker}>{q.kind === 'score' ? optionIndex + 1 : '•'}</span>
            <div>
              <input aria-label={`Answer ${optionIndex + 1} for question ${index + 1}`} className={s.optionInput} placeholder="Answer name" maxLength={100} value={option.label} onChange={e => update(index, { options: q.options.map((o, i) => i === optionIndex ? { ...o, label: e.target.value } : o) })} />
              <input aria-label={`Meaning of answer ${optionIndex + 1} for question ${index + 1}`} className={s.optionDescription} placeholder="When should Zils choose this?" maxLength={500} value={option.description} onChange={e => update(index, { options: q.options.map((o, i) => i === optionIndex ? { ...o, description: e.target.value } : o) })} />
            </div>
            <button type="button" className={s.removeOption} aria-label={`Remove answer ${optionIndex + 1} from question ${index + 1}`} onClick={() => update(index, { options: q.options.filter((_, i) => i !== optionIndex) })}>×</button>
          </div>)}
        </div>
        {q.options.length < 16 && <button type="button" className={s.textButton} onClick={() => update(index, { options: [...q.options, { label: '', description: '' }] })}>+ Add an answer</button>}
      </>}
    </section>)}
    {draft.questions.length < 8 && <button type="button" className={s.addQuestion} onClick={() => onChange({ ...draft, questions: [...draft.questions, { id: `question_${crypto.randomUUID().replaceAll('-', '')}`, kind: 'yes_no', prompt: '', options: [] }] })}>+ Add a question</button>}
  </fieldset>;
}
