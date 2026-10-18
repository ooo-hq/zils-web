import css from './form-page.module.css';

const HEIGHTS = [40, 62, 30, 55, 80, 100, 70, 85, 48, 26];

/** The 10-column spectrum skyline that closes the early-access page. */
export function FormSkyline() {
  return (
    <div className={css.fpSky} aria-hidden="true">
      {HEIGHTS.map((h, i) => <i key={i} style={{ '--h': `${h}%`, '--i': i, backgroundPosition: `${Math.round(i * 100 / 9)}% 0` } as React.CSSProperties} />)}
    </div>
  );
}
