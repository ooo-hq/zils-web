import type { ReactNode } from 'react';
import row from '@/components/site/section-row.module.css';
import css from './workspace-page.module.css';

/** The top of a workspace page in the zils.ai rebrand, as on /pricing: a light display title, its intro and action on the right. */
export function PageHero({ title, intro, action, back }: { title: string; intro?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return <header className={css.hero}>
    <div>{back && <div className={css.back}>{back}</div>}<h1>{title}</h1></div>
    {(intro || action) && <div className={css.aside}>{intro && <p>{intro}</p>}{action}</div>}
  </header>;
}

/** A section row that runs the full width of the page column, with an optional quiet action (Refresh) at its end.
    `id` goes on the heading, for a section's aria-labelledby. */
export function Section({ label, action, id }: { label: string; action?: ReactNode; id?: string }) {
  return <div className={`${row.row} ${css.row}`}>
    <span className={row.corner} aria-hidden="true" />
    <h2 className={row.t} id={id}>{label}</h2>
    {action && <span className={css.rowAction}>{action}</span>}
  </div>;
}

export { css as workspacePage };
