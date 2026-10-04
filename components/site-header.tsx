import Link from 'next/link';
import { ZilsWordmark } from '@/components/zils-wordmark';
import { discordUrl, docsUrl } from '@/lib/shared';

/**
 * The one header every page wears — same links in the same order, so no
 * page quietly drops the entry for itself and the nav stops feeling like
 * one place. The current page's link renders lit instead of vanishing.
 */
const LINKS = [
  { href: '/model', label: 'research', id: 'model' },
  { href: '/playground', label: 'playground' },
  { href: '/train', label: 'Sign In', id: 'train' },
] as const;

/** Everything else lives in the footer (components/site-footer.tsx). */
export const FOOTER_LINKS = [
  { href: 'https://fez.chat', label: 'Fez chat app' },
  { href: 'https://fez.chat/cli', label: 'Fez CLI' },
  // The manual lives on its own hostname — an absolute link, not a path.
  { href: docsUrl, label: 'Docs' },
  { href: discordUrl, label: 'Discord' },
  { href: '/model', label: 'Research' },
  { href: '/playground', label: 'Playground' },
  { href: 'https://github.com/ooo-hq/zils', label: 'Model source' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export function SiteHeader({ current, tone = 'dark' }: { current?: string; tone?: 'light' | 'dark' }) {
  return (
    <header className="flex flex-col items-start gap-5 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:py-8">
      <a href="#main-content" className="sr-only z-50 bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Link href="/" aria-label="Zils home" className={`shrink-0 leading-none ${tone === 'light' ? 'text-black' : 'text-white'}`}>
        <ZilsWordmark className="text-[42px]" />
      </Link>
      <nav aria-label="Main navigation" className="grid grid-cols-3 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current === ('id' in l ? l.id : l.label) ? 'page' : undefined}
            className={
              current === ('id' in l ? l.id : l.label)
                ? (tone === 'light' ? 'text-black' : 'text-white')
                : (tone === 'light' ? 'text-neutral-600 transition-colors hover:text-black' : 'text-neutral-400 transition-colors hover:text-white')
            }
          >
            {current === ('id' in l ? l.id : l.label) && <span aria-hidden="true" className="text-[#FF6A00]">&gt;</span>}
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
