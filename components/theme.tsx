'use client';

import { useLayoutEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_STORAGE_KEY, resolveTheme } from '@/lib/theme';

function applyTheme(saved?: string | null) {
  document.documentElement.dataset.theme = resolveTheme(saved);
}

export function ThemeSync() {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Storage can be disabled. */ }
    applyTheme(saved);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* The choice still works for this visit. */ }
  }

  return (
    <button type="button" onClick={toggle} title="Change color theme" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:text-ink">
      <span className="inline-flex dark:hidden"><Moon size={16} aria-hidden="true" /><span className="sr-only">Dark mode</span></span>
      <span className="hidden dark:inline-flex"><Sun size={16} aria-hidden="true" /><span className="sr-only">Light mode</span></span>
    </button>
  );
}
