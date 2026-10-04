const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { parseCsv, prepareTraining } = require('../.private/test-build/training-csv.js');
const { validateDatasets, trainingApi } = require('../.private/test-build/training.js');
const sample = readFileSync('public/training/support-routing-example.csv', 'utf8');
const decision = { name: 'support-routing-v1', question: 'Which team should handle this support ticket?', outcomes: ['Billing', 'Technical support', 'Account changes'] };
const mapping = { inputs: ['customer_message'], answer: 'correct_decision', group: 'case_group' };
const prepare = (csv = parseCsv(sample), map = mapping, config = decision, independent = false) => prepareTraining(csv, map, config, independent);

async function rows(result) {
  return Object.fromEntries(await Promise.all(Object.entries(result.files).map(async ([split, file]) => [split, (await file.text()).trim().split('\n').map(JSON.parse)])));
}

test('CSV handles BOM, quoted commas, quotes, newlines, CRLF and trailing blanks', () => {
  assert.deepEqual(parseCsv('\ufeffcontext,answer\r\n"A, B\nwith ""quotes""",Yes\r\n\r\n'), { headers: ['context', 'answer'], rows: [['A, B\nwith "quotes"', 'Yes']] });
});
test('CSV rejects malformed quotes, duplicate/empty headers, jagged rows and empty files', () => {
  for (const text of ['a,a\nx,y', ',b\nx,y', 'a,b\nx', 'a,b\n"x,y', 'a,b\nx"q,y', 'a,b\n"x"q,y', '', 'a,b\n']) assert.throws(() => parseCsv(text));
});
test('CSV enforces input size, column and row limits', () => {
  assert.throws(() => parseCsv('x'.repeat(10 * 1024 * 1024 + 1)), /10 MiB/);
  assert.throws(() => parseCsv(Array.from({length:65},(_,i)=>`col${i}`).join(',')), /64 columns/);
  assert.throws(() => parseCsv('a,b\n' + 'x,y\n'.repeat(20001)), /20,000/);
});
test('sample prepares valid backend datasets with all answers in every split', async () => {
  const result = await prepare();
  assert.equal(result.total, 18);
  assert.equal(result.groups, 18);
  assert.deepEqual(await validateDatasets(result.files), result.counts);
  assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),18);
  for (const count of result.distribution) for (const split of ['train','calibration','test']) assert.ok(count[split] >= 1);
  const splits = await rows(result);
  for (const examples of Object.values(splits)) for (const example of examples) {
    assert.equal(example.state.decision, decision.question);
    assert.deepEqual(Object.keys(example.state.information), ['customer_message']);
    assert.equal(example.state.information.correct_decision, undefined);
    assert.equal(example.state.information.case_group, undefined);
    assert.ok(decision.outcomes.includes(example.label));
  }
});
test('file generation is stable, even when CSV row order changes', async () => {
  const csv = parseCsv(sample);
  const a = await prepare(csv);
  const b = await prepare({...csv, rows:[...csv.rows].reverse()});
  for (const split of ['train','calibration','test']) assert.equal(await a.files[split].text(), await b.files[split].text());
});
test('all records from a source group stay in one split', async () => {
  const csv = parseCsv(sample);
  csv.rows.push(...csv.rows.map(row => [row[0], row[1]+' More detail.', row[2]]));
  const result = await prepare(csv);
  assert.equal(result.total,36); assert.equal(result.groups,18);
  const assigned = new Map();
  for (const [split, examples] of Object.entries(await rows(result))) for (const row of examples) {
    assert.ok(!assigned.has(row.group_id) || assigned.get(row.group_id) === split);
    assigned.set(row.group_id,split);
  }
  await validateDatasets(result.files);
});
test('independent rows require explicit confirmation', async () => {
  await assert.rejects(prepare(undefined, {...mapping, group:''}), /confirm/);
  await validateDatasets((await prepare(undefined, {...mapping, group:''}, decision, true)).files);
});
test('answer and grouping columns cannot leak into inputs', async () => {
  await assert.rejects(prepare(undefined,{...mapping,inputs:['correct_decision']}), /separate/);
  await assert.rejects(prepare(undefined,{...mapping,inputs:['case_group']}), /separate/);
  await assert.rejects(prepare(undefined,{...mapping,group:'correct_decision'}), /separate/);
});
test('missing answers, unknown answers, blank inputs and blank groups explain the record to fix', async () => {
  for (const [column, value, match] of [[2,'',/record 2.*missing/],[2,'Wrong',/record 2.*match/],[1,'',/record 2.*empty/],[0,'',/record 2.*missing/]]) {
    const csv=parseCsv(sample); csv.rows[0][column]=value;
    await assert.rejects(prepare(csv),match);
  }
});
test('duplicate inputs and conflicting answers cannot contaminate evaluation', async () => {
  const csv=parseCsv(sample);csv.rows.push([...csv.rows[0]]);
  await assert.rejects(prepare(csv),/identical information/);
  csv.rows.at(-1)[2]='Technical support';
  await assert.rejects(prepare(csv),/conflicting answers/);
});
test('insufficient independent examples for an outcome blocks preparation', async () => {
  const csv=parseCsv(sample);csv.rows=csv.rows.filter((row,index)=>row[2]!=='Billing'||index<4);
  await assert.rejects(prepare(csv),/Billing.*at least 3/);
});
test('oversized examples and invalid decision settings are rejected', async () => {
  const csv=parseCsv(sample);csv.rows[0][1]='a'.repeat(128*1024);
  await assert.rejects(prepare(csv),/record 2.*128 KiB/);
  for (const config of [{...decision,question:''},{...decision,name:'bad name'},{...decision,outcomes:['Yes','Yes']},{...decision,outcomes:Array.from({length:17},(_,i)=>`Outcome ${i}`)}]) await assert.rejects(prepare(undefined,mapping,config));
});
test('Unicode text respects the coordinator’s escaped-JSON size limit', async () => {
  const csv=parseCsv(sample);csv.rows[0][1]='发票'.repeat(15000);
  await assert.rejects(prepare(csv),/128 KiB/);
  csv.rows[0][1]='请发送发票 🧾';
  const result=await prepare(csv); await validateDatasets(result.files);
  assert.equal(result.preview[0].information.customer_message,'请发送发票 🧾');
});
test('mixed-outcome groups preserve coverage and cannot cross splits', async () => {
  const csv=parseCsv(sample);csv.rows.forEach((row,i)=>row[0]=`conversation-${Math.floor(i/3)}`);
  const result=await prepare(csv);await validateDatasets(result.files);
  for (const count of result.distribution) for (const split of ['train','calibration','test']) assert.ok(count[split]);
});
test('prepared data uses the existing authenticated create, upload and submit contract', async () => {
  const result=await prepare(); const calls=[];
  const job={id:'123e4567-e89b-42d3-a456-426614174000',name:decision.name,status:'uploading'};
  const uploads=Object.fromEntries(['train','calibration','test'].map(split=>[split,{url:`https://storage.example/storage/v1/object/${split}`,method:'PUT',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'}}]));
  const api=trainingApi('https://api.example','https://storage.example',async()=> 'test-session',async(url,options)=>{
    calls.push({url,options});
    if(options.method==='PUT') return new Response('',{status:200});
    return Response.json(url.endsWith('/submit')?{job:{...job,status:'validating'}}:{job,uploads});
  });
  const created=await api.create({name:decision.name,acceptance:{min_accuracy:0.8,min_brier_improvement:0.01},allow_training_data_export:true});
  for(const split of ['train','calibration','test']) await api.upload(split,created.uploads[split],result.files[split]);
  assert.equal((await api.submit(job.id)).job.status,'validating');
  assert.equal(calls.length,5);
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-session');
  assert.equal(calls[1].options.body,result.files.train);
  assert.equal(calls[1].options.headers.Authorization,undefined);
});
