import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { PricingLab } from './pricing-lab';
import home from '../home.module.css';
import s from './pricing-lab.module.css';

export const metadata: Metadata = {
  title: 'Pricing lab — Zils',
  description: 'Explore Zils revenue and operating costs, with miner-funded training costs shown separately.',
  robots: { index: false, follow: false, noarchive: true, googleBot: { index: false, follow: false } },
};

export default function PricingLabPage() {
  return (
    <div className={`${home.home} ${s.page}`}>
      <div className={s.container}>
        <SiteHeader tone="light" />
        <main id="main-content" tabIndex={-1}>
          <header className={s.hero}>
            <div>
              <h1>Pricing lab.</h1>
              <p>What happens at 100, 1,000, or 2,000 paying customers?<br />Model Zils costs and miner-funded training separately.</p>
            </div>
            <Link href="/pricing" className={s.link}>View the pricing plan</Link>
          </header>
          <PricingLab />
          <p className={s.unlisted}>Unlisted page. Anyone with this URL can open it. Assumptions stay in this tab and reset on refresh.</p>
        </main>
      </div>
    </div>
  );
}
