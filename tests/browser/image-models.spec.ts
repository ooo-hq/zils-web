import { test, expect, type Page } from '@playwright/test';

const owner = '10000000-0000-4000-8000-000000000002';
const asset = '10000000-0000-4000-8000-000000000001';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPkEpFjwAaYsIoOWgkANVwATIkpP+sAAAAASUVORK5CYII=', 'base64');
function session(id = owner, tag = 'initial') {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, email: `${id}@example.com`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: expires, tag })).toString('base64url')}.fixture`;
  return { user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires };
}
async function workspace(page: Page, options: { expired?: boolean; disabled?: boolean; holdUpload?: boolean; jobs?: object[] } = {}) {
  const mutations: string[] = [];
  let releaseUpload: (() => void) | undefined;
  await page.addInitScript(value => localStorage.setItem('zils-training-auth', JSON.stringify(value)), session());
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const bearer = (req.headers().authorization || "").split(" ")[1];
    const requestOwner = bearer ? JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()).sub : owner;
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: session().user, headers });
    if (req.method() !== 'GET') mutations.push(req.method() + ' ' + url.pathname);
    if (url.pathname === '/v1/jobs') return route.fulfill({ json: { jobs: requestOwner === owner ? options.jobs || [] : [] }, headers });
    if (url.pathname.startsWith('/v1/jobs/')) { const job = (options.jobs || []).find(item => (item as {id:string}).id === url.pathname.split('/').at(-1)); if (requestOwner === owner && job) return route.fulfill({json:{job},headers}); }
    if (url.pathname === '/v1/image-models') return route.fulfill({ status: options.disabled ? 503 : 200, json: { models: [{ name: 'image-stock', stock: true, capabilities: { modalities: ['image', 'text'] } }, ...(requestOwner === owner ? [{ name:'private-image-fixture',stock:false,capabilities:{modalities:['image','text']},task:{question:{type:'choice',instructions:'Inspect the connector.',criteria:{Normal:null,Damaged:null}},outcome_order:['Normal','Damaged']}}] : [])], training_enabled: false }, headers });
    if (url.pathname === '/v1/image-assets') return route.fulfill({ status: 201, headers, json: { asset: { id: asset, state: 'uploading', expires_at: '2099-01-01T00:00:00Z' }, upload: { url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/zils-images/${owner}/${asset}/source?token=fixture`, method: 'PUT', headers: { 'x-upsert': 'false', 'Content-Type': 'application/octet-stream' } } } });
    if (req.method() === 'PUT') {
      if (options.holdUpload) await new Promise<void>(resolve => { releaseUpload = resolve; });
      return route.fulfill({ json: {}, headers }).catch(() => {});
    }
    if (url.pathname.endsWith('/complete')) return route.fulfill({ status: options.expired ? 401 : 200, headers, json: options.expired ? { error: { message: 'Session expired' } } : { id: asset, state: 'ready', sha256: 'a'.repeat(64), width: 1, height: 1, expires_at: '2099-01-01T00:00:00Z' } });
    if (req.method() === 'DELETE') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/v1/image-decisions') return route.fulfill({ headers, json: { model: req.postDataJSON().model, answers: { inspection: { type: 'choice', choice: 'Damaged', probabilities: { Normal: .4, Damaged: .6 }, confidence: .1, unknown_probability: .5, abstained: true } }, usage: { input_tokens: 442, output_tokens: 0 } } });
    return route.fulfill({ status: 404, json: {}, headers });
  });
  await page.goto('/train');
  await expect(page.getByRole('heading', { name: 'Training', exact: true })).toBeVisible();
  return { mutations, release: () => releaseUpload?.() };
}
async function changeSession(page: Page, id: string, tag: string) {
  await page.evaluate(value => {
    localStorage.setItem('zils-training-auth', JSON.stringify(value));
    const channel = new BroadcastChannel('zils-training-auth');
    channel.postMessage({ event: 'TOKEN_REFRESHED', session: value });
    setTimeout(() => channel.close(), 100);
  }, session(id, tag));
}


const policy={min_accuracy:.8,min_brier_improvement:.01,positive_class:'Damaged',min_positive_recall:.9,max_false_positive_rate:.1};
function metric(recall:number, falseAlarm:number){return {accuracy:.84,brier:.2,skill:.6,count:100,cases:100,nll:.4,unknown_rate:0,unknown_count:0,outcome_order:['Normal','Damaged'],per_class:{Damaged:{support:50,true_positives:Math.round(recall*50),false_negatives:Math.round((1-recall)*50),false_positives:Math.round(falseAlarm*50),negatives:50,recall,false_positive_rate:falseAlarm}},confusion:{Normal:{Normal:Math.round((1-falseAlarm)*50),Damaged:Math.round(falseAlarm*50),__unknown__:0},Damaged:{Normal:Math.round((1-recall)*50),Damaged:Math.round(recall*50),__unknown__:0}}};}
function imageJob(ready=false){return {id:'30000000-0000-4000-8000-000000000003',name:'connector-inspection',status:'completed',model:{id:'imajev-4b-v1',name:'Imajev 4B',base:'Qwen/Qwen3.5-4B',base_revision:'a'.repeat(40)},acceptance:policy,data_expires_at:'2099-11-07T00:00:00Z',workflow:{state:ready?'ready':'finished',...(ready?{model_id:'private-image-fixture'}:{})},result:{image_metrics_version:'zils-image-metrics/v1',baseline:{...metric(.6,.2),accuracy:.7},miners:[{uid:1,status:'evaluated',...metric(.96,.28)},{uid:2,status:'evaluated',...metric(.72,.04)}],weights:{},delivery:{status:ready?'accepted':'no_qualifying_model',acceptance:policy}}};}
async function openRun(page:Page){await expect(page.getByRole('heading',{name:'connector-inspection',exact:true,level:2})).toBeVisible();}
test('equal accuracy shows different recall and false alarms without offering a rejected model',async({page})=>{
 await workspace(page,{jobs:[imageJob()]});await openRun(page);
 const results=page.getByRole('region',{name:'Image evaluation results'});
 await expect(results).toBeVisible();
 await expect(results.getByText('84%',{exact:true})).toHaveCount(2);
 await expect(results.getByText('96% (48/50)',{exact:true})).toBeVisible();
 await expect(results.getByText('72% (36/50)',{exact:true})).toBeVisible();
 await expect(results.getByText('28% (14/50)',{exact:true})).toBeVisible();
 await expect(results.getByText('4% (2/50)',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Use your model'})).toHaveCount(0);
});
for(const mobile of [false,true]) test(`ready private prediction and account isolation (${mobile?'mobile':'desktop'})`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await workspace(page,{jobs:[imageJob(true)]});await openRun(page);
 await page.getByRole('button',{name:'Use your model'}).click();
 await page.getByRole('button',{name:'One image',exact:true}).click();
 const panel=page.getByRole('region',{name:'Try your image model.'});
 await expect(panel.getByLabel('Image decision',{exact:true})).toHaveValue('Inspect the connector.');
 await panel.getByLabel('Photo',{exact:true}).setInputFiles({name:'private-photo.png',mimeType:'image/png',buffer:png});
 const sent=page.waitForRequest(req=>new URL(req.url()).pathname==='/v1/image-decisions');
 await panel.getByRole('button',{name:'Analyze image'}).click();
 expect((await sent).postDataJSON().model).toBe('private-image-fixture');
 await expect(panel.getByTestId('image-answer')).toHaveText('Needs review');
 if(mobile)expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 await changeSession(page,'20000000-0000-4000-8000-000000000002','changed');
 await expect(page.getByText('private-photo.png',{exact:true})).toHaveCount(0);
 await expect(page.getByText('private-image-fixture',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/connector-inspection/})).toHaveCount(0);
});

test('changing accounts during a private-model upload cancels the pending prediction',async({page})=>{
 const control=await workspace(page,{jobs:[imageJob(true)],holdUpload:true});await openRun(page);
 await page.getByRole('button',{name:'Use your model'}).click();
 await page.getByRole('button',{name:'One image',exact:true}).click();
 const panel=page.getByRole('region',{name:'Try your image model.'});
 await panel.getByLabel('Photo',{exact:true}).setInputFiles({name:'pending-private.png',mimeType:'image/png',buffer:png});
 await panel.getByRole('button',{name:'Analyze image'}).click();
 await expect(panel.getByRole('status').filter({hasText:'Uploading photo'})).toBeVisible();
 await changeSession(page,'20000000-0000-4000-8000-000000000002','switched');control.release();
 await expect(page.getByText('pending-private.png',{exact:true})).toHaveCount(0);
 expect(control.mutations.some(path=>path.endsWith('/v1/image-decisions'))).toBe(false);
});

test('upgrade compares against the immutable previous client model', async ({page}) => {
 const previous={job_id:'40000000-0000-4000-8000-000000000004',model_id:'zils-adapter-previous-fixture',sha256:'b'.repeat(64)};
 await workspace(page,{jobs:[{...imageJob(),selection:{version:'zils-version-selection/v1',root_job_id:previous.job_id,previous}}]});
 await openRun(page);
 const results=page.getByRole('region',{name:'Image evaluation results'});
 await expect(results.getByRole('columnheader',{name:'Model',exact:true})).toBeVisible();
 await expect(results.getByRole('rowheader',{name:'Previous client model',exact:true})).toBeVisible();
 await expect(results.getByText(previous.model_id,{exact:true})).toBeVisible();
 await expect(results.getByText('Stock Imajev',{exact:true})).toHaveCount(0);
});
