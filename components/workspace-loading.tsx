'use client';

import { useLinkStatus } from 'next/link';
import { ZilsDecisionMark } from '@/components/zils-decision-mark';
import styles from './workspace-loading.module.css';

export function LinkLoading() {
  const { pending } = useLinkStatus();
  return <span className={styles.linkIndicator} data-pending={pending} aria-hidden="true" />;
}

export function WorkspaceLoading({ label = 'Opening your workspace' }: { label?: string }) {
  return <div className={styles.loading} role="status" aria-label={label} aria-busy="true">
    <div className={styles.caption}><ZilsDecisionMark className={styles.mark} /><span>{label}…</span></div>
    <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
