'use client';

import { useLayoutEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_STORAGE_KEY } from '@/lib/theme';

function applyTheme(preference?: string | null) {
  const root = document.documentElement;
  const explicit = preference === 'light' || preference === 'dark';
  if (explicit) root.dataset.themePreference = preference;
  else delete root.dataset.themePreference;
  root.dataset.theme = explicit ? preference : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function ThemeSync() {
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    let preference = document.documentElement.dataset.themePreference;
    try { preference = localStorage.getItem(THEME_STORAGE_KEY) ?? undefined; } catch { /* Storage can be disabled. */ }
    applyTheme(preference);
    const onSystemChange = () => applyTheme(document.documentElement.dataset.themePreference);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(event.newValue);
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
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
