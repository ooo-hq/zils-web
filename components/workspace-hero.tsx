import Link from 'next/link';
import s from './workspace-hero.module.css';

const greeting = (hour: number) => hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

type Row = { label: string; value: number };
// Illustrative answers in the shape the API returns; not results from the user's models.
const SPECIMENS: { kind: string; question: string; rows: Row[]; answer: string }[] = [
  { kind: 'Yes / no', question: 'Is the customer asking to cancel?', rows: [{ label: 'yes', value: .91 }, { label: 'no', value: .09 }], answer: 'yes' },
  { kind: 'Choice', question: 'Which team should handle this?', rows: [{ label: 'billing', value: .72 }, { label: 'technical', value: .21 }, { label: 'account', value: .07 }], answer: 'billing' },
  { kind: 'Score', question: 'How urgent is it, from 0 to 3?', rows: [{ label: '3', value: .44 }, { label: '2', value: .38 }, { label: '1', value: .14 }, { label: '0', value: .04 }], answer: '2.22 of 3' },
];

export function WorkspaceHero({ email }: { email?: string }) {
  const name = email?.split('@')[0];
  return <section className={s.hero} aria-labelledby="workspace-greeting">
    <div className={s.copy}>
      <h1 id="workspace-greeting" className={s.greeting}>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}.</h1>
      <p>Ask Zils anything about one input. Every answer comes back as a probability your code can act on.</p>
      <div className={s.actions}>
        <Link href="/playground" className={s.primary}>Open the playground</Link>
        <Link href="/train/teach" className={s.secondary}>Train a model</Link>
      </div>
    </div>
    <ul className={s.specimens} aria-label="The three kinds of answer">
      {SPECIMENS.map(item => <li key={item.kind} className={s.card}>
        <span className={s.kind}>{item.kind}</span>
        <p className={s.question}>{item.question}</p>
        <dl>{item.rows.map((row, index) => <div key={row.label} data-top={index === 0 || undefined}>
          <dt>{row.label}</dt>
          <dd className={s.value}>{Math.round(row.value * 100)}%</dd>
          <dd aria-hidden="true" className={s.track}><span className={s.fill} style={{ width: `${row.value * 100}%` }} /></dd>
        </div>)}</dl>
        <p className={s.answer}><span>Answer</span>{item.answer}</p>
      </li>)}
    </ul>
  </section>;
}
