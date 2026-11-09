import type { ReactNode } from 'react';
import { ConsoleNav } from '@/components/console-nav';
import { ConsoleRow } from '@/components/console-row';
import { trainingConfig } from '@/lib/training-config';
import styles from './console-shell.module.css';

/** Signed-in pages share one sidebar and the zils.ai rebrand's .zs tokens instead of the marketing header. */
/** `bleed` drops the reading-width column so a page can run edge to edge between section rows, as on zils.ai. */
export function ConsoleShell({ children, className = '', bleed = false }: { children: ReactNode; className?: string; bleed?: boolean }) {
  const config = trainingConfig();
  return <div className={`zs ${styles.shell}`}>
    <a href="#main-content" className="sr-only z-50 bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <ConsoleNav auth={config ? { url: config.url, key: config.key } : undefined} billingUrl={config?.decisionApiUrl ?? null} />
    <div className={styles.column}>
      <ConsoleRow />
      <main id="main-content" tabIndex={-1} className={`${styles.main} ${bleed ? styles.bleed : ''} ${className}`}>{children}</main>
    </div>
  </div>;
}
