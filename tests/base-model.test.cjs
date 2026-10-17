const test = require('node:test');
const assert = require('node:assert/strict');
const { currentBase } = require('../.private/test-build/base-model.js');

const live = { model: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B', max_input_tokens: 4096, inputs: { images: 4, video: true }, extra: 'ignored' },
  channels: { stable: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' }, latest: { id: 'd3-mini-4.5b-v1', name: 'd3-mini 4.5B' } } };

test('the current base is read from the training API config', async () => {
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.invalid/';
  const calls = [];
  global.fetch = async url => { calls.push(String(url)); return new Response(JSON.stringify(live)); };
  const base = await currentBase();
  assert.deepEqual(calls, ['https://training.example.invalid/v1/config']);
  assert.equal(base.channels.stable.name, 'd3-mini 4.5B');
  assert.equal(base.model.max_input_tokens, 4096);
});

test('an unreachable, failing or malformed config gives no base instead of a guess', async () => {
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.invalid';
  global.fetch = async () => { throw new TypeError('offline'); };
  assert.equal(await currentBase(), null);
  global.fetch = async () => new Response('{}', { status: 503 });
  assert.equal(await currentBase(), null);
  global.fetch = async () => new Response(JSON.stringify({ channels: { stable: { id: 1 } } }));
  assert.equal(await currentBase(), null);
});
