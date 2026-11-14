const test = require('node:test');
const assert = require('node:assert/strict');
const { relayReportApi, RelayReportError, parseRelayReport, agreement, shadowRows } = require('../.private/test-build/relay-report.js');

const shadow = {
  field: 'intent', model: 'zils-task-1', since: '2026-11-14T15:57:00+00:00', asked: 24, agreed: 22, failed: 1,
  by_confidence: [
    { confidence_at_least: 0.5, asked: 24, agreed: 22 }, { confidence_at_least: 0.8, asked: 23, agreed: 21 },
    { confidence_at_least: 0.9, asked: 22, agreed: 20 }, { confidence_at_least: 0.95, asked: 18, agreed: 17 },
    { confidence_at_least: 0.98, asked: 14, agreed: 14 }, { confidence_at_least: 0.99, asked: 11, agreed: 11 },
  ],
};
const question = {
  id: 'e'.repeat(64), instructions: 'Pick the intent.', fields: { intent: ['card_arrival', 'other'], urgent: [true, false] },
  first_at: '2026-11-14T15:55:00+00:00', rows: 25, last_at: '2026-11-14T16:03:00+00:00', shadows: [shadow],
};
const report = { relay: true, saving_since: '2026-11-14T15:38:32+00:00', questions_total: 1, questions: [question] };
const none = { relay: false, saving_since: null, questions_total: 0, questions: [] };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('parses a report, an account without a relay, and a question nothing was saved for', () => {
  assert.deepEqual(parseRelayReport(report), report);
  assert.deepEqual(parseRelayReport(none), none);
  const quiet = { ...report, questions: [{ ...question, rows: 0, last_at: null, shadows: [] }] };
  assert.equal(parseRelayReport(quiet).questions[0].last_at, null);
  assert.equal(parseRelayReport({ ...report, questions: [{ ...question, rows: -1 }] }), null);
  assert.equal(parseRelayReport({ relay: true }), null);
  assert.equal(parseRelayReport(null), null);
});

test('agreement is a whole percentage, and a dash when nothing was asked', () => {
  assert.equal(agreement(22, 24), '92%');
  assert.equal(agreement(11, 11), '100%');
  assert.equal(agreement(0, 5), '0%');
  assert.equal(agreement(0, 0), '–');
});

test('a shadow model reads as one row for all answers and one per confidence level', () => {
  const rows = shadowRows(shadow);
  assert.deepEqual(rows[0], { label: 'Any', asked: 24, share: '100%', agreed: 22, agreement: '92%' });
  assert.deepEqual(rows.at(-1), { label: '99% or more', asked: 11, share: '46%', agreed: 11, agreement: '100%' });
  assert.deepEqual(rows.map(row => row.label), ['Any', '50% or more', '80% or more', '90% or more', '95% or more', '98% or more', '99% or more']);
  const idle = shadowRows({ ...shadow, asked: 0, agreed: 0, by_confidence: shadow.by_confidence.map(level => ({ ...level, asked: 0, agreed: 0 })) });
  assert.deepEqual(idle[0], { label: 'Any', asked: 0, share: '–', agreed: 0, agreement: '–' });
});

test('the report is read with the session token and failures are told apart', async () => {
  const calls = [];
  const api = relayReportApi('https://api.example/decision/', async () => 'tok', async (url, o) => {
    calls.push([url, o.method, o.headers.Authorization]);
    return reply(report);
  });
  assert.deepEqual(await api.get(), report);
  assert.deepEqual(calls, [['https://api.example/decision/v1/relay/report', 'GET', 'Bearer tok']]);
  const failing = status => relayReportApi('https://api.example/decision', async () => 'tok', async () => reply({ error: { code: 'x' } }, status));
  await assert.rejects(failing(401).get(), e => e instanceof RelayReportError && e.status === 401);
  // A gateway from before this route answers 404: the report is not available there yet.
  await assert.rejects(failing(404).get(), e => e.status === 404 && /not available/.test(e.message));
  await assert.rejects(failing(500).get(), e => e.status === 500);
  const bad = relayReportApi('https://api.example/decision', async () => 'tok', async () => reply({ nope: 1 }));
  await assert.rejects(bad.get(), e => e.status === 502);
  const signedOut = relayReportApi('https://api.example/decision', async () => '', async () => reply(report));
  await assert.rejects(signedOut.get(), e => e.status === 401);
});
