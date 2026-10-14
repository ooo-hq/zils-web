'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { RunToast } from '@/lib/run-toasts';
import styles from './run-toasts.module.css';

export function RunToasts({ toasts, onDismiss }: { toasts: RunToast[]; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timers = toasts.map(toast => setTimeout(() => onDismiss(toast.id), toast.sticky ? 15_000 : 8_000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);
  if (!toasts.length) return null;
  return <div className={styles.stack} aria-live="polite">
    {toasts.slice(-3).map(toast => <div key={toast.id} className={styles.toast} data-tone={toast.tone} role="status">
      <div><strong>{toast.name}</strong><p>{toast.title}</p><Link href={`/train?run=${toast.jobId}`} onClick={() => onDismiss(toast.id)}>View run</Link></div>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => onDismiss(toast.id)}><X size={14} /></button>
    </div>)}
  </div>;
}
