import './global.css';
import { IBM_Plex_Sans, IBM_Plex_Mono, Inter_Tight } from 'next/font/google';
import { ThemeSync } from '@/components/theme';
import { Toaster } from '@/components/ui/sonner';
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
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500'],
  variable: '--font-inter-tight',
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('zs-js')" }} />
      </head>
      <body className="flex flex-col min-h-screen"><ThemeSync /><Toaster position="bottom-right" />{children}</body>
    </html>
  );
}
