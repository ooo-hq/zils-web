const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zipSync, strToU8 } = require('fflate');
const { readSpreadsheet, normalizeSheet, checkWorkbookArchive, checkWorkbookRanges } = require('../.private/test-build/training-spreadsheet.js');
const { suggestMapping, suggestAnswers, reviewData } = require('../.private/test-build/training-review.js');
const { prepareTraining, parseCsv } = require('../.private/test-build/training-csv.js');
const { validateDatasets } = require('../.private/test-build/training.js');
const { readFileSync } = require('node:fs');

const csv = () => parseCsv(readFileSync('public/training/support-routing-example.csv', 'utf8'));
const mapping = { inputs: ['customer_message'], answer: 'correct_decision', group: 'case_group' };
const outcomes = ['Billing', 'Technical support', 'Account changes'];
const decision = { name: 'support-routing', question: 'Which team should handle this ticket?', outcomes };

function workbook() {
  const xml = (text) => strToU8(text);
  return zipSync({
    '[Content_Types].xml': xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    'xl/workbook.xml': xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Examples" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/><Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>'),
    'xl/worksheets/sheet1.xml': xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Read me</t></is></c></row></sheetData></worksheet>'),
    'xl/worksheets/sheet2.xml': xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Message</t></is></c><c r="B1" t="inlineStr"><is><t>Answer</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Invoice please</t></is></c><c r="B2" t="inlineStr"><is><t>Billing</t></is></c></row></sheetData></worksheet>'),
  });
}

test('CSV and XLSX imports stay local and preserve sheet choices, even with an instructions tab', async () => {
  const sheets = await readSpreadsheet(new File([workbook()], 'tickets.xlsx'));
  assert.deepEqual(sheets.map(sheet => sheet.name), ['Instructions', 'Examples']);
  assert.ok(sheets[0].error);
  assert.deepEqual(sheets[1].data.rows, [['Invoice please', 'Billing']]);
  const text = 'Message,Answer\r\n"Invoice, please",Billing\r\n';
  const [sheet] = await readSpreadsheet(new File([text], 'tickets.CSV'));
  assert.equal(sheet.data.rows[0][0], 'Invoice, please');
});
test('JSON and JSONL exports use the same reviewed training contract as CSV', async () => {
  const original = csv();
  const records = original.rows.map(row => Object.fromEntries(original.headers.map((header, index) => [header, row[index]])));
  for (const [name, source] of [['tickets.json', JSON.stringify(records)], ['tickets.jsonl', records.map(record => JSON.stringify(record)).join('\n')]]) {
    const [sheet] = await readSpreadsheet(new File([source], name));
    assert.deepEqual(sheet.data.headers, original.headers);
    assert.deepEqual(sheet.data.rows, original.rows);
    assert.deepEqual(suggestMapping(sheet.data), mapping);
    const report = reviewData(sheet.data, mapping, outcomes, {});
    assert.equal(report.issues.length, 0);
    const result = await prepareTraining(report.data, mapping, decision, false);
    assert.deepEqual(await validateDatasets(result.files), result.counts);
  }
});
test('JSON preserves nested payloads, missing fields, booleans, zero and source references', async () => {
  const records = [
    { brief: { title: 'Demo', rules: ['Show product'] }, transcript: [{ start: 0, text: 'Hello' }], answer: true, duration: 0 },
    { brief: { title: 'Second' }, answer: false, reference: '001', missing: null },
  ];
  const [sheet] = await readSpreadsheet(new File([JSON.stringify(records)], 'videos.JSON'));
  assert.deepEqual(sheet.data.headers, ['brief', 'transcript', 'answer', 'duration', 'reference', 'missing']);
  assert.deepEqual(sheet.data.rows, [
    [JSON.stringify(records[0].brief), JSON.stringify(records[0].transcript), 'true', '0', '', ''],
    [JSON.stringify(records[1].brief), '', 'false', '', '001', ''],
  ]);
  assert.deepEqual(sheet.data.sourceRows, [1, 2]);
  const [single] = await readSpreadsheet(new File([JSON.stringify(records[0], null, 2)], 'payload.json'));
  assert.equal(single.data.rows.length, 1);
  const [lines] = await readSpreadsheet(new File(['\uFEFF\n' + records.map(record => JSON.stringify(record)).join('\r\n\r\n')], 'payload.ndjson'));
  assert.deepEqual(lines.data.sourceRows, [2, 4]);
  const [pastedLines] = await readSpreadsheet(new File([records.map(record => JSON.stringify(record)).join('\n')], 'pasted-data.json'));
  assert.deepEqual(pastedLines.data.rows, sheet.data.rows);
});
test('wrapped JSON offers explicit record-list choices without discarding the original payload', async () => {
  const record = { message: 'Invoice please', answer: 'Billing' };
  const payload = { version: 'v1', data: [record], tags: ['support'] };
  const sources = await readSpreadsheet(new File([JSON.stringify(payload)], 'export.json'));
  assert.deepEqual(sources.map(source => source.name), ['Whole JSON object', 'data']);
  assert.deepEqual(sources[0].data.headers, ['version', 'data', 'tags']);
  assert.deepEqual(sources[1].data.rows, [['Invoice please', 'Billing']]);
});
test('invalid JSON inputs fail without dropping records or rounding numeric identifiers', async () => {
  for (const [source, name, match] of [
    ['[]', 'empty.json', /no examples|empty/i],
    ['{}', 'empty.json', /field|empty/i],
    ['42', 'number.json', /object/i],
    ['[{"message":"One"}, null]', 'null.json', /2.*object/i],
    ['[{"message":"One"}, "two"]', 'mixed.json', /2.*object/i],
    ['{"message":"One","answer":"Yes"}\n\n{"message":', 'bad.jsonl', /line 3/i],
    ['[{"message":"One","answer":"Yes"}]', 'array.jsonl', /line 1.*object/i],
    ['{"id":9007199254740993,"answer":"Yes"}', 'id.json', /number.*quotes|quoted/i],
    [JSON.stringify([{ ' ': 'bad', answer: 'Yes' }]), 'field.json', /field/i],
    [JSON.stringify(Array.from({ length: 20001 }, () => ({ message: 'a', answer: 'b' }))), 'many.json', /20,000/],
    [JSON.stringify([Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`field${i}`, i]))]), 'wide.json', /64/],
  ]) await assert.rejects(readSpreadsheet(new File([source], name)), match);
  await assert.rejects(readSpreadsheet(new File([new Uint8Array([255])], 'bad.json')), /UTF-8/);
});
test('imports reject empty, oversized, unsupported, invalid UTF-8 and corrupt Excel files', async () => {
  for (const [file, match] of [
    [new File([], 'empty.csv'), /empty/i],
    [new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'large.csv'), /10 MiB/],
    [new File(['old workbook'], 'old.xls'), /xlsx|CSV/i],
    [new File([new Uint8Array([255])], 'bad.csv'), /UTF-8/],
    [new File(['not a ZIP'], 'bad.xlsx'), /Excel|workbook/i],
  ]) await assert.rejects(readSpreadsheet(file), match);
});
test('Excel normalization pads empty cells, preserves source rows, numbers, booleans, and dates', () => {
  const table = normalizeSheet([['Context', 'Answer', 'Reference'], ['A', true, 123], [], ['B', false], ['C', new Date('2026-01-02T00:00:00Z'), '001']]);
  assert.deepEqual(table.rows, [['A', 'true', '123'], ['B', 'false', ''], ['C', '2026-01-02T00:00:00.000Z', '001']]);
  assert.deepEqual(table.sourceRows, [2, 4, 5]);
  assert.throws(() => normalizeSheet([['A', 'A'], ['x', 'y']]), /unique/i);
  assert.throws(() => normalizeSheet([['A', 'B'], ['x', 'y', 'hidden']]), /header/i);
  assert.throws(() => normalizeSheet([['A', 'B'], ...Array.from({length: 20001}, () => ['x', 'y'])]), /20,000/);
});
test('expanded workbook limits are checked before parsing cell contents', () => {
  const archive = zipSync({ 'xl/worksheets/sheet1.xml': strToU8('a'.repeat(1024)) });
  assert.throws(() => checkWorkbookArchive(archive, 512), /expanded|large/i);
  checkWorkbookArchive(workbook());
});
test('CSV source rows survive skipped blank records and quoted multiline cells', () => {
  const table = parseCsv('\nMessage,Answer\n\n"First line\nSecond line",Yes\nAnother,No\n');
  assert.deepEqual(table.sourceRows, [4, 5]);
  assert.deepEqual(reviewData(table, {inputs:['Message'], answer:'Answer', group:''}, ['Yes','No'], {}).data.sourceRows, [4, 5]);
});
test('sparse workbook ranges are rejected before the reader allocates rows and columns', () => {
  checkWorkbookRanges(workbook());
  for (const reference of ['A1048576', 'XFD2', 'A20002', 'BM2', 'A&#49;048576']) {
    const archive = zipSync({ 'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData><row r="1"><c r="${reference}"/></row></sheetData></worksheet>`) });
    assert.throws(() => checkWorkbookRanges(archive), /rows|columns|reference/);
  }
});
test('mapping suggestions recognize business headers and never select contact fields as inputs', () => {
  const table = { headers: ['Ticket ID', 'Subject', 'Message', 'Correct Answer', 'Customer Email'], rows: [['1','Help','Invoice','Billing','a@example.com']] };
  assert.deepEqual(suggestMapping(table), { inputs: ['Subject','Message'], answer: 'Correct Answer', group: 'Ticket ID' });
  assert.deepEqual(suggestAnswers(table, 'Correct Answer'), ['Billing']);
  assert.equal(suggestMapping({ headers: ['Unknown', 'Outcome'], rows: [['abc','Yes']] }).inputs.length, 0);
  assert.deepEqual(suggestAnswers({ headers:['Answer'], rows:Array.from({length:17},(_,i)=>[String(i)]) }, 'Answer'), []);
});
test('readiness identifies all missing answers, conflicts, and empty input rows with source references', () => {
  const table = csv();
  table.rows[0][2] = '';
  table.rows[1][1] = '';
  table.rows.push([...table.rows[2].slice(0, 2), 'Billing']);
  const report = reviewData(table, mapping, outcomes, {});
  assert.ok(report.issues.some(issue => issue.index === 0 && /answer/i.test(issue.message)));
  assert.ok(report.issues.some(issue => issue.index === 1 && /information/i.test(issue.message)));
  assert.ok(report.issues.some(issue => issue.index === 2 && /identical|conflicting/i.test(issue.message)));
  assert.ok(report.issues.some(issue => issue.index === 18 && /identical|conflicting/i.test(issue.message)));
});
test('corrections and exclusions are applied before splitting without mutating the original spreadsheet', async () => {
  const table = csv();
  table.rows[0][2] = '';
  table.rows.push([...table.rows[1]]);
  const snapshot = structuredClone(table);
  const report = reviewData(table, mapping, outcomes, { 0: { answer:'Billing', confirmed:true }, 18:{ excluded:true } });
  assert.equal(report.issues.length, 0);
  assert.equal(report.excluded, 1);
  assert.equal(report.confirmed, 1);
  assert.equal(report.data.rows[0][2], 'Billing');
  assert.deepEqual(table, snapshot);
  const result = await prepareTraining(report.data, mapping, decision, false);
  assert.deepEqual(await validateDatasets(result.files), result.counts);
});
test('needs-review flags block readiness until explicitly resolved; exclusions cannot make an empty dataset ready', () => {
  const table = csv();
  assert.ok(reviewData(table, mapping, outcomes, { 0:{ needsReview:true } }).issues.some(issue => issue.index === 0));
  assert.equal(reviewData(table, mapping, outcomes, { 0:{ confirmed:true } }).issues.length, 0);
  const excluded = Object.fromEntries(table.rows.map((_, i) => [i, {excluded:true}]));
  assert.ok(reviewData(table, mapping, outcomes, excluded).blockers.length);
});
test('readiness counts independent groups after exclusions and review sampling includes each answer', () => {
  const table = csv();
  const report = reviewData(table, mapping, outcomes, {});
  assert.equal(report.blockers.length, 0);
  for (const answer of outcomes) assert.ok(report.sample.some(i => table.rows[i][2] === answer));
  assert.ok(report.sample.length <= 20);
  table.rows.forEach(row => { if (row[2] === 'Billing') row[0] = 'same-case'; });
  assert.ok(reviewData(table, mapping, outcomes, {}).blockers.some(text => /Billing.*3/.test(text)));
  const manyAnswers = Array.from({ length:16 }, (_, index) => String(index));
  const many = { headers:['Message','Answer'], rows: [...Array.from({length:12}, (_, i) => [`Unlabeled ${i}`, '']), ...manyAnswers.map(answer => [`Message ${answer}`, answer])] };
  const sampled = reviewData(many, {inputs:['Message'], answer:'Answer', group:''}, manyAnswers, {});
  for (const answer of manyAnswers) assert.ok(sampled.sample.some(index => many.rows[index][1] === answer));
});
