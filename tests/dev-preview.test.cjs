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
    assert.match(src, /import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*['"]next\/navigation['"]/, file);
    // The guard must be the first statement of the default export, in any formatting (braces, return, async, props).
    assert.match(src, /export\s+default\s+(?:async\s+)?function\s+\w*\s*\([^)]*\)\s*(?::[^{]+)?\{\s*if\s*\(\s*process\.env\.ZILS_DEV_PREVIEW\s*!==\s*['"]1['"]\s*\)\s*(?:\{\s*)?(?:return\s+)?notFound\(\)/, file);
  }
});
