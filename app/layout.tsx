import './global.css';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { ThemeSync } from '@/components/theme';
import { themeScript } from '@/lib/theme';

// Plex Mono carries the headings and navigation; Plex Sans keeps longer
// articles readable within the same type family.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="flex flex-col min-h-screen"><ThemeSync />{children}</body>
    </html>
  );
}
