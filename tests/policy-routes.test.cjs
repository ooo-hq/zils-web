const test = require('node:test');
const assert = require('node:assert/strict');
const { unstable_getResponseFromNextConfig, getRedirectUrl } = require('next/experimental/testing/server');

test('Zils policy routes stay on Zils while legacy Fez product routes still redirect', async () => {
  const { default: nextConfig } = await import('../next.config.mjs');
  for (const path of ['/privacy', '/terms']) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://zils.ai${path}`, nextConfig });
    assert.equal(getRedirectUrl(response), null, path);
    assert.equal(response.status, 200, path);
  }
  const legacy = await unstable_getResponseFromNextConfig({ url: 'https://zils.ai/app', nextConfig });
  assert.equal(getRedirectUrl(legacy), 'https://fez.chat/app');
  assert.equal(legacy.status, 308);
});
