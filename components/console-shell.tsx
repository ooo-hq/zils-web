import type { ReactNode } from 'react';
import { ConsoleNav } from '@/components/console-nav';
import { trainingConfig } from '@/lib/training-config';
import styles from './console-shell.module.css';

/** Signed-in pages (training, usage, keys) share one sidebar instead of the marketing header. */
export function ConsoleShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  const config = trainingConfig();
  return <div className={styles.shell}>
    <a href="#main-content" className="sr-only z-50 bg-black px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <ConsoleNav auth={config ? { url: config.url, key: config.key } : undefined} billingUrl={config?.decisionApiUrl ?? null} />
    <main id="main-content" tabIndex={-1} className={`${styles.main} ${className}`}>{children}</main>
  </div>;
}
