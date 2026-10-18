import { test, expect } from '@playwright/test';
import { signIn } from './signed-in';

// Pixel baselines of the signed-in workspace; the rebrand must not change these pages.
for (const route of ['/train', '/models', '/playground', '/keys']) {
  for (const theme of ['light', 'dark']) {
    test(`workspace ${route} stays unchanged in ${theme}`, async ({ page }) => {
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
