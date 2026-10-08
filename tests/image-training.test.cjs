const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
function subject() { assert.ok(fs.existsSync(require('node:path').resolve(__dirname, '../.private/test-build/image-training.js')), 'image training module missing'); return require('../.private/test-build/image-training.js'); }
const question = { type: 'choice', instructions: 'Choose condition', criteria: { normal: null, damaged: null, unclear: null } };
function examples() { return Array.from({ length: 18 }, (_, i) => ({ id: `case-${i}`, filename: `photo-${i}.png`, file: new File([String(i)], `photo-${i}.png`, { type: 'image/png' }), label: Object.keys(question.criteria)[i % 3], groupId: `item-${i}`, state: {} })); }

test('image splits preserve groups and every outcome with deterministic seed', () => {
  const { prepareImageTraining } = subject(); const rows = examples();
  const result = prepareImageTraining(rows, question, Object.keys(question.criteria), 'seed-1');
  const seen = new Set();
  for (const name of ['train', 'calibration', 'test']) {
    assert.deepEqual(new Set(result.splits[name].map(row => row.label)), new Set(Object.keys(question.criteria)));
    for (const row of result.splits[name]) { assert.ok(!seen.has(row.groupId)); seen.add(row.groupId); }
  }
  assert.deepEqual(result, prepareImageTraining(rows, question, Object.keys(question.criteria), 'seed-1'));
  assert.equal(Object.values(result.counts).reduce((a,b) => a+b, 0), 18);
  assert.throws(() => prepareImageTraining(rows.map(row => ({...row, groupId: row.label === 'damaged' ? 'same-item' : row.groupId})), question, Object.keys(question.criteria), 'seed'), /independent/);
  assert.throws(() => prepareImageTraining([{...rows[0], label:''}, ...rows.slice(1)], question, Object.keys(question.criteria), 'seed'), /answer|label/);
});

test('file labels map exactly and never become model state', () => {
  const { mapImageExamples } = subject();
  const files = ['normal/part.png', 'damaged/part.png'].map(path => { const file = new File(['bytes'], 'part.png', {type:'image/png'}); Object.defineProperty(file, 'webkitRelativePath', {value:path}); return file; });
  assert.throws(() => mapImageExamples(files, 'filename,answer\npart.png,normal'), /ambiguous|relative path/);
  const mapped = mapImageExamples(files, 'filename,answer,group\nnormal/part.png,normal,item-1\ndamaged/part.png,damaged,item-2');
  assert.deepEqual(mapped.map(row => row.state), [{},{}]);
  assert.deepEqual(Object.fromEntries(mapImageExamples(files).map(row => [row.filename,row.label])), {'normal/part.png':'normal','damaged/part.png':'damaged'});
});

test('a frozen image draft rejects changed labels before any upload or new job', async () => {
  const { prepareImageTraining, imageDraftFingerprint, uploadImageTraining } = subject();
  const rows = examples(), prepared = prepareImageTraining(rows, question, Object.keys(question.criteria), 'seed');
  const fingerprint = await imageDraftFingerprint(prepared, question);
  const draft = { job: {id:'10000000-0000-4000-8000-000000000001', image_intake:{snapshot_sha256:fingerprint}}, assets:{} };
  rows[0] = {...rows[0], label:'damaged'};
  const changed = prepareImageTraining(rows, question, Object.keys(question.criteria), 'seed');
  let calls=0; const api = new Proxy({}, {get(){ return () => {calls++; throw new Error('unexpected network');}; }});
  await assert.rejects(uploadImageTraining(changed, question, {}, api, api, draft), /new run|changed/);
  assert.equal(calls,0);
});

test('image upload retries only missing bytes, limits concurrency to two and excludes omitted files', async () => {
  const { prepareImageTraining, uploadImageTraining } = subject();
  const all=examples(), prepared=prepareImageTraining(all.slice(1),question,Object.keys(question.criteria),'seed');
  const records=new Map(), uploaded=new Set(), attempts=new Map(), finalized=new Set(), datasets=[];
  let active=0,peak=0,fail=true;
  const draft={assets:{}};
  const training={
    async createImage(input){return {job:{id:'10000000-0000-4000-8000-000000000001',status:'uploading',image_intake:input.image_intake}};},
    async get(){return {job:draft.job};},
    async imageAssets(){return {assets:[...records.values()]};},
    async resume(){return {uploads:{train:{},calibration:{},test:{}}};},
    async upload(split,slot,file){const data=(await file.text()).trim().split('\n').map(JSON.parse);for(const row of data)assert.ok(finalized.has(row.image.asset_id));datasets.push(...data);},
    async submit(){return {job:{id:draft.job.id,status:'validating'}};},
  };
  const images={
    async createAsset(input){const id=String(records.size+1);records.set(id,{id,filename:input.filename,source_sha256:input.source_sha256});return {asset:{id},upload:{id}};},
    async upload(slot){active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,2));attempts.set(slot.id,(attempts.get(slot.id)||0)+1);if(fail&&slot.id==='2')throw new Error('interrupted');uploaded.add(slot.id);}finally{active--;}},
    async resumeAsset(id){return {uploaded:uploaded.has(id),upload:{id},asset:{id}};},
    async completeAsset(id){assert.ok(uploaded.has(id));finalized.add(id);return {id,state:'ready'};},
  };
  await assert.rejects(uploadImageTraining(prepared,question,{},training,images,draft),/interrupted/);
  const completedBefore=[...uploaded];fail=false;
  const result=await uploadImageTraining(prepared,question,{},training,images,draft);
  assert.equal(result.status,'validating');assert.equal(draft.job.status,'validating');assert.equal(peak,2);assert.equal(datasets.length,17);
  assert.ok(![...records.values()].some(row=>row.filename===all[0].filename));
  for(const id of completedBefore)assert.equal(attempts.get(id),1);
});

test('retry reconciles a submit that committed before its response was lost', async () => {
  const { prepareImageTraining, uploadImageTraining } = subject();
  const prepared = prepareImageTraining(examples(), question, Object.keys(question.criteria), 'seed');
  const draft = { assets: {} }; let job, uploads = 0, submits = 0;
  const training = {
    async createImage(input) { job = { id: '10000000-0000-4000-8000-000000000001', status: 'uploading', image_intake: input.image_intake }; return { job: { ...job } }; },
    async get() { return { job: { ...job } }; },
    async imageAssets() { if (job.status !== 'uploading') throw new Error('409: no longer accepting image uploads'); return { assets: [] }; },
    async resume() { return { uploads: { train: {}, calibration: {}, test: {} } }; },
    async upload() { uploads++; },
    async submit() { submits++; job = { ...job, status: 'validating' }; throw new Error('lost response'); },
  };
  let next = 0;
  const images = { async createAsset() { return { asset: { id: String(++next) }, upload: {} }; }, async upload() { uploads++; }, async completeAsset() { return { state: 'ready' }; } };
  await assert.rejects(uploadImageTraining(prepared, question, {}, training, images, draft), /lost response/);
  const before = uploads;
  assert.equal((await uploadImageTraining(prepared, question, {}, training, images, draft)).status, 'validating');
  assert.equal(draft.job.status, 'validating'); assert.equal(uploads, before); assert.equal(submits, 1);
});

test('resuming image uploads rejects changed frozen quality targets before network calls', async()=>{
 const {prepareImageTraining,imageDraftFingerprint,uploadImageTraining}=subject();
 const p=prepareImageTraining(examples(),question,Object.keys(question.criteria),'seed');
 const acceptance={min_accuracy:.8,min_brier_improvement:.01};
 const draft={job:{id:'10000000-0000-4000-8000-000000000001',acceptance,image_intake:{snapshot_sha256:await imageDraftFingerprint(p,question)}},assets:{}};
 let calls=0;const api=new Proxy({}, {get(){return ()=>{calls++;throw new Error('unexpected network');};}});
 await assert.rejects(uploadImageTraining(p,question,{acceptance:{...acceptance,min_accuracy:.5}},api,api,draft),/targets|changed|new run/);
 assert.equal(calls,0);
});
