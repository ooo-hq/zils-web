import type { ReactNode } from 'react';
import { ZilsWordmark } from './zils-wordmark';
import s from './bitcast-examples.module.css';

export type Model = 'zils' | 'jev';

export function Who({ model }: { model: Model }) {
  return model === 'zils'
    ? <span className={s.exWho}><ZilsWordmark className={s.exMark} /></span>
    : <span className={s.exWho}><span className={s.exJ} aria-hidden="true">J</span>TypeSafe JEV</span>;
}

export function StageHead({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={s.exStageHead}><h2>{title}</h2>{children}</div>;
}

/** Zils then JEV, each with its answer and whether it matched the reference. */
export function Verdicts({ rows, note, label }: { rows: Record<Model, { answer: string; right: boolean }>; note: string; label?: string }) {
  const summary = (['zils', 'jev'] as const).map(m => `${m === 'zils' ? 'Zils' : 'JEV'}: ${rows[m].answer} · ${rows[m].right ? 'right' : 'wrong'}`).join('; ');
  return <div className={s.exVerdicts}>
    <p role="status" className={s.exSr}>{label ? `${label}. ` : ''}{summary}</p>
    {(['zils', 'jev'] as const).map(model => <div key={model} className={s.exVRow} data-verdict={model} data-win={rows[model].right ? '' : undefined}>
      <Who model={model} /><span className={s.exAns}>{rows[model].answer}</span>
      <span className={`${s.exTag} ${rows[model].right ? s.exGood : s.exBad}`}>{rows[model].right ? 'Right' : 'Wrong'}</span>
    </div>)}
    <div className={s.exKey}>{note}</div>
  </div>;
}
