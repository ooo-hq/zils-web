export const THEME_STORAGE_KEY = 'zils-theme';

// Runs in the head before first paint, including when app scripts load slowly.
export const themeScript = `(() => {
  let preference;
  try { preference = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  const root = document.documentElement;
  if (preference === 'light' || preference === 'dark') root.dataset.themePreference = preference;
  root.dataset.theme = root.dataset.themePreference || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();`;
