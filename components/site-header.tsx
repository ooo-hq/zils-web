import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { discordUrl, docsUrl } from '@/lib/shared';
import { ThemeToggle } from '@/components/theme';
import { AccountMenu } from '@/components/account-menu';

/**
 * The one header every page wears — same links in the same order, so no
 * page quietly drops the entry for itself and the nav stops feeling like
 * one place. The current page's link renders lit instead of vanishing.
 */
const LINKS = [
  { href: '/model', label: 'research', id: 'model' },
  { href: '/bittensor', label: 'bittensor' },
  { href: '/playground', label: 'playground' },
  { href: '/pricing', label: 'pricing' },
] as const;

/** Everything else lives in the footer (components/site-footer.tsx). */
export const FOOTER_LINKS = [
  // The manual lives on its own hostname — an absolute link, not a path.
  { href: docsUrl, label: 'Docs' },
  { href: discordUrl, label: 'Discord' },
  { href: '/model', label: 'Research' },
  { href: '/bittensor', label: 'Bittensor' },
  { href: '/playground', label: 'Playground' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: 'https://github.com/ooo-hq/zils', label: 'Model source' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export function SiteHeader({ current, tone = 'dark' }: { current?: string; tone?: 'light' | 'dark' }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:py-8">
      <a href="#main-content" className="sr-only z-50 bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Link href="/" aria-label="Zils home" className={`col-start-1 row-start-1 justify-self-start leading-none ${tone === 'light' ? 'text-ink' : 'text-white'}`}>
        <ZilsWordmark className="text-[42px]" />
      </Link>
      <nav aria-label="Main navigation" className="col-span-2 row-start-2 flex max-w-full flex-wrap items-center justify-center gap-1 justify-self-center text-[13px] font-medium md:col-span-1 md:col-start-2 md:row-start-1 md:gap-4">
        {LINKS.map((link) => {
          const active = current === ('id' in link ? link.id : link.label);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex min-h-11 items-center px-1 transition-colors md:px-3 ${active
                ? (tone === 'light' ? 'text-accent' : 'text-white')
                : (tone === 'light' ? 'text-muted hover:text-ink' : 'text-neutral-400 hover:text-white')}`}
            >
              {link.label}
              {active && <span aria-hidden="true" className={`absolute inset-x-3 bottom-1 h-0.5 rounded-full ${tone === 'light' ? 'bg-accent' : 'bg-white'}`} />}
            </Link>
          );
        })}
      </nav>
      <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end md:col-start-3">
        {tone === 'light' && <ThemeToggle />}
        <AccountMenu tone={tone} />
      </div>
    </header>
  );
}
