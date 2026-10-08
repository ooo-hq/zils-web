import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { InvestorLab } from './investor-lab';
import home from '../home.module.css';
import s from './investor-lab.module.css';

export const metadata: Metadata = {
  title: 'Investor lab — Zils',
  description: 'Explore Zils launch costs, subnet emissions, break-even and cash runway with editable assumptions.',
  robots: { index: false, follow: false, noarchive: true, googleBot: { index: false, follow: false } },
};

export default function InvestorLabPage() {
  return (
    <div className={`${home.home} ${s.page}`}>
      <div className={s.container}>
        <div className={s.siteHeader}><SiteHeader tone="light" /></div>
        <main id="main-content" tabIndex={-1}>
          <header className={s.hero}>
            <p className={s.eyebrow}>Zils / Investor lab</p>
            <h1>Can emissions<br /><span>fund day one?</span></h1>
            <p className={s.intro}>A lean team. Miner-funded training. A plan to cover operating costs from subnet emissions. Explore the assumptions behind the ambition.</p>
            <div className={s.heroMeta}><span>USD · 30-day model months</span><span>Planning model · not a live quote</span></div>
          </header>
          <InvestorLab />
          <footer className={s.footer}>Unlisted, not password-protected. Anyone with this link can view the page. Inputs stay in this tab and reset on refresh. This page is excluded from site analytics and public navigation.</footer>
        </main>
      </div>
    </div>
  );
}
