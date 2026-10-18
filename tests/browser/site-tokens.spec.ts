import { test, expect } from '@playwright/test';

test('rebrand tokens resolve per theme and keep t3 readable', async ({ page }) => {
  await page.goto('/contact');
  const read = (theme: string) => page.evaluate(t => {
    document.documentElement.dataset.theme = t;
    document.getElementById('probe')?.remove();
    const probe = document.createElement('div');
    probe.className = 'zs';
    probe.id = 'probe';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    // t3 is an rgba() custom property; resolve it through a real colour.
    probe.style.color = 'var(--zs-t3)';
    return { panel: cs.getPropertyValue('--zs-panel').trim(), color: getComputedStyle(probe).color };
  }, theme);
  const alpha = (c: string) => Number(/rgba?\([^)]*?,\s*([\d.]+)\)/.exec(c)?.[1] ?? 1);

  const dark = await read('dark');
  expect(dark.panel).toBe('#18191e');
  expect(alpha(dark.color)).toBeGreaterThanOrEqual(0.5);
  const light = await read('light');
  expect(light.panel).toBe('#faf9fc');
  expect(alpha(light.color)).toBeGreaterThanOrEqual(0.5);
});
