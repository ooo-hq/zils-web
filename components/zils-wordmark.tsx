import localFont from 'next/font/local';
import s from './zils-wordmark.module.css';

// Grenze Gotisch by Omnibus-Type, SIL OFL 1.1. Only the Zils glyphs are bundled.
const wordmark = localFont({
  src: './fonts/grenze-gotisch-zils.woff2',
  weight: '600',
  style: 'normal',
  display: 'swap',
});

export function ZilsWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`${wordmark.className} ${s.mark} inline-block whitespace-nowrap font-semibold leading-none tracking-[-0.025em] ${className}`}>
      Zils
      <span aria-hidden="true" className={s.sheen}>Zils</span>
    </span>
  );
}
