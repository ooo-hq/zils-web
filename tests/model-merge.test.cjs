const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FAMILIES, MAX_MODELS, mergeCommand, downloadGB } = require('../.private/test-build/model-merge.js');

const lite = FAMILIES.find(f => f.id === 'lite');
const mini = FAMILIES.find(f => f.id === 'mini');

test('an even soup is a plain npx command with no optional flags', () => {
  assert.equal(
    mergeCommand({ family: 'lite', models: ['vllm-sr/d3-lite', 'internlm/Intern-Decision-0.8B', 'eljiwo/jiwo-0.8b'], method: 'linear', portions: [1, 1, 1] }),
    'npx @zils/cli merge vllm-sr/d3-lite internlm/Intern-Decision-0.8B eljiwo/jiwo-0.8b --out ./my-merge',
  );
});

test('uneven portions become --weights and SLERP becomes --method', () => {
  assert.equal(
    mergeCommand({ family: 'mini', models: ['vllm-sr/d3-mini', 'torchcast-ai/torchcast-decision-4b'], method: 'slerp', portions: [2, 1] }),
    'npx @zils/cli merge vllm-sr/d3-mini torchcast-ai/torchcast-decision-4b --out ./my-merge --method slerp --weights 2,1',
  );
});

test('bowls the CLI would refuse are refused here too', () => {
  const ok = { family: 'lite', models: ['vllm-sr/d3-lite', 'eljiwo/jiwo-0.8b'], method: 'linear', portions: [1, 1] };
  const six = lite.models.slice(0, 6).map(m => m.id);
  for (const [change, message] of [
    [{ models: ['vllm-sr/d3-lite'], portions: [1] }, /2 to 5/],
    [{ models: six, portions: six.map(() => 1) }, /2 to 5/],
    [{ models: ['vllm-sr/d3-lite', 'torchcast-ai/torchcast-decision-4b'] }, /same family/],
    [{ models: ['vllm-sr/d3-lite', 'evil/x; rm -rf ~'] }, /same family/],
    [{ models: ['vllm-sr/d3-lite', 'vllm-sr/d3-lite'] }, /different models/],
    [{ method: 'ties' }, /method/],
    [{ models: [...ok.models, 'internlm/Intern-Decision-0.8B'], portions: [1, 1, 1], method: 'slerp' }, /SLERP/],
    [{ portions: [1] }, /portion/],
    [{ portions: [0, 1] }, /portion/],
    [{ portions: [1, 4] }, /portion/],
  ]) assert.throws(() => mergeCommand({ ...ok, ...change }), message, JSON.stringify(change));
  assert.equal(MAX_MODELS, 5);
});

test('every stall is a unique, permissively licensed repo with a specialty, a maker, a size and a role', () => {
  const seen = new Set();
  for (const family of FAMILIES) {
    assert.ok(family.models.length >= 8, family.id);
    assert.equal(family.models.filter(m => m.role === 'base').length, 1, family.id);
    assert.ok(family.models.filter(m => m.role === 'house').length >= 2, family.id);
    for (const model of family.models) {
      assert.match(model.id, /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/);
      assert.ok(!seen.has(model.id), model.id);
      seen.add(model.id);
      assert.ok(['apache-2.0', 'mit'].includes(model.licence), model.id);
      assert.ok(['house', 'base', 'market'].includes(model.role), model.id);
      assert.ok(model.label && model.maker && model.specialty && model.note, model.id);
      assert.ok(model.sizeGB > 0.5 && model.sizeGB < 12, model.id);
    }
  }
  // The soup page's house models, as the validator starts from them.
  assert.deepEqual(lite.models.filter(m => m.role === 'house').map(m => m.id), ['vllm-sr/d3-lite', 'internlm/Intern-Decision-0.8B']);
  assert.deepEqual(mini.models.filter(m => m.role === 'house').map(m => m.id), [
    'vllm-sr/d3-mini', 'perplexity-ai/pplx-decider-flash-v1.2', 'torchcast-ai/torchcast-decision-4b',
    'Maincode/Matilda-Decision-v1-Mini', 'PelaAI/KnowLine-4B-Gen5',
  ]);
  for (const broken of ['chaoliangUNSW/Jev-Style-0.8B-Decision-v3', 'FluidInference/clef-vision-0.8b', 'inclusionAI/LemonDecider']) assert.ok(!seen.has(broken));
});

test('every command the page can build uses only shell-safe characters', () => {
  for (const family of FAMILIES) {
    const ids = family.models.map(m => m.id);
    for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const models = [ids[i], ids[j], ...ids.filter((_, k) => k !== i && k !== j).slice(0, 3)];
      const command = mergeCommand({ family: family.id, models, method: 'linear', portions: models.map((_, k) => 1 + (k % 3)) });
      assert.match(command, /^[A-Za-z0-9 @/.,_-]+$/, command);
    }
  }
});

test('the download estimate adds up the models in the bowl', () => {
  assert.equal(downloadGB('lite', ['vllm-sr/d3-lite', 'eljiwo/jiwo-0.8b']), 3.2);
});
