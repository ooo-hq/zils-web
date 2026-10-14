const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const recorded = require('../data/oro-examples.json');
const compiled = ts.transpileModule(readFileSync(require.resolve('../lib/oro-examples.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
function load(data = recorded) {
  const mod = { exports: {} };
  vm.runInNewContext(compiled, { module: mod, exports: mod.exports,
    require: name => name === '../data/oro-examples.json' ? data : require(name) });
  return mod.exports;
}
const { disclosureAction, oroJudgment, oroExamples } = load();

test('ORO disclosure boundaries preserve multiple-question precedence and uncertainty', () => {
  assert.equal(disclosureAction({ all: .7, 'facet:need': .99, asks: 1 }), 'one_at_a_time');
  assert.equal(disclosureAction({ all: .69, 'facet:need': .7, asks: 1 }), 'reveal');
  assert.equal(disclosureAction({ all: .5, 'facet:need': .6999, asks: 1 }), 'no_disclosure');
  assert.deepEqual([.3, .3001, .6999, .7].map(oroJudgment), ['No', 'Unsure', 'Unsure', 'Yes']);
});

test('recorded cases open on the quoted-message disagreement, then two agreement cases', () => {
  assert.deepEqual(Array.from(oroExamples.cases, row => [disclosureAction(row.zils), disclosureAction(row.jev)]), [
    ['no_disclosure', 'reveal'], ['reveal', 'reveal'], ['one_at_a_time', 'one_at_a_time'],
  ]);
  assert.equal(oroExamples.cases[0].id, 'test-27-01');
  assert.equal(oroExamples.cases[0].jev['facet:need'], .77);
});

test('invalid recorded probabilities, counts and empty examples fail validation', () => {
  for (const change of [
    data => { data.cases[0].zils.all = 1.1; },
    data => { data.cases[0].jev.asks = -1; },
    data => { data.cases = []; },
    data => { data.scores.zils = data.total + 1; },
    data => { data.actions.jev = data.pairs + 1; },
  ]) {
    const data = structuredClone(recorded); change(data);
    assert.throws(() => load(data));
  }
});
