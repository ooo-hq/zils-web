import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { discordUrl, docsUrl } from '@/lib/shared';
import footer from '@/components/site-footer.module.css';
import s from '@/components/light.module.css';

const LINK_GROUPS = [
  { label: 'Build', links: [
    { href: docsUrl, label: 'Docs' },
    { href: '/playground', label: 'Playground' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/early-access', label: 'Early access' },
  ] },
  { label: 'Explore', links: [
    { href: '/model', label: 'Research' },
    { href: '/bittensor', label: 'Bittensor' },
    { href: 'https://github.com/ooo-hq/zils', label: 'Model source' },
  ] },
  { label: 'Keep in touch', links: [
    { href: discordUrl, label: 'Discord' },
    { href: 'https://x.com/zils_ai', label: 'X' },
    { href: '/contact', label: 'Contact' },
  ] },
] as const;

/** A little crooked decision path, echoing the angles in the Zils mark. */
function DecisionDoodle() {
  return (
    <svg className={footer.doodle} viewBox="0 0 176 74" fill="none" aria-hidden="true" focusable="false">
      <path className={footer.doodleWash} d="m17 26 101-13-43 40 78-8-20 20-119-4 43-28Z" />
      <path d="M10 36 80 24 55 53 115 41M80 24l25-13m10 30 32 16m-32-16 32-17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="36" r="4" fill="currentColor" />
      <circle cx="110" cy="9" r="5" fill="currentColor" />
      <path d="m153 13 8 10-11 8-8-10Z" fill="currentColor" />
      <path className={footer.doodleSpark} d="m154 41 3 10 11-2-7 9 8 8-12-1-4 10-3-11-11 1 8-8-6-9 10 3Z" />
    </svg>
  );
}

/** Shared Zils resources and policy links for every page. */
export function SiteFooter({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <footer className={`${footer.root} ${tone === 'dark' ? footer.dark : ''}`}>
      <div className={footer.inner}>
        <div className={footer.main}>
          <div className={footer.brand}>
            <Link href="/" aria-label="Zils home" className={footer.logo}><ZilsWordmark className="text-[42px]" /></Link>
            <p>Specialized models.<br />Decisions that are yours.</p>
            <DecisionDoodle />
          </div>
          <nav aria-label="Footer" className={footer.navigation}>
            {LINK_GROUPS.map((group) => (
              <div key={group.label} className={footer.group}>
                <h2>{group.label}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className={footer.bottom}>
          <p>Your data. Your decision model.</p>
          <nav aria-label="Policies">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Drifting pastel light + grain + scanlines behind a light page's top. */
export function LightBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 dark:opacity-15">
      <div className={`absolute -right-40 -top-48 size-[720px] rounded-full bg-[radial-gradient(circle,#a9c9ff_0%,transparent_60%)] blur-2xl ${s.drift}`} />
      <div className={`absolute -right-10 top-32 size-[520px] rounded-full bg-[radial-gradient(circle,#f3c3f0_0%,transparent_60%)] blur-2xl ${s.driftSlow}`} />
      <div className={`absolute right-[38%] -top-20 size-[420px] rounded-full bg-[radial-gradient(circle,#bdf1f8_0%,transparent_62%)] blur-2xl ${s.drift}`} />
      <div className={`absolute -left-48 top-[480px] size-[520px] rounded-full bg-[radial-gradient(circle,#ffd9bd_0%,transparent_60%)] blur-2xl ${s.driftSlow}`} />
      <div className={`absolute inset-0 ${s.grain}`} />
      <div className={`absolute inset-0 ${s.scanlines}`} />
    </div>
  );
}
