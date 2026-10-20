const test = require('node:test');
const assert = require('node:assert/strict');
const { networkMiners } = require('../.private/test-build/network-miners.js');

const stats = { assigned: 2, submitted: 2, evaluated: 2, selected: 1, median_skill: 0.25 };
const miner = { uid: 1, hotkey: '5Fast', status: 'online', last_seen: null, models: ['d3-mini-4.5b-v1'], training: stats };
const body = { as_of: '2026-10-18T00:00:00Z', summary: { miners: 1, online: 1, stale: 0, offline: 0, unseen: 0, disabled: 0 }, miners: [miner] };
process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.invalid';
const serve = value => { global.fetch = async () => new Response(JSON.stringify(value)); };

test('the leaderboard reads responses from before tracks existed', async () => {
  serve(body);
  const data = await networkMiners();
  assert.equal(data.miners[0].training.tracks, undefined);
  assert.equal(data.tracks, undefined);
});

test('per-track numbers and the track summary are read when present', async () => {
  serve({ ...body, tracks: { text: { completed_jobs: 2, miners: 1 }, image: { completed_jobs: 1, miners: 1 } },
    miners: [{ ...miner, training: { ...stats, tracks: { text: stats, image: { ...stats, assigned: 1, median_skill: null } } } }] });
  const data = await networkMiners();
  assert.equal(data.tracks.image.completed_jobs, 1);
  assert.equal(data.miners[0].training.tracks.image.assigned, 1);
  assert.equal(data.miners[0].training.tracks.image.median_skill, null);
});

test('each read fetches current models without caching and fails closed during an outage', async () => {
  const calls = [];
  let current = body;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return current ? new Response(JSON.stringify(current)) : new Response('{}', { status: 503 });
  };
  assert.deepEqual((await networkMiners()).miners[0].models, ['d3-mini-4.5b-v1']);
  current = { ...body, miners: [{ ...miner, models: ['d3-lite-0.8b-v1'] }] };
  assert.deepEqual((await networkMiners()).miners[0].models, ['d3-lite-0.8b-v1']);
  current = null;
  assert.equal(await networkMiners(), null);
  assert.equal(calls.length, 3);
  for (const { url, init } of calls) {
    assert.equal(url, 'https://training.example.invalid/v1/network/miners');
    assert.equal(init.cache, 'no-store');
  }
});
