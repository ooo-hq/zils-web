import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact-form';
import { SectionRow } from '@/components/site/section-row';
import { SiteFrame } from '@/components/site/site-frame';
import css from '@/components/site/form-page.module.css';

export const metadata: Metadata = {
  title: 'Contact Zils',
  description: 'Tell us what you’re building or ask a question about Zils decision models.',
  alternates: { canonical: 'https://zils.ai/contact' },
};

export default function ContactPage() {
  return <SiteFrame>
    <SectionRow n="01" label="Contact" />
    <div className={css.fpSplit}>
      <div>
        <h1 className={css.fpH1}>Contact us.</h1>
        <p className={css.fpLede}>Tell us what you’re building, or ask us a question. Whether you have a decision to improve or you’re still exploring, we’d like to hear from you.</p>
      </div>
      <div><ContactForm /></div>
    </div>
  </SiteFrame>;
}
