const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleTeachingAlignment } = require('../.private/test-build/teaching-alignment-server.js');

const task = { kind: 'sort', goal: 'Route requests', rules: 'Use the requested action.', answers: ['Billing', 'Support'] };
const input = { action: 'evaluate', task, examples: [{ id: 'one', input: 'Please resend my invoice.' }] };
const request = (body = input, origin = 'http://localhost:3118') => new Request('http://localhost:3118/api/teaching/align', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function environment(t) {
  const saved = { ...process.env }, fetch = global.fetch;
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  process.env.ZILS_DECISION_API_URL = 'https://model.example/decide';
  process.env.ZILS_DECISION_API_KEY = 'test-key';
  process.env.ZILS_DECISION_MODEL = 'test-model';
  t.after(() => { process.env = saved; global.fetch = fetch; });
}

test('alignment allows development and Vercel previews, blocks production, and validates requests', async t => {
  environment(t);
  process.env.NODE_ENV = 'production';
  assert.equal((await handleTeachingAlignment(request())).status, 404);
  process.env.VERCEL_ENV = 'production';
  assert.equal((await handleTeachingAlignment(request())).status, 404);
  process.env.VERCEL_ENV = 'preview';
  assert.equal((await handleTeachingAlignment(new Request('https://preview.example/api/teaching/align'))).status, 200);
  assert.equal((await handleTeachingAlignment(request(input, 'https://elsewhere.example'))).status, 403);
  delete process.env.VERCEL_ENV;
  process.env.NODE_ENV = 'development';
  assert.equal((await handleTeachingAlignment(request(input, 'https://elsewhere.example'))).status, 403);
  assert.equal((await handleTeachingAlignment(request({ ...input, examples: [{ ...input.examples[0], output: 'Billing' }] }))).status, 400);
  assert.equal((await handleTeachingAlignment(request({ ...input, task: { ...task, answers: ['Billing', 'Billing'] } }))).status, 400);
  assert.equal((await handleTeachingAlignment(request({ ...input, examples: [{ id: 'x', input: 'x'.repeat(200000) }] }))).status, 413);
});

test('real evaluation transport returns validated predictions and fails closed on malformed probabilities', async t => {
  environment(t);
  let invalid = false;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.state, 'Please resend my invoice.');
    assert.deepEqual(Object.keys(body.questions.decision.criteria), ['Billing', 'Support']);
    return Response.json({ model: 'test-model', answers: { decision: { type: 'choice', choice: 'Billing', confidence: .8, probabilities: { Billing: .8, Support: invalid ? .8 : .2 } } }, usage: { input_tokens: 10, output_tokens: 1 } });
  };
  const response = await handleTeachingAlignment(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).predictions, [{ id: 'one', choice: 'Billing', probabilities: { Billing: .8, Support: .2 } }]);
  invalid = true;
  assert.equal((await handleTeachingAlignment(request())).status, 502);
});

test('rule proposal accepts only reviewed learning examples and validates the returned rules', async t => {
  environment(t);
  process.env.ZILS_SETUP_API_URL = 'https://assistant.example/chat';
  process.env.ZILS_SETUP_API_KEY = 'test-key';
  process.env.ZILS_SETUP_MODEL = 'reflection';
  const proposal = { action: 'propose', task, examples: [{ ...input.examples[0], output: 'Billing', rationale: 'Invoice copies go to billing.', reviewed: true, split: 'train' }] };
  assert.equal((await handleTeachingAlignment(request({ ...proposal, examples: [{ ...proposal.examples[0], split: 'test' }] }))).status, 400);
  assert.equal((await handleTeachingAlignment(request({ ...proposal, examples: [{ ...proposal.examples[0], reviewed: false }] }))).status, 400);
  let content = { rules: 'Send invoice copies to Billing.', explanation: 'Clarifies invoice requests.' };
  global.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  assert.deepEqual(await (await handleTeachingAlignment(request(proposal))).json(), content);
  content = { rules: '', explanation: 'Broken' };
  assert.equal((await handleTeachingAlignment(request(proposal))).status, 502);
});
