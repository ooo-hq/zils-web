'use client';

import { useEffect, useState } from 'react';
import { useLinkStatus } from 'next/link';
import { loaderFrame, LOADER_TICK_MS, LOADER_TICKS, LOADER_WORD } from '@/lib/type-loader';
import styles from './workspace-loading.module.css';

export function LinkLoading() {
  const { pending } = useLinkStatus();
  return <span className={styles.linkIndicator} data-pending={pending} aria-hidden="true" />;
}

/** Starts resolved so the server render matches; decodes once mounted, unless motion is reduced. */
function ZilsTypeLoader() {
  const [tick, setTick] = useState(LOADER_TICKS - 1);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = LOADER_TICKS - 1;
    const timer = window.setInterval(() => setTick(++t), LOADER_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return <span className={styles.word} aria-hidden="true">
    {loaderFrame(tick).map((cell, i) => <span key={`${i}-${cell.locked}`} className={styles.glyph} data-locked={cell.locked}><span className={styles.ghost}>{LOADER_WORD[i]}</span><span>{cell.char}</span></span>)}
    <span className={styles.cursor} />
  </span>;
}

export function WorkspaceLoading({ label = 'Opening your workspace' }: { label?: string }) {
  return <div className={styles.loading} role="status" aria-label={label} aria-busy="true">
    <div className={styles.caption}><ZilsTypeLoader /><span>{label}…</span></div>
    <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
