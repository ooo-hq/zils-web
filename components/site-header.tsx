import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { discordUrl, docsUrl } from '@/lib/shared';
import { ThemeToggle } from '@/components/theme';
import { XProfileLink } from '@/components/x-profile-link';
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
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-4 py-6 text-xs sm:py-8">
      <a href="#main-content" className="sr-only z-50 bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Link href="/" aria-label="Zils home" className={`col-start-1 row-start-1 shrink-0 leading-none ${tone === 'light' ? 'text-ink' : 'text-white'}`}>
        <ZilsWordmark className="text-[42px]" />
      </Link>
      <div className="col-span-3 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-3 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-end sm:gap-x-3">
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-5">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === ('id' in l ? l.id : l.label) ? 'page' : undefined}
              className={
                current === ('id' in l ? l.id : l.label)
                  ? (tone === 'light' ? 'text-ink' : 'text-white')
                  : (tone === 'light' ? 'text-muted transition-colors hover:text-ink' : 'text-neutral-400 transition-colors hover:text-white')
              }
            >
              {current === ('id' in l ? l.id : l.label) && <span aria-hidden="true" className="text-[#FF6A00]">&gt;</span>}
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center">
          <XProfileLink tone={tone} iconSize={14} />
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Zils on Discord (opens in a new tab)"
            title="Join the Zils Discord"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${tone === 'light' ? 'text-muted hover:text-ink' : 'text-neutral-400 hover:text-white'}`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
          </a>
        </div>
      </div>
      <div className="col-start-3 row-start-1 flex items-center gap-2 justify-self-end">{tone === 'light' && <ThemeToggle />}<AccountMenu tone={tone} /></div>
    </header>
  );
}
