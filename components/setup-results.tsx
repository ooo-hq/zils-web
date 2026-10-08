import type { DecisionResponse } from '@/lib/playground';
import type { SetupDraft } from '@/lib/decision-setup';
import s from './guided-playground.module.css';

export function SetupResults({ draft, response }: { draft: SetupDraft; response: DecisionResponse }) {
  return <section className={s.results} aria-labelledby="results-heading">
    <h2 id="results-heading">Your results</h2>
    {draft.questions.map(q => {
      const answer = response.answers[q.id];
      const entries: [string, number][] = answer.type === 'noul' ? [['Yes', answer.noul], ['No', 1 - answer.noul]]
        : Object.entries(answer.probabilities).map(([key, value]) => [answer.type === 'score' ? q.options[Number(key)].label : key, value]);
      const winner = [...entries].sort((a, b) => b[1] - a[1])[0][0];
      return <article key={q.id} className={s.result}>
        <p>{q.prompt}</p><strong>{winner}</strong>
        <dl>{entries.map(([label, value]) => <div className={s.probability} key={label}>
          <dt>{label}</dt><dd>{Math.round(value * 100)}%</dd>
          <div aria-hidden="true" className={s.bar}><span style={{ width: `${value * 100}%` }} /></div>
        </div>)}</dl>
      </article>;
    })}
    <p className={s.helper}>These are model predictions, not verified answers. Check the result against what you expected.</p>
  </section>;
}
