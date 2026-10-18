import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import css from './site-frame.module.css';

export type NavId = 'examples' | 'model' | 'miners' | 'pricing';

/** The one wrapper every marketing page uses: .zs root, nav, gutters, footer. */
export function SiteFrame({ children, current }: { children: ReactNode; current?: NavId }) {
  return (
    <div className={`zs ${css.frame}`}>
      <div className={css.body}>
        <SiteHeader current={current} tone="dark" />
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <SiteFooter tone="dark" />
    </div>
  );
}
