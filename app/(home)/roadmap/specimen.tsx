import s from './specimen.module.css';

// Each specimen draws the proposed answer in the box track's output orange over a grey input.
// The tag is the answer itself, styled like the box track's confidence tag.
const APPLES = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1]; // 1 = red apple; seven of them

export function Specimen({ id }: { id: string }) {
  switch (id) {
    case 'count': {
      let n = 0;
      return <div className={s.box} aria-hidden="true">
        <div className={s.apples}>{APPLES.map((red, i) => <i key={i} data-red={red || undefined}
          style={red ? { '--d': `${0.1 * n++}s` } as React.CSSProperties : undefined} />)}</div>
        <b className={s.tag} style={{ '--d': '.85s' } as React.CSSProperties}>7</b>
      </div>;
    }
    case 'text-spans':
      return <div className={s.box} aria-hidden="true">
        <p className={s.mail}>Hi — please pay invoice 4471 by <span className={s.span}>Nov 3</span> to keep the account open.</p>
        <b className={s.tag} style={{ '--d': '.9s' } as React.CSSProperties}>deadline</b>
      </div>;
    case 'points':
      return <div className={s.box} aria-hidden="true">
        <div className={s.ui}><span>Upgrade</span><span>Pause</span><span data-hit>Cancel plan</span></div>
        <i className={s.cross} />
        <b className={s.tag} style={{ '--d': '.9s' } as React.CSSProperties}>0.74, 0.62</b>
      </div>;
    case 'video':
      return <div className={s.box} aria-hidden="true">
        <div className={s.film}>{Array.from({ length: 8 }, (_, i) => <i key={i} />)}<span className={s.clip} /><span className={s.head} /></div>
        <b className={s.tag} style={{ '--d': '1.1s' } as React.CSSProperties}>0:08–0:11</b>
      </div>;
    case 'multi-select':
      return <div className={s.box} aria-hidden="true">
        <div className={s.chips}>{['billing', 'shipping', 'refund', 'login'].map((label, i) =>
          <span key={label} data-on={label === 'billing' || label === 'refund' || undefined} style={{ '--d': `${0.2 + 0.25 * i}s` } as React.CSSProperties}>{label}</span>)}</div>
        <b className={s.tag} style={{ '--d': '1s' } as React.CSSProperties}>2 of 4</b>
      </div>;
    default: // masks
      return <div className={s.box} aria-hidden="true">
        <svg className={s.mask} viewBox="0 0 200 112">
          <rect x="20" y="88" width="160" height="5" rx="2.5" className={s.ground} />
          <path className={s.handle} d="M118 42h6a12 12 0 0 1 0 24h-6" />
          <path className={s.object} d="M74 26h46v48a12 12 0 0 1-12 12H86a12 12 0 0 1-12-12z" />
          <path className={s.shape} pathLength={1} d="M74 26h46v12h4a16 16 0 0 1 0 32h-5a12 12 0 0 1-11 16H86a12 12 0 0 1-12-12z" />
        </svg>
        <b className={s.tag} style={{ '--d': '1.2s' } as React.CSSProperties}>outline</b>
      </div>;
  }
}
