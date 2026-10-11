const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zipSync, strToU8 } = require('fflate');
const { readTextDocument, suggestDocumentFields, documentTeachingExample } = require('../.private/test-build/teaching-documents.js');

test('text documents preserve content and reject unsupported, oversized or invalid inputs', async () => {
  assert.equal(await readTextDocument(new File(['\ufeffInvoice number: A-1\nTotal: $42'], 'invoice.txt')), 'Invoice number: A-1\nTotal: $42');
  for (const file of [new File([], 'empty.txt'), new File(['x'], 'old.doc'), new File([new Uint8Array([255])], 'bad.md'), new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'large.txt')]) await assert.rejects(readTextDocument(file));
});

test('DOCX paragraphs and table cells remain readable without executing embedded content', async () => {
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Invoice &amp; receipt</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Total:</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>42</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const text = await readTextDocument(new File([zipSync({'word/document.xml':strToU8(xml)})], 'invoice.docx'));
  assert.match(text, /Invoice & receipt/);
  assert.match(text, /Total:\s+42/);
  await assert.rejects(readTextDocument(new File(['broken'], 'broken.docx')), /Word|DOCX|document/i);
  await assert.rejects(readTextDocument(new File([zipSync({'word/document.xml':strToU8('<broken>')})], 'invalid.docx')), /Word|DOCX|document/i);
});

test('field suggestions retain evidence and never guess missing or conflicting values', () => {
  const fields = suggestDocumentFields('Invoice number: INV-42\nTotal: 420.00\nTotal: 440.00\nVendor: Alder & Co', 'Invoice number\nTotal\nDue date\nVendor');
  assert.deepEqual(fields.map(({name,value,status}) => ({name,value,status})), [
    {name:'Invoice number',value:'INV-42',status:'found'},
    {name:'Total',value:'',status:'ambiguous'},
    {name:'Due date',value:'',status:'missing'},
    {name:'Vendor',value:'Alder & Co',status:'found'},
  ]);
  assert.equal(fields[0].evidence[0], 'Invoice number: INV-42');
  assert.throws(() => suggestDocumentFields('x', 'Total\ntotal'), /different|unique/i);
});

test('document examples keep their source group and still require task review', () => {
  const document = {name:'invoice.pdf',text:'Invoice number: INV-42',group:'doc-sha256'};
  const row = documentTeachingExample(document, [{name:'Invoice number',value:'INV-42'}]);
  assert.equal(row.input, 'Invoice number: INV-42');
  assert.equal(row.output, 'Invoice number: INV-42');
  assert.equal(row.group, 'doc-sha256');
  assert.equal(row.reviewed, false);
  assert.equal(documentTeachingExample(document, []).output, '');
  assert.throws(() => documentTeachingExample({...document,text:'x'.repeat(16001)}, []), /16,000|excerpt/);
  assert.throws(() => documentTeachingExample(document, [{name:'Answer',value:'x'.repeat(16001)}]), /16,000/);
});
