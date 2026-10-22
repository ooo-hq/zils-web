import { test, expect } from '@playwright/test';

test('estimate defaults, overage marker and end-of-credit line', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByTestId('estimate-total')).toHaveText('$6.00');
  await expect(page.getByTestId('estimate-left')).toContainText('$1.00 beyond your first $5 credit.');
  await expect(page.getByTestId('credit-end')).toBeVisible();
  const runs = page.getByRole('slider', { name: 'Additional training runs (at the $2 minimum)' });
  await runs.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(runs).toHaveAttribute('aria-valuetext', '2');
  await expect(page.getByTestId('estimate-total')).toHaveText('$10.00');
  await expect(page.getByTestId('credit-end')).toBeVisible();
  await expect(page.getByTestId('estimate-left')).toContainText('$5.00 beyond your first $5 credit.');
  await expect(page.getByRole('slider', { name: 'Decision requests' })).toHaveAttribute('aria-valuetext', '100,000');
});

test('small print holds the standard-run explanation and copy stays', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('What’s in a standard run?')).toBeVisible();
  await expect(page.getByText('prepaid credit. Your first standard training run is included')).toBeVisible();
  await expect(page.getByText('Paid access is coming. Top-ups are not available yet.')).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('no horizontal overflow at 375px, including overage', async ({ page }) => {
    await page.goto('/pricing');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    const runs = page.getByRole('slider', { name: 'Additional training runs (at the $2 minimum)' });
    await runs.focus();
    await page.keyboard.press('End');
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
