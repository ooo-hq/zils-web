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
  first_at: '2026-11-14T15:55:00+00:00', rows: 25, last_at: '2026-11-14T16:03:00+00:00', shadows: [shadow], trainings: [],
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

const { parseRelayStatus, relayAddress } = require('../.private/test-build/relay-report.js');
const status = { relay_id: 'r'.repeat(40), collecting_since: null, terms_version: 't-1' };

test('the relay address is the id under the training service, ready to paste as a base URL', () => {
  assert.equal(relayAddress('https://training.example/', 'r'.repeat(40)), `https://training.example/relay/${'r'.repeat(40)}/v1`);
  // A Jev client is given the API root and adds /v1 itself.
  assert.equal(relayAddress('https://training.example/', 'r'.repeat(40), 'jev'), `https://training.example/relay/${'r'.repeat(40)}`);
});

test('parses a relay status, with and without a relay', () => {
  assert.equal(parseRelayStatus(status).relay_id, status.relay_id);
  assert.equal(parseRelayStatus({ ...status, relay_id: null }).relay_id, null);
  assert.equal(parseRelayStatus({ ...status, terms_version: '' }), null);
  assert.equal(parseRelayStatus({ relay_id: 'x' }), null);
});

test('the status is read and collection switched with the session token', async () => {
  const calls = [];
  const on = { ...status, collecting_since: '2026-11-14T20:00:00+00:00' };
  const api = relayReportApi('https://api.example/decision', async () => 'tok', async (url, o) => {
    calls.push([url, o.method, o.headers.Authorization, o.body]);
    return reply(o.method === 'GET' ? status : on);
  });
  assert.equal((await api.status()).collecting_since, null);
  assert.equal((await api.collect(true, 't-1')).collecting_since, on.collecting_since);
  await api.collect(false);
  assert.deepEqual(calls, [
    ['https://api.example/decision/v1/relay', 'GET', 'Bearer tok', undefined],
    ['https://api.example/decision/v1/relay/collection', 'POST', 'Bearer tok', '{"collect":true,"terms_version":"t-1"}'],
    ['https://api.example/decision/v1/relay/collection', 'POST', 'Bearer tok', '{"collect":false}'],
  ]);
  const failing = (httpStatus, code) => relayReportApi('https://api.example/decision', async () => 'tok', async () => reply({ error: { code } }, httpStatus));
  // The terms changed between showing them and agreeing: say so, do not record anything.
  await assert.rejects(failing(409, 'terms_changed').collect(true, 't-0'), e => e.status === 409 && /terms changed/.test(e.message));
  await assert.rejects(failing(404, 'no_relay').collect(true, 't-1'), e => e.status === 404 && /not set up/.test(e.message));
  await assert.rejects(failing(500, 'internal').collect(false), e => e.status === 500 && /could not be changed/.test(e.message));
  await assert.rejects(failing(401, 'x').status(), e => e.status === 401);
});

test('a status from before request counts reads as no requests yet', () => {
  // A service from before providers sends none: that is an OpenAI gateway.
  assert.deepEqual(parseRelayStatus(status), { ...status, requests: 0, last_request_at: null, provider: 'openai', outcomes: {}, outcomes_since: null });
  assert.equal(parseRelayStatus({ ...status, provider: 'jev' }).provider, 'jev');
  assert.equal(parseRelayStatus({ ...status, provider: 'other' }), null);
  const busy = { ...status, requests: 3026, last_request_at: '2026-11-14T20:00:00+00:00' };
  assert.deepEqual(parseRelayStatus(busy), { ...busy, provider: 'openai', outcomes: {}, outcomes_since: null });
  assert.equal(parseRelayStatus({ ...status, requests: -1 }), null);
});

const { outcomeRows } = require('../.private/test-build/relay-report.js');

test('a status carries what became of the requests, and one from before that carries none', () => {
  const status = { relay_id: 'r'.repeat(40), collecting_since: '2026-11-14T20:00:00+00:00', terms_version: 't-1' };
  const old = parseRelayStatus(status);
  assert.deepEqual([old.outcomes, old.outcomes_since], [{}, null]);
  const counted = parseRelayStatus({ ...status, outcomes: { saved: 3, no_list: 2 }, outcomes_since: '2026-11-14T21:00:00+00:00' });
  assert.deepEqual([counted.outcomes, counted.outcomes_since], [{ saved: 3, no_list: 2 }, '2026-11-14T21:00:00+00:00']);
  assert.equal(parseRelayStatus({ ...status, outcomes: { saved: -1 } }), null);
});

test('outcomes read as rows: saved first, then why the others were not, most frequent first', () => {
  const rows = outcomeRows({ stream: 5, saved: 60, no_list: 30, no_answer: 1, chat_function: 4 });
  assert.deepEqual(rows.map(row => [row.id, row.count, row.share]), [
    ['saved', 60, '60%'], ['no_list', 30, '30%'], ['stream', 5, '5%'], ['chat_function', 4, '4%'], ['no_answer', 1, '1%'],
  ]);
  // Every outcome the service can send has its own plain label and, unless it was saved, what to do about it.
  for (const id of ['saved', 'no_answer', 'stream', 'no_list', 'open_field', 'optional_field', 'tools', 'chat_function', 'conversation', 'media', 'unreadable', 'other']) {
    const row = outcomeRows({ [id]: 1 }).find(found => found.id === id);
    assert.ok(row.label && !row.label.includes('_'), id);
    assert.equal(Boolean(row.hint), id !== 'saved', id);
  }
  assert.equal(new Set(['saved', 'no_answer', 'stream', 'no_list', 'open_field', 'optional_field', 'tools', 'chat_function', 'conversation', 'media', 'unreadable', 'other'].map(id => outcomeRows({ [id]: 1 }).find(found => found.id === id).label)).size, 12);
  // Saved is shown even at zero, so "nothing was saved" is said outright; a reason the page does not know joins Other.
  assert.deepEqual(outcomeRows({ no_list: 2, brand_new: 1, other: 1 }).map(row => [row.id, row.count]), [['saved', 0], ['no_list', 2], ['other', 2]]);
  assert.deepEqual(outcomeRows({}), []);
});

const { parseRelayRows, gatewayTable, TRAIN_FROM_ROWS } = require('../.private/test-build/relay-report.js');

test('saved rows for a question become a table: the message, then one column per answer field', async () => {
  const id = 'a'.repeat(64);
  const body = { question: { id, instructions: 'Pick the intent.', fields: { intent: ['refund', 'other'], urgent: [true, false] } },
    rows: [{ text: 'Where is my money?', answers: { intent: 'refund', urgent: true } }, { text: 'Hello', answers: { intent: 'other', urgent: false } }], truncated: false };
  const table = gatewayTable(parseRelayRows(body));
  assert.deepEqual(table.data, { headers: ['text', 'intent', 'urgent'], rows: [['Where is my money?', 'refund', 'true'], ['Hello', 'other', 'false']] });
  // The model reads the message, as the gateway's comparison sends it, and decides the first field; one decision per run.
  assert.deepEqual(table.columns, { decide: 'intent', group: '', reads: ['text'], unused: ['urgent'] });
  assert.equal(table.question, 'Pick the intent.');
  // Instructions longer than a training question holds are left for the customer to write.
  assert.equal(gatewayTable(parseRelayRows({ ...body, question: { ...body.question, instructions: 'x'.repeat(1001) } })).question, '');
  assert.equal(parseRelayRows({ rows: [] }), null);
  assert.equal(TRAIN_FROM_ROWS, 200);
  const calls = [];
  const api = relayReportApi('https://api.example/decision', async () => 'tok', async (url, init) => { calls.push([url, init.method]); return new Response(JSON.stringify(body), { status: 200 }); });
  assert.deepEqual((await api.rows(id)).question.id, id);
  assert.deepEqual(calls, [[`https://api.example/decision/v1/relay/questions/${id}/rows`, 'GET']]);
  await assert.rejects(api.rows('../x'), e => e.status === 404);
});

test('a question carries the runs trained from it, and a report from before runs carries none', async () => {
  const run = { job_id: '50000000-0000-4000-8000-000000000001', field: 'intent', name: 'gateway-intent', started_at: '2026-11-15T17:00:00+00:00', state: 'ready', model: 'zils-task-x' };
  const question = { id: 'a'.repeat(64), instructions: 'Pick.', fields: { intent: ['a', 'b'] }, first_at: '2026-11-14T00:00:00+00:00', rows: 3, last_at: null, shadows: [] };
  const old = parseRelayReport({ relay: true, saving_since: null, questions_total: 1, questions: [question] });
  assert.deepEqual(old.questions[0].trainings, []);
  const withRuns = parseRelayReport({ relay: true, saving_since: null, questions_total: 1, questions: [{ ...question, trainings: [run, { ...run, state: 'training', model: null }] }] });
  assert.deepEqual(withRuns.questions[0].trainings.map(found => [found.state, found.model]), [['ready', 'zils-task-x'], ['training', null]]);
  assert.equal(parseRelayReport({ relay: true, saving_since: null, questions_total: 1, questions: [{ ...question, trainings: [{ ...run, state: 'odd' }] }] }), null);

  const calls = [];
  const api = relayReportApi('https://api.example/decision', async () => 'tok', async (url, init) => { calls.push([url, init.method, init.body]); return new Response('{"status":"ok"}', { status: 200 }); });
  const note = { field: 'intent', job_id: run.job_id, decision: 'Which intent?', outcomes: ['a', 'b'] };
  await api.note('a'.repeat(64), note);
  await api.compare(run.job_id);
  assert.deepEqual(calls, [
    [`https://api.example/decision/v1/relay/questions/${'a'.repeat(64)}/trainings`, 'POST', JSON.stringify(note)],
    [`https://api.example/decision/v1/relay/trainings/${run.job_id}/compare`, 'POST', '{}'],
  ]);
  const notReady = relayReportApi('https://api.example/decision', async () => 'tok', async () => new Response('{"error":{"code":"not_ready"}}', { status: 409 }));
  await assert.rejects(notReady.compare(run.job_id), e => e.status === 409 && /not ready/.test(e.message));
});
