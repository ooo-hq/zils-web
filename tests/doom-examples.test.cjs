const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const recorded = require('../data/doom-examples.json');
const compiled = ts.transpileModule(readFileSync(require.resolve('../lib/doom-examples.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
function load(data = recorded) {
  const mod = { exports: {} };
  vm.runInNewContext(compiled, { module: mod, exports: mod.exports, require: name => name === '../data/doom-examples.json' ? data : require(name) });
  return mod.exports;
}

test('the Doom highlight is a Zils success and JEV death, with every shipped file present', () => {
  const { doomExamples, successes, gameSeconds } = load();
  assert.equal(successes(doomExamples.outcomes.zils), 97);
  assert.equal(successes(doomExamples.outcomes.jev), 0);
  assert.equal(gameSeconds(doomExamples.clips.jev.gameTics).toFixed(2), '2.17');
  for (const file of [doomExamples.clips.zils.src, doomExamples.clips.jev.src, doomExamples.poster, ...Object.values(doomExamples.evidence)]) assert.ok(statSync(`public${file}`).size > 0, file);
});

test('page counts match the published results file', () => {
  const { doomExamples } = load();
  const results = JSON.parse(readFileSync('public/examples/doom/results.json', 'utf8'));
  assert.deepEqual(results.models.candidate.outcomes, doomExamples.outcomes.zils);
  assert.deepEqual(results.models.jev.outcomes, doomExamples.outcomes.jev);
  assert.equal(results.selected_seed, doomExamples.seed);
  assert.equal(results.eligible_highlights.length, doomExamples.audit.eligibleHighlights);
  assert.equal(results.audit.replays_verified, doomExamples.audit.replaysVerified);
});

test('inconsistent Doom records fail validation', () => {
  for (const change of [
    data => { data.outcomes.zils.success = 98; },
    data => { data.clips.jev.outcome = 'success'; },
    data => { data.initialFrameSha256 = 'short'; },
  ]) { const data = structuredClone(recorded); change(data); assert.throws(() => load(data)); }
});
