const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

// The browser server always sets ZILS_DEV_PREVIEW=1, so it cannot see the 404. Check the guard in source instead:
// every fixture page must call notFound() before rendering unless the flag is exactly '1'.
const root = path.join(__dirname, '..', 'app', '(home)', 'dev-preview');

test('every dev-preview fixture 404s without ZILS_DEV_PREVIEW=1', () => {
  const pages = readdirSync(root).map(d => path.join(root, d, 'page.tsx'));
  assert.ok(pages.length >= 2);
  for (const file of pages) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /import \{ notFound \} from 'next\/navigation';/, file);
    const body = src.slice(src.indexOf('export default function Page() {'));
    assert.match(body, /^export default function Page\(\) \{\s*if \(process\.env\.ZILS_DEV_PREVIEW !== '1'\) notFound\(\);/, file);
  }
});
