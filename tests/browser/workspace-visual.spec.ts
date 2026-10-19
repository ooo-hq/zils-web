import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

// Local visual diff of the workspace in the rebrand: baselines are darwin-only, so this never runs in CI.
test.skip(process.platform !== 'darwin' || !!process.env.CI, 'local darwin visual diff');

// Pixel baselines of the signed-in workspace in the rebrand; update them deliberately (--update-snapshots).
for (const route of ['/dashboard', '/train', '/models', '/playground', '/keys']) {
  for (const theme of ['light', 'dark']) {
    test(`workspace ${route} matches its baseline in ${theme}`, async ({ page }) => {
      await signIn(page);
      await page.addInitScript(t => localStorage.setItem('zils-theme', t), theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${route.slice(1)}-${theme}.png`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }
}
