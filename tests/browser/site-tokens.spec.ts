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

test('t2/t3 text meets WCAG AA on every surface in both themes', async ({ page }) => {
  await page.goto('/contact');
  for (const theme of ['dark', 'light']) {
    const r = await page.evaluate(t => {
      document.documentElement.dataset.theme = t;
      const zs = document.createElement('div');
      zs.className = 'zs';
      document.body.appendChild(zs);
      const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const probe = (prop: string, v: string) => {
        const el = document.createElement('span');
        zs.appendChild(el);
        el.style.setProperty(prop, v);
        return rgba(getComputedStyle(el).getPropertyValue(prop === 'color' ? 'color' : 'background-color'));
      };
      const out: Record<string, number> = {};
      const alphas: Record<string, number> = {};
      for (const tok of ['t2', 't3']) {
        const fg = probe('color', `var(--zs-${tok})`);
        alphas[tok] = fg[3] ?? 1;
        for (const bgTok of ['gutter', 'panel', 'raised']) {
          const bg = probe('background-color', `var(--zs-${bgTok})`);
          const a = fg[3] ?? 1;
          const comp = [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
          const [l1, l2] = [lum(comp), lum(bg)].sort((x, y) => y - x);
          out[`${tok}/${bgTok}`] = (l1 + 0.05) / (l2 + 0.05);
        }
      }
      zs.remove();
      return { out, alphas };
    }, theme);
    for (const [k, v] of Object.entries(r.out)) expect(v, `${theme} ${k}`).toBeGreaterThanOrEqual(4.5);
    expect(r.alphas.t2).toBeGreaterThan(r.alphas.t3);
  }
});
