import { test, expect, type Page } from '@playwright/test';

const URL = '/dev-preview/sorting-hero';
const ANSWER = /^> answer (Billing|Spam|Account changes|Technical support|Sales|Needs review)$/;

const frames = (page: Page) => page.evaluate(() => Number(document.querySelector('[data-field-top]')?.getAttribute('data-frames') ?? 0));

for (const width of [1440, 1100, 768, 375, 320]) {
  test(`console sits at least 40px above the answer field at ${width}px, no overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => {
      const wrap = document.querySelector('[data-field-top]')!;
      const con = document.querySelector('[data-console]')!;
      const gap = Number(wrap.getAttribute('data-field-top')) - (con.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top);
      return gap >= 40;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('pill reads LIVE DEMO, no decisions counter, canvas is aria-hidden', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('[data-console]').getByText('LIVE DEMO', { exact: true })).toBeVisible();
  await expect(page.getByText(/decisions made/i)).toHaveCount(0);
  await expect(page.locator('[data-field-top] canvas')).toHaveAttribute('aria-hidden', 'true');
});

test('the console narrates a decision within 6s at 1440px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  await expect(page.locator('[data-console-line]').filter({ hasText: ANSWER }).first()).toBeVisible({ timeout: 6000 });
});

test('reduced motion: one static frame and one completed decision', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  await page.waitForTimeout(3000);
  expect(await frames(page)).toBeLessThanOrEqual(1);
  const lines = page.locator('[data-console-line]');
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toHaveText(/^> in .+/);
  await expect(lines.nth(1)).toHaveText(ANSWER);
  await expect(lines.nth(2)).toHaveText(/^> confidence 0\.\d\d$/);
});

test('a hidden tab stops drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(URL);
  await expect.poll(() => frames(page)).toBeGreaterThan(5);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  const before = await frames(page);
  await page.waitForTimeout(2000);
  expect(await frames(page)).toBe(before);
});

test('light mode: the skyline reads its colors from CSS', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zils-theme', 'light'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => frames(page)).toBeGreaterThan(0);
  // The dark dip sits at 24% of the skyline gradient; its light value is a pale lilac.
  const px = await page.evaluate(() => {
    const cv = document.querySelector('[data-field-top] canvas') as HTMLCanvasElement;
    const dpr = cv.width / cv.clientWidth, W = cv.clientWidth, H = cv.clientHeight, left = 56, cell = (W - 112) / 10;
    return Array.from(cv.getContext('2d')!.getImageData(Math.round((left + 2.4 * cell) * dpr), Math.round((H - 21) * dpr), 1, 1).data);
  });
  expect(px.slice(0, 3)).not.toEqual([0, 0, 0]);
  expect(Math.min(...px.slice(0, 3))).toBeGreaterThan(128);
});

test('a resize mid-animation keeps the console clear of the field', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL);
  await expect.poll(() => frames(page)).toBeGreaterThan(5);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect.poll(() => page.evaluate(() => {
    const wrap = document.querySelector('[data-field-top]')!;
    const con = document.querySelector('[data-console]')!;
    return Number(wrap.getAttribute('data-field-top')) - (con.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top) >= 40
      && document.documentElement.scrollWidth <= window.innerWidth;
  })).toBe(true);
});
