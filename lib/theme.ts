export const THEME_STORAGE_KEY = 'zils-theme';

// No saved choice (or anything unrecognised) means dark; only an explicit saved choice wins.
export function resolveTheme(saved: unknown): 'light' | 'dark' {
  return saved === 'light' ? 'light' : 'dark';
}

// Runs in the head before first paint, including when app scripts load slowly.
// Keep the rule in step with resolveTheme.
export const themeScript = `(() => {
  let saved;
  try { saved = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
})();`;
