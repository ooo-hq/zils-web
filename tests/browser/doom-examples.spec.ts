import { test, expect } from '@playwright/test';
import doom from '../../data/doom-examples.json';

const seconds = (tics: number) => `${(tics / doom.fps).toFixed(1)} s`;
const exit = `Reached the exit · ${seconds(doom.clips.zils.gameTics)}`;
const died = `Died · ${seconds(doom.clips.jev.gameTics)}`;

test('Doom opens first with both recordings; statuses flip on end and Replay restarts', async ({ page }) => {
  await page.goto('/examples');
  await expect(page.getByRole('button', { name: /Survive Doom/ })).toHaveAttribute('aria-pressed', 'true');
  const zils = page.getByRole('region', { name: 'Zils recording', exact: true });
  const jev = page.getByRole('region', { name: 'TypeSafe JEV recording', exact: true });
  await expect(page.locator('video')).toHaveCount(2);
  await expect(page.locator('video').first()).toHaveAttribute('preload', /none|metadata/);
  await page.evaluate(() => document.querySelectorAll('video').forEach(video => video.dispatchEvent(new Event('ended'))));
  await expect(zils).toContainText(exit);
  await expect(jev).toContainText(died);
  await page.getByRole('button', { name: /Replay/ }).click();
  await expect(zils).not.toContainText(exit);
  await page.getByText('Full test details', { exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('Scripted reference');
  await expect(page.getByRole('table').first()).toContainText('97/100');
  await expect(page.getByText(/seed 100085, was an operator-interrupted episode/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'All 100 starts (CSV)' })).toHaveAttribute('href', '/examples/doom/all-100-seeds.csv');
});

test('Doom keeps its game notes inside the demo', async ({ page }) => {
  await page.goto('/examples');
  await page.getByText('Behind this game', { exact: true }).click();
  await expect(page.getByText(/Test seed 100001 is a selected highlight/)).toBeVisible();
});

test('Doom stacks on a phone without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples');
  await expect(page.getByRole('region', { name: 'TypeSafe JEV recording', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Doom shows the recorded outcomes at once under reduced motion, without playing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { (window as unknown as { __plays: string[] }).__plays = []; HTMLMediaElement.prototype.play = function () { (window as unknown as { __plays: string[] }).__plays.push(this.getAttribute('aria-label')!); return Promise.resolve(); }; });
  await page.goto('/examples');
  await expect(page.getByRole('region', { name: 'Zils recording', exact: true })).toContainText(exit);
  await expect(page.getByRole('region', { name: 'TypeSafe JEV recording', exact: true })).toContainText(died);
  expect(await page.evaluate(() => (window as unknown as { __plays: string[] }).__plays)).toEqual([]);
});

test('on a phone each Doom clip starts only once it is scrolled into view', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 380 });
  await page.addInitScript(() => { (window as unknown as { __plays: string[] }).__plays = []; HTMLMediaElement.prototype.play = function () { (window as unknown as { __plays: string[] }).__plays.push(this.getAttribute('aria-label')!); return Promise.resolve(); }; });
  await page.goto('/examples');
  const plays = () => page.evaluate(() => (window as unknown as { __plays: string[] }).__plays);
  await page.evaluate(() => window.scrollBy(0, document.querySelector('video')!.getBoundingClientRect().top - 56));
  await expect.poll(plays).toEqual([expect.stringContaining('Zils on test seed')]);
  await page.waitForTimeout(500);
  expect(await plays()).toHaveLength(1);
  await page.evaluate(() => window.scrollBy(0, document.querySelectorAll('video')[1].getBoundingClientRect().top - 56));
  await expect.poll(async () => (await plays()).length).toBe(2);
  expect((await plays())[1]).toContain('TypeSafe JEV');
});
