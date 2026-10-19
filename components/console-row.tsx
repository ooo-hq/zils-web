'use client';

import { usePathname } from 'next/navigation';
import styles from './console-shell.module.css';

const LABELS: [string, string][] = [
  ['/dashboard', 'Home'], ['/train/teach', 'Train a model'], ['/train', 'Train'], ['/models', 'Models'],
  ['/playground', 'Playground'], ['/usage', 'Usage'], ['/billing', 'Billing'], ['/keys', 'API keys'],
];

/** The section row at the top of every workspace page, as on zils.ai. */
export function ConsoleRow() {
  const path = usePathname();
  const label = LABELS.find(([href]) => path === href || path.startsWith(`${href}/`))?.[1] ?? 'Workspace';
  return <div className={styles.row}><span>{label}</span><span className={styles.rowNote}>Workspace</span></div>;
}
