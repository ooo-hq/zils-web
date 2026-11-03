import { test, expect, type Page } from '@playwright/test';
import { signIn } from './signed-in';

test.use({ viewport: { width: 1440, height: 900 } });

// scrollbar-gutter: stable reserves 15px in headless Chromium, so measure against the layout width, not innerWidth.
const centered = (page: Page) => page.evaluate(() => {
  const r = document.querySelector('nav[aria-label="Main navigation"]')!.getBoundingClientRect();
  return Math.abs((r.left + r.right) / 2 - document.documentElement.getBoundingClientRect().width / 2);
});

test('signed out: centered nav, Sign in and Early access', async ({ page }) => {
  await page.goto('/model');
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '/sign-in');
  await expect(header.getByRole('link', { name: 'Early access', exact: true })).toBeVisible();
  expect(await centered(page)).toBeLessThanOrEqual(2);
});

test('signed in: centered nav, Account menu replaces Early access', async ({ page }) => {
  await signIn(page);
  await page.goto('/model');
  const header = page.locator('header');
  await header.getByRole('button', { name: 'Account', exact: true }).click();
  for (const name of ['Your workspace', 'Billing']) await expect(header.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Early access', exact: true })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
  expect(await centered(page)).toBeLessThanOrEqual(2);
});

test('no Bittensor link; current page is marked; Research lives in the footer', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('header, footer').getByRole('link', { name: /bittensor/i })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Z3', 'Examples', 'Soup', 'Merge', 'Miners', 'Pricing', 'Contact', 'Docs']);
  await expect(nav.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', /^https:\/\/docs\.zils\.ai/);
  await expect(nav.getByRole('link', { name: 'Pricing' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Research' })).toHaveCount(0);
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await expect(footer.getByRole('link', { name: 'Research', exact: true })).toHaveAttribute('href', '/model');
  for (const name of ['Z3', 'Bases', 'Roadmap']) await expect(footer.getByRole('link', { name, exact: true })).toHaveCount(0);
});

test('/soup and /merge are in the header and mark themselves current', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [path, label] of [['/soup', 'Soup'], ['/merge', 'Merge']]) {
    await page.goto(path);
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
  }
});

test('footer sits at the bottom of a short page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto('/contact');
  const bottom = await page.locator('footer').evaluate(el => el.getBoundingClientRect().bottom + window.scrollY);
  expect(Math.abs(bottom - (await page.evaluate(() => document.documentElement.scrollHeight)))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1600);
});

test('wordmark is never uppercase', async ({ page }) => {
  await page.goto('/model');
  for (const scope of ['header', 'footer']) {
    const mark = page.locator(scope).getByRole('link', { name: 'Zils home' }).locator('span').first();
    expect(await mark.evaluate(el => getComputedStyle(el).textTransform)).toBe('none');
  }
});

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('opens, lists links, navigates, closes on Escape', async ({ page }) => {
    await page.goto('/pricing');
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('group', { name: 'Site menu' });
    await expect(panel.getByRole('link')).toHaveText(['Z3', 'Examples', 'Soup', 'Merge', 'Miners', 'Pricing', 'Contact', 'Docs', 'Sign in']);
    await expect(panel.getByRole('link', { name: 'Pricing' })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(menu).toBeFocused();
    await menu.click();
    await page.getByRole('group', { name: 'Site menu' }).getByRole('link', { name: 'Miners' }).click();
    await expect(page).toHaveURL(/\/miners$/);
    await expect(page.getByRole('group', { name: 'Site menu' })).toHaveCount(0);
  });
  test('outside click closes it', async ({ page }) => {
    await page.goto('/model');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.mouse.click(300, 600);
    await expect(page.getByRole('group', { name: 'Site menu' })).toHaveCount(0);
  });
  for (const signedIn of [false, true]) test(`no horizontal overflow at 320px (${signedIn ? 'signed in' : 'signed out'})`, async ({ page }) => {
    if (signedIn) await signIn(page);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/model');
    await expect(page.locator('header').getByRole(signedIn ? 'button' : 'link', { name: signedIn ? 'Account' : 'Early access', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const r = await page.locator('header.zs').evaluate(h => [h.scrollWidth, h.clientWidth]);
    expect(r[0]).toBeLessThanOrEqual(r[1]);
  });
});

test('Menu button is hidden at 1440px', async ({ page }) => {
  await page.goto('/model');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
});
