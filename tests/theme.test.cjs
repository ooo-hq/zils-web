const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTheme, themeScript } = require('../.private/test-build/theme.js');

test('no saved choice resolves to dark', () => assert.equal(resolveTheme(null), 'dark'));
test('explicit choices win', () => { assert.equal(resolveTheme('light'), 'light'); assert.equal(resolveTheme('dark'), 'dark'); });
test('garbage resolves to dark', () => { for (const v of ['blue', '', undefined, 1]) assert.equal(resolveTheme(v), 'dark'); });
test('the pre-paint script no longer reads the OS preference', () => assert.ok(!themeScript.includes('prefers-color-scheme')));
