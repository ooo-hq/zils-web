'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-render the page's server data every 30 seconds while the tab is visible, and at once when it becomes visible. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return null;
}
