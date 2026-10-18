import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

// Records the pre-rebrand copy so later tasks can prove nothing was dropped. Run with RECORD_BASELINE=1.
test.skip(!process.env.RECORD_BASELINE, 'set RECORD_BASELINE=1 to record');

test('record content baseline', async ({ page }) => {
  await page.goto('/model');
  // Collapsed <details> hide their tables; textContent still reads them, and opening keeps the page honest.
  await page.locator('details').evaluateAll(els => els.forEach(d => ((d as HTMLDetailsElement).open = true)));
  const tables = await page.locator('table').evaluateAll(els => els.map(t => {
    const caption = t.querySelector('caption')?.textContent
      ?? (() => { let n: Element | null = t; while (n) { let p = n.previousElementSibling; while (p) { const h = /^H[1-6]$/.test(p.tagName) ? p : p.querySelector('h1,h2,h3,h4,h5,h6'); if (h) return h.textContent; p = p.previousElementSibling; } n = n.parentElement; } return ''; })();
    return { caption: caption ?? '', rows: [...t.querySelectorAll('tr')].map(r => (r as HTMLElement).innerText) };
  }));
  const policy = async (path: string) => {
    await page.goto(path);
    return page.locator('main').evaluate(m => ({ h2: [...m.querySelectorAll('h2')].map(h => (h as HTMLElement).innerText), paragraphs: m.querySelectorAll('p').length }));
  };
  const privacy = await policy('/privacy');
  const terms = await policy('/terms');
  await page.goto('/bittensor');
  // /bittensor redirects to /miners now; re-recording must capture the old page, not the new one.
  if (new URL(page.url()).pathname !== '/bittensor') throw new Error(`/bittensor redirected to ${page.url()}; check out a commit before the redirect to re-record`);
  const text = await page.locator('main').innerText();
  const clean = (p: { h2: string[]; paragraphs: number }) => ({ h2: p.h2.map(norm), paragraphs: p.paragraphs });
  const data = {
    model: { tables: tables.map(t => ({ caption: norm(t.caption), rows: t.rows.map(norm) })) },
    privacy: clean(privacy), terms: clean(terms), bittensor: { text: norm(text) },
  };
  const empty = data.model.tables.flatMap(t => t.rows.length ? t.rows.map(r => [t.caption, r]) : [[t.caption, '']]).filter(([, r]) => !r.trim());
  if (empty.length || !data.model.tables.length || !data.bittensor.text) throw new Error(`empty baseline content: ${JSON.stringify(empty)}`);
  writeFileSync('tests/browser/fixtures/content-baseline.json', JSON.stringify(data, null, 2) + '\n');
});
