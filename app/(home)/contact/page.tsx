import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact-form';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import home from '../home.module.css';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: 'Contact Zils',
  description: 'Tell us what you’re building or ask a question about Zils decision models.',
  alternates: { canonical: 'https://zils.ai/contact' },
};

export default function ContactPage() {
  return <div className={`${home.home} ${styles.page}`}>
    <div className={styles.container}><SiteHeader tone="light" />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.intro}><h1>Contact us.</h1><p>Tell us what you’re building, or ask us a question.</p><p className={styles.detail}>Whether you have a decision to improve or you’re still exploring, we’d like to hear from you.</p></div>
        <ContactForm />
      </main>
    </div>
    <SiteFooter />
  </div>;
}
