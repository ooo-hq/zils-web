import Link from 'next/link';
import { SectionRow } from '@/components/site/section-row';
import { SiteFrame } from '@/components/site/site-frame';
import { FormSkyline } from '@/components/site/form-skyline';
import css from './not-found.module.css';

export default function NotFound() {
  return (
    <SiteFrame>
      <SectionRow n="01" label="Not found" />
      <div className={css.nf}>
        <div className={css.c}>
          <div>
            <div className={css.code} aria-hidden="true">404</div>
            <h1 className={css.h1}>No decision for this page.</h1>
            <p className={css.p}>The link may be old, or the page has moved.</p>
            <div className={css.btns}>
              <Link href="/" className={css.primary}>Go home</Link>
              <Link href="/examples" className={css.secondary}>See examples</Link>
            </div>
          </div>
        </div>
        <FormSkyline />
      </div>
    </SiteFrame>
  );
}
