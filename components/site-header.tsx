import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { ThemeToggle } from '@/components/theme';
import { MobileMenu } from '@/components/mobile-menu';
import { AccountMenu } from '@/components/account-menu';
import css from '@/components/site-header.module.css';

export type NavId = 'examples' | 'z3' | 'model' | 'miners' | 'pricing';

const LINKS = [
  { href: '/z3', label: 'Z3', id: 'z3' },
  { href: '/examples', label: 'Examples', id: 'examples' },
  { href: '/model', label: 'Research', id: 'model' },
  { href: '/miners', label: 'Miners', id: 'miners' },
  { href: '/pricing', label: 'Pricing', id: 'pricing' },
] as const;

/**
 * The one header every page wears. `current` is a loose string because
 * pages outside the nav (/cli, /app) still pass their own ids; `tone` is ignored.
 */
export function SiteHeader({ current }: { current?: string; tone?: 'light' | 'dark' }) {
  return (
    <header className={`zs ${css.hdr}`}>
      <a href="#main-content" className={css.skip}>Skip to content</a>
      <Link href="/" aria-label="Zils home" className={css.logo}><ZilsWordmark /></Link>
      <nav aria-label="Main navigation" className={css.nav}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={css.link} aria-current={current === link.id ? 'page' : undefined}>{link.label}</Link>
        ))}
      </nav>
      <div className={css.right}>
        <MobileMenu links={LINKS} current={current} />
        <ThemeToggle className={css.theme} />
        <AccountMenu />
      </div>
    </header>
  );
}
