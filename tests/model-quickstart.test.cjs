const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { modelQuickstart } = require('../.private/test-build/model-quickstart.js');

for (const language of ['Python', 'JavaScript']) test(`${language} example makes one authenticated request with the selected model and no labels`, async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, method: req.method, authorization: req.headers.authorization, body: JSON.parse(body) });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ model: JSON.parse(body).model, predictions: { decision: { yes: .9, no: .1 } } }));
  });
  const directory = await mkdtemp(join(tmpdir(), 'zils-quickstart-test-'));
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const model = 'zils-adapter-fixture-"quote"-\\slash';
    const example = modelQuickstart(model, `http://127.0.0.1:${server.address().port}/decision/`, language);
    const row = { state: { input: "A customer's request", score: null, active: true }, question: { type: 'choice', instructions: 'Approve?', criteria: { yes: 'Approve', no: 'Decline' } }, label: 'yes', id: 'private-id', group_id: 'private-group' };
    await writeFile(join(directory, 'train.jsonl'), `\n${JSON.stringify(row)}\n${JSON.stringify({ ...row, state: 'Do not send this second row' })}\n`);
    await writeFile(join(directory, example.filename), example.code);
    const output = await new Promise((resolve, reject) => {
      const child = spawn(language === 'Python' ? 'python3' : process.execPath, [example.filename], { cwd: directory, env: { PATH: process.env.PATH, ZILS_API_KEY: 'fixture-key' } });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => stdout += data);
      child.stderr.on('data', data => stderr += data);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    });
    assert.equal(JSON.parse(output).model, model);
    assert.deepEqual(requests, [{ path: '/decision/v1/systemone', method: 'POST', authorization: 'Bearer fixture-key', body: { model, state: row.state, questions: { decision: row.question } } }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
