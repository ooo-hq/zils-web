import localFont from 'next/font/local';

// Grenze Gotisch by Omnibus-Type, SIL OFL 1.1. Only the Zils glyphs are bundled.
const wordmark = localFont({
  src: './fonts/grenze-gotisch-zils.woff2',
  weight: '600',
  style: 'normal',
  display: 'swap',
});

export function ZilsWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`${wordmark.className} inline-block whitespace-nowrap font-semibold leading-none tracking-[-0.025em] ${className}`}>
      Zils
    </span>
  );
}
