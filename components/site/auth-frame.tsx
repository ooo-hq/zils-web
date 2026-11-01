import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme';
import { ZilsWordmark } from '@/components/zils-wordmark';
import css from './sign-in-panel.module.css';

const BARS = [55, 40, 70, 60, 85, 100, 70, 90, 60, 35];
const CUT = [2, 6];

/** The split sign-in layout: art on the left over the spectrum bars, the form on the right. */
export function AuthFrame({ label, art, children }: { label: string; art: ReactNode; children: ReactNode }) {
  return (
    <div className={`zs ${css.auth}`}>
      <div className={css.art}>
        <div className={css.artTop}>
          <Link href="/" aria-label="Zils home" className={css.mark}><ZilsWordmark /></Link>
          <span className={css.label}>{label}</span>
        </div>
        {art}
        <div className={css.bars} aria-hidden="true">
          {BARS.map((h, i) => <i key={i} className={CUT.includes(i) ? css.cut : ''} style={{ '--h': `${h}%`, '--i': i, backgroundPosition: `${Math.round(i * 100 / 9)}% 0` } as CSSProperties} />)}
        </div>
      </div>
      <div className={css.formHalf}>
        <div className={css.formTop}><ThemeToggle className={css.theme} /></div>
        <main id="main-content" tabIndex={-1} className={css.box}>
          {children}
          <p className={css.legal}>By signing in you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.</p>
        </main>
      </div>
    </div>
  );
}

export function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}
