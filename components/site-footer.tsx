import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { discordUrl, docsUrl } from '@/lib/shared';
import footer from '@/components/site-footer.module.css';
import s from '@/components/light.module.css';

const LINK_GROUPS = [
  { label: 'Build', links: [
    { href: docsUrl, label: 'Docs' },
    { href: '/examples', label: 'Examples' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/early-access', label: 'Early access' },
  ] },
  { label: 'Explore', links: [
    { href: '/z3', label: 'z3 models' },
    { href: '/model', label: 'Research' },
    { href: '/miners', label: 'Miners' },
    { href: '/bases', label: 'Bases' },
    { href: '/roadmap', label: 'Roadmap' },
    { href: 'https://github.com/ooo-hq/zils', label: 'Model source' },
  ] },
  { label: 'Keep in touch', links: [
    { href: `${docsUrl}/changelog`, label: 'Changelog' },
    { href: discordUrl, label: 'Discord' },
    { href: 'https://x.com/zils_ai', label: 'X' },
    { href: '/contact', label: 'Contact' },
  ] },
] as const;

/** Shared Zils resources and policy links for every page. `tone` is ignored. */
export function SiteFooter(_props: { tone?: 'light' | 'dark' }) {
  return (
    <footer className={`zs ${footer.root}`}>
      <div className={footer.inner}>
        <div className={footer.brand}>
          <Link href="/" aria-label="Zils home" className={footer.logo}><ZilsWordmark /></Link>
          <p>Specialized models.<br />Decisions that are yours.</p>
        </div>
        <nav aria-label="Footer" className={footer.groups}>
          {LINK_GROUPS.map((group) => (
            <div key={group.label}>
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
        <span>Your data. Your decision model.</span>
        <nav aria-label="Policies">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <span>© 2026 Zils</span>
        </nav>
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
