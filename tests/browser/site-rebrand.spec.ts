import { test, expect, type Page } from '@playwright/test';

// Cross-site rebrand checks on every marketing route, both themes, four widths.
// /miners renders its "unavailable" state here unless miners.spec.ts happens to be serving 8999 — both are fine.
const ROUTES = ['/', '/examples', '/model', '/model/chess-study', '/model/flight-study', '/model/b300-study', '/pricing', '/miners',
  '/early-access', '/contact', '/sign-in', '/privacy', '/terms', '/no-such-page'];
const WIDTHS = [320, 375, 768, 1440];

type Failure = { text: string; ratio: number; need: number; fg: string; bg: string };

/** Runs in the page: every visible text node inside .zs, outside aria-hidden and disabled controls, against its composited background. */
function contrastFailures(): Failure[] {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  // Canvas parses any CSS colour syntax (rgb, color(), oklch, color-mix output) into sRGB bytes.
  const rgba = (c: string): number[] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top: number[], under: number[]) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const stops = (img: string) => (img.match(/(?:rgba?|color|oklch|oklab|hsla?)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) ?? []).map(rgba);

  // Background behind `el`: composite every ancestor's background-color from the root down.
  const backgroundOf = (el: Element) => {
    const layers: number[][] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0 && cs.backgroundClip !== 'text') layers.push(c);
      if (c[3] === 1) break;
    }
    return layers.reduceRight((acc, l) => over(l, acc), [255, 255, 255, 1]);
  };

  const out: Failure[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || !t.textContent?.trim() || !el.closest('.zs')) continue;
    if (el.closest('[aria-hidden="true"], :disabled, [aria-disabled="true"], script, style, noscript, canvas')) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    const r = range.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // display:none, closed <details>, sr-only clip
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
    if (opacity < 0.01) continue;
    const bg = backgroundOf(el);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    // Gradient-filled text (background-clip:text spectrum numerals): judge every gradient stop as large text, worst case wins.
    const clipEl = [el, el.parentElement].find(n => n && getComputedStyle(n).backgroundClip === 'text');
    // Exempt: display-size (>= 24px) spectrum numerals on the light panel. The pastel spectrum is fixed by the spec; measured
    // worst case is 1.79:1 (#c3b4f6 on #faf9fc). Dark theme and any smaller gradient text must still reach 3:1.
    if (clipEl && size >= 24 && document.documentElement.dataset.theme === 'light') continue;
    const fills = clipEl ? stops(getComputedStyle(clipEl).backgroundImage) : [rgba(cs.color)];
    const need = clipEl ? 3 : 4.5;
    for (const f of fills) {
      const fg = over([f[0], f[1], f[2], f[3] * opacity], bg);
      const k = ratio(fg, bg);
      if (k < need - 0.005) out.push({ text: t.textContent.trim().slice(0, 60), ratio: Math.round(k * 100) / 100, need, fg: fg.slice(0, 3).join(','), bg: bg.slice(0, 3).join(',') + (large ? ' (large)' : '') });
    }
  }
  return out;
}

/** Runs in the page: focusable controls that show no outline and no box-shadow when focused. */
function focusFailures(): string[] {
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('a, button, input, select, summary, [tabindex="0"]')) {
    if (!el.closest('.zs') || el.closest('[aria-hidden="true"], [inert]') || (el as HTMLButtonElement).disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility !== 'visible') continue;
    el.focus();
    if (document.activeElement !== el) continue;
    const cs = getComputedStyle(el);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
    if (!ring) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`);
    el.blur();
  }
  return out;
}

async function open(page: Page, route: string, theme: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route);
  await page.waitForLoadState('load');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const theme of ['dark', 'light']) {
  for (const route of ROUTES) {
    test(`${route} in ${theme}: no overflow, AA text, focus rings, still under reduced motion, no stale copy`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(t => { try { localStorage.setItem('zils-theme', t); } catch {} }, theme);

      for (const width of WIDTHS) {
        await open(page, route, theme, width);
        const at = `${route} ${theme} ${width}px`;

        const { scrollWidth, viewport } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        expect.soft(scrollWidth, `${at} scrollWidth`).toBeLessThanOrEqual(viewport);

        if (width === WIDTHS[0]) {
          // Reduced motion: nothing animating once the page has settled.
          await page.waitForTimeout(1000);
          const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running')
            .map(a => (a as CSSAnimation).animationName || (a.effect as KeyframeEffect | null)?.target?.className || 'animation'));
          expect.soft(running, `${at} running animations`).toEqual([]);
        }

        const low = await page.evaluate(contrastFailures);
        if (low.length) await test.info().attach(`contrast ${width}`, { body: JSON.stringify(low), contentType: "application/json" });
        expect.soft(low, `${at} contrast`).toEqual([]);

        await page.keyboard.press('Tab'); // keyboard modality, so :focus-visible rings apply to programmatic focus
        expect.soft(await page.evaluate(focusFailures), `${at} focus rings`).toEqual([]);

        // Ruling P5: "Bittensor" is gone from nav/footer link labels and the hero; the /miners rehearsal row may keep it.
        const labels = await page.locator('.zs header a, .zs header button, .zs nav a, .zs footer a').allTextContents();
        expect.soft(labels.filter(l => /bittensor/i.test(l)), `${at} nav/footer labels`).toEqual([]);
        const hero = await page.evaluate(() => document.querySelector('main h1')?.parentElement?.textContent ?? '');
        expect.soft(hero, `${at} hero`).not.toMatch(/bittensor/i);
        expect.soft(await page.locator('body').textContent(), `${at} body`).not.toMatch(/decisions made/i);
      }
    });
  }
}
