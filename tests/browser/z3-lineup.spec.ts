import { expect, test } from '@playwright/test';

test('/z3 lineup: lite and mini are live, four equal towers fill the skyline', async ({ page }) => {
  await page.goto('/z3');
  const rows = page.getByRole('table', { name: 'z3 model line and release status' }).locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: 'z3-lite' })).toContainText('v1 · Founding baseline');
  await expect(rows.filter({ hasText: 'z3-mini' })).toContainText('v1 · Founding baseline');
  await expect(rows.filter({ hasText: 'z3-flash' })).toContainText('Planned');
  await expect(rows.filter({ has: page.getByRole('rowheader', { name: 'z3', exact: true }) })).toContainText('Planned');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /four decision-model lineages/);

  // Every lineage gets an equal share of the skyline, with no empty column on the right.
  const widths = await page.locator('[data-released], [style*="--h"]').evaluateAll(cols => {
    const parent = (cols[0] as HTMLElement).parentElement!;
    const total = parent.getBoundingClientRect().width;
    return cols.map(c => (c as HTMLElement).getBoundingClientRect().width / total);
  });
  expect(widths).toHaveLength(4);
  for (const w of widths) expect(w).toBeGreaterThan(0.24);
});
