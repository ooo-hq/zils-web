import Link from 'next/link';
import { FOOTER_LINKS } from '@/components/site-header';
import { ZilsWordmark } from '@/components/zils-wordmark';
import s from '@/components/light.module.css';

/** Shared Zils resources and policy links for every page. */
export function SiteFooter({ tone = 'light', showSmallWordmark = true }: { tone?: 'light' | 'dark'; showSmallWordmark?: boolean }) {
  if (tone === 'dark') {
    return (
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-5 border-t border-neutral-900 px-6 py-8 font-mono text-xs text-neutral-500 sm:px-8">
        <Link href="/" aria-label="Zils home" className="leading-none text-neutral-300"><ZilsWordmark className="text-[36px]" /></Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => <Link key={l.href + l.label} href={l.href} className="hover:text-neutral-200">{l.label}</Link>)}
        </nav>
      </footer>
    );
  }
  return (
    <footer className="overflow-hidden border-t border-edge bg-page text-ink">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 pt-14 sm:px-8 md:grid-cols-[1fr_auto]">
        <div>
          {showSmallWordmark && <Link href="/" aria-label="Zils home" className="inline-block leading-none"><ZilsWordmark className="text-[42px]" /></Link>}
          <p className={`${showSmallWordmark ? 'mt-3' : ''} text-sm text-muted`}>Specialized models.<br />Decisions that are yours.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-1.5 text-sm sm:grid-cols-3">
          {FOOTER_LINKS.map((l) => <Link key={l.href + l.label} href={l.href} className="hover:text-[var(--zils-accent,#3455dc)]">{l.label}</Link>)}
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-5xl justify-between gap-4 px-6 font-mono text-[10px] tracking-[0.1em] text-subtle sm:px-8">
        <span>YOUR DATA. YOUR DECISION MODEL.</span>
        <span>ZILS.AI / EARLY ACCESS</span>
      </div>
      <p aria-hidden="true" className="mx-auto mt-6 max-w-6xl select-none px-6 pb-4 leading-none sm:px-8">
        <ZilsWordmark className="text-[clamp(10rem,42vw,32rem)]" />
      </p>
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
