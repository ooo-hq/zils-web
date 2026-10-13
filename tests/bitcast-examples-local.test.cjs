const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = readFileSync(path.join(__dirname, '../app/(home)/examples/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function loadPage(mode, readFile) {
  const compiledModule = { exports: {} };
  const notFound = new Error('not found');
  const localRequire = name => {
    if (name === 'node:fs/promises') return { readFile };
    if (name === 'next/navigation') return { notFound: () => { throw notFound; } };
    if (name.startsWith('@/components/')) return new Proxy({}, { get: () => () => null });
    return require(name);
  };
  vm.runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports, require: localRequire,
    process: { env: { NODE_ENV: mode }, cwd: () => '/local-preview' },
  });
  return { page: compiledModule.exports.default, notFound };
}

test('production refuses the examples route before reading customer data', async () => {
  let reads = 0;
  const { page, notFound } = loadPage('production', async () => { reads++; return '{}'; });
  await assert.rejects(page, error => error === notFound);
  assert.equal(reads, 0);
});

test('a missing local dataset returns not found; other read errors are not hidden', async () => {
  const missing = loadPage('development', async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); });
  await assert.rejects(missing.page, error => error === missing.notFound);
  const failure = new Error('permission denied');
  const unreadable = loadPage('development', async () => { throw failure; });
  await assert.rejects(unreadable.page, error => error === failure);
});

function exampleData() {
  return {
    examples: [{ id: 'demo', title: 'Demo', brand: 'Demo', tag: 'Demo', summary: '', analysis: '', brief: 'Discuss a product', content: 'A post', productionReasoning: '', decisions: { production: 'pass', base: 'fail', zils: 'pass', jev: 'fail' } }],
    scores: [{ name: 'Demo', note: '', matches: 1, total: 2 }],
    replies: [{ id: 'reply', content: 'This is not my role', previous: null, intent: 'wrong_person', expected: 'wrong_person', jev: 'negative', before: 'wrong_person' }],
    chess: {
      examples: [{
        id: 'position', title: 'Rook finish', side: 'white', board: '..........K.....k........p..................R..P.......r........',
        moves: [
          { uci: 'e3e6', label: 'Rook to e6', fromSquare: 'e3', toSquare: 'e6', board: '..........K.....k...R....p.....................P.......r........', mate: false },
          { uci: 'e3a3', label: 'Rook to a3', fromSquare: 'e3', toSquare: 'a3', board: '..........K.....k........p..............R......P.......r........', mate: true },
        ],
        zils: 'e3a3', jev: 'e3e6', before: 'e3e6',
      }],
      scores: { trained: 260, shared: 220, jev: 223 }, total: 512,
    },
  };
}

test('local examples validate verdicts and score bounds before rendering', async () => {
  const data = exampleData();
  const valid = loadPage('development', async file => {
    assert.equal(file, '/local-preview/.private/bitcast-examples.json');
    return JSON.stringify(data);
  });
  assert.ok(await valid.page());
  data.examples[0].decisions.zils = 'unknown';
  await assert.rejects(loadPage('development', async () => JSON.stringify(data)).page);
  data.examples[0].decisions.zils = 'pass';
  data.scores[0].matches = 3;
  await assert.rejects(loadPage('development', async () => JSON.stringify(data)).page);
});

test('replay data rejects unmapped intents, false match claims, and missing or inconsistent moves', async () => {
  const invalidChanges = [
    data => { data.replies[0].intent = 'unknown'; },
    data => { data.replies[0].jev = 'unknown'; },
    data => { data.replies[0].expected = 'not_now'; },
    data => { data.chess.examples[0].zils = 'h1h8'; },
    data => { data.chess.examples[0].jev = 'h1h8'; },
    data => { data.chess.examples[0].jev = data.chess.examples[0].zils; },
    data => { data.chess.examples[0].zils = data.chess.examples[0].jev; },
    data => { data.chess.examples[0].moves[0].toSquare = 'a8'; },
    data => { data.chess.examples[0].board = 'incomplete'; },
    data => { data.chess.scores.jev = 513; },
    data => { data.replies = []; },
    data => { data.chess.examples = []; },
  ];
  for (const change of invalidChanges) {
    const data = exampleData();
    change(data);
    await assert.rejects(loadPage('development', async () => JSON.stringify(data)).page);
  }
});
