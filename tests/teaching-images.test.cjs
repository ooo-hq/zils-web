const {test} = require('node:test');
const assert = require('node:assert/strict');
const {checkTeachingImage, prepareImageTeachingDraft, readImageTeachingLabels} = require('../.private/test-build/teaching-images.js');

test('image intake rejects unsupported, empty and oversized files before decoding', () => {
  checkTeachingImage(new File(['image'], 'photo.png', {type:'image/png'}));
  for (const file of [new File([], 'empty.png', {type:'image/png'}), new File(['x'], 'x.svg', {type:'image/svg+xml'}), new File(['x'.repeat(10*1024*1024+1)], 'large.jpg', {type:'image/jpeg'})]) assert.throws(() => checkTeachingImage(file), /JPEG|PNG|10 MiB/);
});

const photos = () => Array.from({length:12}, (_,i) => ({id:`photo-${i}`, filename:`photo-${i}.png`, file:new File([String(i)], `photo-${i}.png`, {type:'image/png'}), label:i%2 ? 'Damaged':'Normal', groupId:`item-${i}`, state:{}, sha256:String(i).padStart(64,'0'), url:'blob:private-photo'}));
test('image label imports support JSON and JSONL while rejecting ambiguous lists and unknown filenames',async()=>{
  const files=photos().map(row=>row.file),records=[{filename:'photo-0.png',answer:'Normal',group:'one-item'}];
  for(const file of [new File([JSON.stringify(records)],'labels.json'),new File([JSON.stringify(records[0])+'\n'],'labels.jsonl')]) {
    const rows=await readImageTeachingLabels(files,file);assert.equal(rows[0].label,'Normal');assert.equal(rows[0].groupId,'one-item');assert.deepEqual(rows[0].state,{});
  }
  await assert.rejects(readImageTeachingLabels(files,new File([JSON.stringify({one:records,two:records})],'labels.json')),/one sheet/);
  await assert.rejects(readImageTeachingLabels(files,new File(['filename,answer\nunknown.png,Normal'],'labels.csv')),/not among/);
});
test('image drafts require review and reject duplicate image content', () => {
  assert.throws(() => prepareImageTeachingDraft(photos(), 'Choose condition', 'Normal\nDamaged', false), /review/i);
  const rows=photos(); rows[1].sha256=rows[0].sha256;
  assert.throws(() => prepareImageTeachingDraft(rows, 'Choose condition', 'Normal\nDamaged', true), /same image/i);
});
test('image drafts keep item groups separate and export metadata without pretending to include image bytes', () => {
  const rows=photos(); rows[2].groupId=rows[0].groupId;
  const result=prepareImageTeachingDraft(rows, 'Choose condition', 'Normal\nDamaged', true);
  assert.equal(result.previewOnly, true); assert.equal(result.imagesIncluded, false);
  const groups=new Map();
  for(const [split,examples] of Object.entries(result.splits)) for(const row of examples) {
    assert.equal(groups.get(row.group_id) || split, split); groups.set(row.group_id,split);
    assert.ok(!('file' in row)); assert.ok(!('url' in row)); assert.deepEqual(row.state,{});
  }
  assert.equal(result.counts.total,12);
});
