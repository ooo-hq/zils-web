import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader, type NavId } from '@/components/site-header';
import css from './site-frame.module.css';

export type { NavId };

/** The one wrapper every marketing page uses: .zs root, nav, gutters, footer. */
export function SiteFrame({ children, current }: { children: ReactNode; current?: NavId }) {
  return (
    <div className={`zs ${css.frame}`}>
      <div className={css.body}>
        <SiteHeader current={current} />
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
