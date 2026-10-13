const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const recordedExamples = require('../data/decision-examples.json');

const source = readFileSync(path.join(__dirname, '../app/(home)/examples/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function loadPage(data = recordedExamples) {
  const compiledModule = { exports: {} };
  const localRequire = name => {
    if (name === '@/data/decision-examples.json') return data;
    if (name.startsWith('@/components/')) return new Proxy({}, { get: () => () => null });
    if (name.startsWith('node:fs')) throw new Error('Examples must not require local files');
    return require(name);
  };
  vm.runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports, require: localRequire,
    process: { env: { NODE_ENV: 'production' } },
  });
  return compiledModule.exports.default;
}

test('the published examples render in production from the bundled selection', () => {
  assert.ok(loadPage()());
  assert.equal(recordedExamples.examples.length, 5);
  assert.equal(recordedExamples.replies.length, 5);
  assert.equal(recordedExamples.chess.examples.length, 3);
});

test('lead examples match the reference where JEV misses, with consistent chess replays', () => {
  const firstPost = recordedExamples.examples[0].decisions;
  assert.equal(firstPost.zils, firstPost.production);
  assert.notEqual(firstPost.jev, firstPost.production);
  const firstReply = recordedExamples.replies[0];
  assert.equal(firstReply.intent, firstReply.expected);
  assert.notEqual(firstReply.jev, firstReply.expected);
  const index = square => (8 - Number(square[1])) * 8 + square.charCodeAt(0) - 97;
  for (const position of recordedExamples.chess.examples) {
    assert.equal(position.moves.find(move => move.uci === position.zils).mate, true);
    assert.equal(position.moves.find(move => move.uci === position.jev).mate, false);
    for (const move of position.moves) {
      const expected = [...position.board];
      assert.notEqual(expected[index(move.fromSquare)], '.');
      expected[index(move.toSquare)] = expected[index(move.fromSquare)];
      expected[index(move.fromSquare)] = '.';
      assert.equal(move.board, expected.join(''));
    }
  }
});

test('invalid scores, labels, or claimed chess wins fail validation', () => {
  const changes = [
    data => { data.examples[0].decisions.zils = 'unknown'; },
    data => { data.scores[0].matches = data.scores[0].total + 1; },
    data => { data.replies[0].intent = 'unknown'; },
    data => { data.replies[0].jev = 'unknown'; },
    data => { data.replies[0].expected = 'opt_out'; },
    data => { data.chess.examples[0].jev = data.chess.examples[0].zils; },
    data => { data.chess.examples[0].zils = data.chess.examples[0].jev; },
    data => { data.chess.examples[0].moves[0].toSquare = 'a8'; },
    data => { data.chess.examples[0].board = 'incomplete'; },
    data => { data.chess.scores.jev = 513; },
    data => { data.replies = []; },
    data => { data.chess.examples = []; },
  ];
  for (const change of changes) {
    const data = structuredClone(recordedExamples);
    change(data);
    assert.throws(loadPage(data));
  }
});
