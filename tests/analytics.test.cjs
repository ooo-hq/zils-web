const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync('instrumentation-client.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function configure(hostname, environment = 'production') {
  const calls = [];
  vm.runInNewContext(source, {
    exports: {},
    require(name) {
      assert.equal(name, '@plausible-analytics/tracker');
      return { init: config => calls.push(config) };
    },
    process: { env: { NODE_ENV: environment } },
    window: { location: { hostname } },
    URL,
  });
  return calls;
}

test('analytics initializes once only on production Zils domains', () => {
  for (const hostname of ['zils.ai', 'www.zils.ai']) {
    const calls = configure(hostname);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].domain, 'zils.ai');
    assert.equal(configure(hostname, 'development').length, 0);
  }
  for (const hostname of ['localhost', '127.0.0.1', 'zils-web-example.vercel.app', 'zils.ai.example.com']) {
    assert.equal(configure(hostname).length, 0);
  }
});

test('analytics removes auth codes and query data from page URLs and referrers', () => {
  const { transformRequest } = configure('zils.ai')[0];
  const event = transformRequest({
    n: 'pageview', d: 'zils.ai',
    u: 'https://zils.ai/train?code=private-code&email=person@example.com#access_token=private-token',
    r: 'https://example.com/private/account?token=private-referrer#secret',
  });
  assert.equal(event.u, 'https://zils.ai/train');
  assert.equal(event.r, 'https://example.com');
  assert.equal(event.n, 'pageview');
  assert.equal(JSON.stringify(event).includes('private'), false);
});

test('analytics excludes internal tools and artifact IDs while keeping public research', () => {
  const { transformRequest } = configure('zils.ai')[0];
  for (const path of ['/admin', '/admin/access', '/pricing-lab', '/pricing-lab/', '/a', '/a/private-id']) {
    assert.equal(transformRequest({ n: 'pageview', d: 'zils.ai', u: `https://zils.ai${path}` }), null);
  }
  for (const path of ['/', '/pricing', '/model', '/model/chess-study', '/early-access']) {
    const event = transformRequest({ n: 'pageview', d: 'zils.ai', u: `https://zils.ai${path}` });
    assert.equal(event.u, `https://zils.ai${path}`);
    assert.equal(event.r, null);
  }
});

test('malformed analytics URLs are ignored without disrupting the page', () => {
  const { transformRequest } = configure('zils.ai')[0];
  assert.equal(transformRequest({ n: 'pageview', d: 'zils.ai', u: 'invalid' }), null);
  assert.equal(transformRequest({ n: 'pageview', d: 'zils.ai', u: 'https://zils.ai/', r: 'invalid' }), null);
});
