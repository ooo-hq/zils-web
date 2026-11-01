const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FAMILIES, mergeCommand, outputName } = require('../.private/test-build/model-merge.js');

const lite = FAMILIES.find(f => f.id === 'lite');
const mini = FAMILIES.find(f => f.id === 'mini');

test('the default lite pair is a plain npx command with no optional flags', () => {
  assert.equal(
    mergeCommand({ family: 'lite', first: 'vllm-sr/d3-lite', second: 'eljiwo/jiwo-0.8b', method: 'linear', weight: 0.5 }),
    'npx @zils/cli merge vllm-sr/d3-lite eljiwo/jiwo-0.8b --out ./d3-lite-x-jiwo-0.8b',
  );
});

test('slerp and a non-default weight become flags; the weight is the second model share rounded to 0.05', () => {
  assert.equal(
    mergeCommand({ family: 'mini', first: 'zils-ai/z3-mini-v1', second: 'torchcast-ai/torchcast-decision-4b', method: 'slerp', weight: 0.3 }),
    'npx @zils/cli merge zils-ai/z3-mini-v1 torchcast-ai/torchcast-decision-4b --out ./z3-mini-v1-x-torchcast-decision-4b --method slerp --weight 0.3',
  );
  assert.match(
    mergeCommand({ family: 'lite', first: 'vllm-sr/d3-lite', second: 'eljiwo/jiwo-0.8b', method: 'linear', weight: 0.2999 }),
    / --weight 0\.3$/,
  );
});

test('pairs outside one family, repeats, unknown models, methods and weights are refused', () => {
  const ok = { family: 'lite', first: 'vllm-sr/d3-lite', second: 'eljiwo/jiwo-0.8b', method: 'linear', weight: 0.5 };
  for (const [change, message] of [
    [{ second: 'torchcast-ai/torchcast-decision-4b' }, /same family/],
    [{ family: 'mini' }, /same family/],
    [{ second: 'vllm-sr/d3-lite' }, /two different models/],
    [{ first: 'evil/model; rm -rf ~' }, /same family/],
    [{ method: 'ties' }, /method/],
    [{ weight: 0 }, /between/],
    [{ weight: 1 }, /between/],
    [{ weight: Number.NaN }, /between/],
  ]) assert.throws(() => mergeCommand({ ...ok, ...change }), message, JSON.stringify(change));
});

test('every listed model is a unique repo id with a permissive licence, and each family offers several', () => {
  const seen = new Set();
  for (const family of FAMILIES) {
    assert.ok(family.models.length >= 5, family.id);
    for (const model of family.models) {
      assert.match(model.id, /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/);
      assert.ok(!seen.has(model.id), model.id);
      seen.add(model.id);
      assert.ok(['apache-2.0', 'mit'].includes(model.licence), `${model.id} ${model.licence}`);
      assert.ok(model.label && model.note, model.id);
    }
  }
  // Bodies known to break on the d3 chassis are not offered.
  assert.ok(!seen.has('chaoliangUNSW/Jev-Style-0.8B-Decision-v3'));
  assert.ok(!seen.has('FluidInference/clef-vision-0.8b'));
  assert.equal(lite.models[0].id, 'vllm-sr/d3-lite');
  assert.equal(mini.models[0].id, 'zils-ai/z3-mini-v1');
});

test('every command the page can build uses only shell-safe characters', () => {
  for (const family of FAMILIES) for (const a of family.models) for (const b of family.models) {
    if (a.id === b.id) continue;
    for (const method of ['linear', 'slerp']) {
      const command = mergeCommand({ family: family.id, first: a.id, second: b.id, method, weight: 0.35 });
      assert.match(command, /^[A-Za-z0-9 @/._-]+$/, command);
    }
  }
});

test('the output folder is named after both models', () => {
  assert.equal(outputName('vllm-sr/d3-lite', 'OmniJev/OneJev1.6-0.8B'), './d3-lite-x-OneJev1.6-0.8B');
});
