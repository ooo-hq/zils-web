import type { ReactNode } from 'react';
import css from './details-row.module.css';

export function DetailsRow({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className={css.d}>
      <summary>{summary}</summary>
      <div className={css.inner}>{children}</div>
    </details>
  );
}
