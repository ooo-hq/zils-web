const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseSubmissionsSchema, baseSubmissions } = require('../.private/test-build/network-miners.js');
const valid = () => ({network: 'test', netuid: 579, block: 123, as_of: new Date().toISOString(), submissions: [{uid: 7, hotkey: 'hotkey', commitment_block: 100, sha256: 'a'.repeat(64), revision: 'b'.repeat(40), repo: 'owner/candidate', model: 'd3-lite-0.8b-v1'}]});
test('base feed rejects branch references, unsafe repositories and wrong networks', () => {
  assert.equal(baseSubmissionsSchema.safeParse(valid()).success, true);
  for (const change of [{revision: 'main'}, {repo: 'https://example.com'}, {repo: 'owner/../secret'}]) {
    const value = valid(); Object.assign(value.submissions[0], change);
    assert.equal(baseSubmissionsSchema.safeParse(value).success, false);
  }
  assert.equal(baseSubmissionsSchema.safeParse({...valid(), network: 'finney'}).success, false);
});
test('stale snapshots and outages never render as a current submission feed', async () => {
  const fetch = global.fetch, env = process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL;
  process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = 'https://training.example.com';
  try {
    let value = valid();
    global.fetch = async () => ({ok: true, json: async () => value});
    assert.equal((await baseSubmissions()).submissions[0].uid, 7);
    value = {...value, as_of: '2020-01-01T00:00:00Z'};
    assert.equal(await baseSubmissions(), null);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await baseSubmissions(), null);
  } finally {
    global.fetch = fetch;
    if (env === undefined) delete process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL; else process.env.NEXT_PUBLIC_ZILS_TRAINING_API_URL = env;
  }
});
