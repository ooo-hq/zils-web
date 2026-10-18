import type { Metadata } from 'next';
import Link from 'next/link';
import { EmailSignup } from '@/components/email-signup';
import { FormSkyline } from '@/components/site/form-skyline';
import { SectionRow } from '@/components/site/section-row';
import { SiteFrame } from '@/components/site/site-frame';
import css from '@/components/site/form-page.module.css';

export const metadata: Metadata = {
  title: 'Zils — early access',
  description: 'Join the Zils early-access email list for specialized decision models.',
  alternates: { canonical: 'https://zils.ai/early-access' },
};

export default function EarlyAccessPage() {
  return <SiteFrame>
    <SectionRow n="01" label="Early access" />
    <div className={css.fpSplit}>
      <div>
        <h1 className={css.fpH1}>Get early<br />access.</h1>
        <p className={css.fpLede}>Join the email list. We’ll invite selected users as space opens up.</p>
        <p className={css.fpAside}>Already invited? <Link href="/sign-in" className={css.fpLink}>Sign in to your workspace</Link></p>
      </div>
      <div><EmailSignup earlyAccess /></div>
    </div>
    <FormSkyline />
  </SiteFrame>;
}
