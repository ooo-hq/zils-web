import { test, expect, type Page } from '@playwright/test';

// Cross-site rebrand checks on every marketing route, both themes, four widths.
// /miners renders its "unavailable" state here unless miners.spec.ts happens to be serving 8999 — both are fine.
const ROUTES = ['/', '/examples', '/model', '/model/chess-study', '/model/flight-study', '/model/b300-study', '/pricing', '/miners', '/miners/tracks/box',
  '/early-access', '/contact', '/sign-in', '/privacy', '/terms', '/no-such-page'];
const WIDTHS = [320, 375, 768, 1440];

type Failure = { text: string; ratio?: number; need?: number; fg?: string; bg?: string; issue?: string };

// Text whose backdrop includes a background-image layer (gradient, spectrum, grain) between it and the nearest opaque
// background-color cannot be judged against a flat colour. Each known case is listed here with its reason; any other fails.
// None today: the spectrum and grain only fill bars, skylines and swatches that carry no text.
// Text over the hero canvas is not listed: it is measured against the worst canvas pixel under its box (see below).
const IMAGE_BACKDROP_ALLOW: [selector: string, reason: string][] = [];

/** Runs in the page: every visible text node inside .zs, outside aria-hidden and disabled controls, against its composited background. */
function contrastFailures(allow: [string, string][]): Failure[] {
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

  // Background behind `el`: composite every ancestor's background-color from the root down. `image` is the first element
  // on the way up (before an opaque colour) that paints a background-image under the text.
  const backgroundOf = (el: Element) => {
    const layers: number[][] = [];
    let image: Element | null = null, base: Element = document.documentElement;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundClip === 'text') continue;
      if (!image && cs.backgroundImage !== 'none') image = n;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) { base = n; break; }
    }
    return { color: layers.reduceRight((acc, l) => over(l, acc), [255, 255, 255, 1]), image, base };
  };
  const canvases = [...document.querySelectorAll<HTMLCanvasElement>('.zs canvas')].filter(c => c.width && c.height);
  const describe = (n: Element) => `${n.tagName.toLowerCase()}.${[...n.classList].join('.')}`;

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
    const { color: flat, image, base } = backgroundOf(el);
    if (image) {
      if (!allow.some(([sel]) => el.closest(sel))) out.push({ text: t.textContent.trim().slice(0, 60), issue: `unlisted background-image backdrop on ${describe(image)}` });
      continue;
    }
    // A canvas painted above the nearest opaque layer and under this text (the hero field) is part of its backdrop:
    // composite every canvas pixel under the text box over the flat colour and keep the one with the worst contrast.
    let backdrops = [flat];
    for (const cv of canvases) {
      if (!base.contains(cv)) continue;
      const c = cv.getBoundingClientRect();
      const x0 = Math.max(r.left, c.left), x1 = Math.min(r.right, c.right), y0 = Math.max(r.top, c.top), y1 = Math.min(r.bottom, c.bottom);
      if (x0 >= x1 || y0 >= y1) continue;
      const sx = cv.width / c.width, sy = cv.height / c.height;
      const d = cv.getContext('2d')!.getImageData(Math.floor((x0 - c.left) * sx), Math.floor((y0 - c.top) * sy), Math.max(1, Math.ceil((x1 - x0) * sx)), Math.max(1, Math.ceil((y1 - y0) * sy))).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) backdrops.push(over([d[i], d[i + 1], d[i + 2], d[i + 3] / 255], flat));
    }
    backdrops = backdrops.filter((b, i, all) => all.findIndex(o => o.join() === b.join()) === i);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    // Gradient-filled text (background-clip:text spectrum numerals): judge every gradient stop as large text, worst case wins.
    const clipEl = [el, el.parentElement].find(n => n && getComputedStyle(n).backgroundClip === 'text');
    const fills = clipEl ? stops(getComputedStyle(clipEl).backgroundImage) : [rgba(cs.color)];
    const need = clipEl ? 3 : 4.5;
    for (const f of fills) {
      const [k, fg, bg] = backdrops.map(b => { const c = over([f[0], f[1], f[2], f[3] * opacity], b); return [ratio(c, b), c, b] as const; })
        .reduce((w, x) => (x[0] < w[0] ? x : w));
      if (k < need - 0.005) out.push({ text: t.textContent.trim().slice(0, 60), ratio: Math.round(k * 100) / 100, need, fg: fg.slice(0, 3).join(','), bg: bg.slice(0, 3).join(',') + (large ? ' (large)' : '') });
    }
  }
  return out;
}

/** Runs in the page: focusable controls whose focus state adds no visible outline and changes no box-shadow. */
function focusFailures(): string[] {
  const out: string[] = [];
  const settle = (el: Element) => el.getAnimations().forEach(a => { try { a.finish(); } catch {} }); // read end states, not mid-transition values
  const visibleOutline = (cs: CSSStyleDeclaration) => {
    if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 1) return '';
    const a = /rgba\([^)]*,\s*([\d.]+)\)/.exec(cs.outlineColor)?.[1];
    return a !== undefined && Number(a) === 0 || cs.outlineColor === 'transparent' ? '' : `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} ${cs.outlineOffset}`;
  };
  for (const el of document.querySelectorAll<HTMLElement>('a, button, input, select, summary, [tabindex="0"]')) {
    if (!el.closest('.zs') || el.closest('[aria-hidden="true"], [inert]') || (el as HTMLButtonElement).disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility !== 'visible') continue;
    if (document.activeElement === el) el.blur();
    settle(el);
    const before = getComputedStyle(el);
    const was = { outline: visibleOutline(before), shadow: before.boxShadow };
    el.focus();
    if (document.activeElement !== el) continue;
    settle(el);
    const now = getComputedStyle(el);
    const outline = visibleOutline(now);
    const ring = (outline !== '' && outline !== was.outline) || (now.boxShadow !== 'none' && now.boxShadow !== was.shadow);
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

        // Reduced motion: nothing animating 1 s after load (every width: layouts swap components at breakpoints).
        await page.waitForTimeout(1000);
        const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running')
          .map(a => (a as CSSAnimation).animationName || (a.effect as KeyframeEffect | null)?.target?.className || 'animation'));
        expect.soft(running, `${at} running animations`).toEqual([]);

        const low = await page.evaluate(contrastFailures, IMAGE_BACKDROP_ALLOW);
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
