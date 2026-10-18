import css from './section-row.module.css';

export function SectionRow({ n, label, note }: { n?: string; label: string; note?: string }) {
  return (
    <div className={css.row}>
      <span className={css.corner} aria-hidden="true" />
      {n && <span className={css.n}>{n}</span>}
      <span className={css.t}>{label}</span>
      {note && <span className={css.note}>{note}</span>}
    </div>
  );
}
