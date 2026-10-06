import { test, expect } from '@playwright/test';

test('decision example advances quickly without moving the panel, and can pause and resume', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pause decision animation' })).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.clock.runFor(100);
  const probabilities = page.getByRole('img', { name: /^Probabilities:/ });
  const panel = probabilities.locator('..');
  const first = await probabilities.getAttribute('aria-label');
  const height = (await panel.boundingBox())!.height;
  await page.clock.runFor(3600);
  await expect(probabilities).not.toHaveAttribute('aria-label', first!);
  expect((await panel.boundingBox())!.height).toBe(height);
  await page.clock.runFor(3400);
  expect((await panel.boundingBox())!.height).toBe(height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Pause decision animation' }).click();
  const paused = await panel.innerText();
  await page.clock.runFor(5000);
  expect(await panel.innerText()).toBe(paused);
  await page.getByRole('button', { name: 'Play decision animation' }).click();
  await page.clock.runFor(3600);
  expect(await panel.innerText()).not.toBe(paused);
});

test('reduced motion keeps a complete, still decision example', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const probabilities = page.getByRole('img', { name: /^Probabilities:/ });
  await expect(probabilities).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause decision animation' })).toBeHidden();
  const panel = probabilities.locator('..');
  const initial = await panel.innerText();
  await page.clock.runFor(10000);
  expect(await panel.innerText()).toBe(initial);
  await expect(panel).toContainText('0.86');
  await expect(panel).not.toContainText('Reading context');
});
