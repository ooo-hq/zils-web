import { test, expect } from '@playwright/test';
const owner='10000000-0000-4000-8000-000000000002', jobId='10000000-0000-4000-8000-000000000003';
for (const mobile of [false,true]) test(`reviewed photos, labels and groups become an image job (${mobile?'mobile':'desktop'})`, async ({page}) => {
  if(mobile) await page.setViewportSize({width:390,height:844});
  const expires=Math.floor(Date.now()/1000)+3600;
  await page.addInitScript(({owner,expires}) => { const user={id:owner,email:'owner@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}; localStorage.setItem('zils-training-auth',JSON.stringify({user,access_token:`${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({sub:owner,exp:expires}))}.fixture`,refresh_token:'fixture',expires_at:expires,expires_in:3600,token_type:'bearer'})); },{owner,expires});
  let created: Record<string,unknown>|undefined;
  const calls:string[]=[], complete=new Set<string>(), rows:Record<string,unknown>[]=[], assets:Record<string,{id:string;state:string;expires_at:string}>= {};
  const job=()=>({id:jobId,name:'inspection',status:'uploading',created_at:'2026-10-08T12:00:00Z',model:{id:'imajev-4b-v1',name:'Imajev 4B',base:'Qwen/Qwen3.5-4B',base_revision:'8'.repeat(40)},image_intake:created?.image_intake});
  const uploads=()=>Object.fromEntries(['train','calibration','test'].map(s=>[s,{url:`http://127.0.0.1:8998/storage/v1/object/upload/sign/fez-training-data/${jobId}/${s}.jsonl`,method:'PUT',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'}}]));
  await page.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url()), path=url.pathname;
    if(url.origin==='http://127.0.0.1:3107') return path==='/api/access/session' ? route.fulfill({json:{status:'active'}}) : route.continue();
    if(!['http://127.0.0.1:8998','http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS'};
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
    calls.push(req.method()+' '+path);
    if(path==='/v1/image-models') return route.fulfill({headers,json:{models:[{name:'image-stock',stock:true,capabilities:{modalities:['image','text']}}],training_enabled:true,training_profile:{model:'imajev-4b-v1',max_train:1024,max_calibration:256,max_test:512,max_source_bytes:10485760,max_pixels:16000000,max_edge:8192}}});
    if(path==='/v1/jobs' && req.method()==='GET') return route.fulfill({headers,json:{jobs:[]}});
    if(path==='/v1/jobs' && req.method()==='POST') {created=req.postDataJSON();return route.fulfill({headers,json:{job:job(),uploads:uploads()}});}
    if(path.endsWith('/uploads')) return route.fulfill({headers,json:{job:job(),uploads:uploads()}});
    if(path.endsWith('/image-assets') && path.includes('/jobs/')) return route.fulfill({headers,json:{assets:[]}});
    if(path==='/v1/image-assets') {expect(created?.model).toBe('imajev-4b-v1'); const id=`20000000-0000-4000-8000-${String(Object.keys(assets).length+1).padStart(12,'0')}`;assets[id]={id,state:'uploading',expires_at:'2099-01-01T00:00:00Z'};return route.fulfill({headers,json:{asset:assets[id],upload:{url:`http://127.0.0.1:8998/storage/v1/object/upload/sign/zils-images/${owner}/${id}/source`,method:'PUT',headers:{'x-upsert':'false','Content-Type':'application/octet-stream'}}}});}
    if(path.endsWith('/complete')) {const id=path.split('/').at(-2)!;complete.add(id);return route.fulfill({headers,json:{...assets[id],state:'ready',sha256:'a'.repeat(64),width:8,height:8}});}
    if(req.method()==='PUT') {if(path.endsWith('.jsonl')) for(const row of req.postData()!.trim().split('\n').map(s=>JSON.parse(s))) {expect(complete.has(row.image.asset_id)).toBe(true);rows.push(row);}return route.fulfill({headers,json:{}});}
    if(path.endsWith('/submit')) return route.fulfill({headers,json:{job:{...job(),status:'validating'}}});
    return route.fulfill({status:404,headers,json:{}});
  });
  await page.goto('/train');await page.getByRole('tab',{name:'Images',exact:true}).click();
  await page.getByRole('button',{name:'Train on my images',exact:true}).click();
  const images=await page.evaluate(()=>Array.from({length:18},(_,i)=>{const c=document.createElement('canvas');c.width=8;c.height=8;const x=c.getContext('2d')!;x.fillStyle=`rgb(${i*11},30,80)`;x.fillRect(0,0,8,8);return c.toDataURL().split(',')[1];}));
  await page.getByLabel('Training photos',{exact:true}).setInputFiles(images.map((s,i)=>({name:`photo-${i}.png`,mimeType:'image/png',buffer:Buffer.from(s,'base64')})));
  const csv='filename,answer,group\n'+images.map((_,i)=>`photo-${i}.png,${i===0?'':i%2?'Damaged':'Normal'},item-${i}`).join('\n');
  await expect(page.getByLabel('Image labels CSV',{exact:true})).toBeEnabled();
  await page.getByLabel('Image labels CSV',{exact:true}).setInputFiles({name:'labels.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByLabel('Image training decision',{exact:true}).fill('Is the item damaged?');
  await expect(page.getByRole('button',{name:'Train on my images',exact:true})).toHaveAttribute('aria-expanded','true');
  await page.getByLabel('Image training answers',{exact:true}).fill('Normal\nDamaged');
  await page.getByLabel('Answer for photo-0.png',{exact:true}).selectOption('Normal');
  await page.getByLabel('I have reviewed the labels and item groups',{exact:true}).check();
  await page.getByRole('button',{name:'Review image splits',exact:true}).click();
  await page.getByLabel('Positive class',{exact:true}).selectOption('Damaged');
  await page.getByLabel('Minimum positive recall (%)',{exact:true}).fill('95');
  await page.getByLabel('Maximum false alarms (%)',{exact:true}).fill('20');
  await page.getByLabel('I have permission to share training images with approved workers',{exact:true}).check();
  await page.getByRole('button',{name:'Start image training',exact:true}).click();
  await expect(page.getByText('Image run submitted for validation.',{exact:true})).toBeVisible();
  expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`.private/image-training-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  expect(rows).toHaveLength(18);expect(complete.size).toBe(18);
  for(const row of rows) {expect(row.state).toEqual({});expect(Object.keys(row.image as object)).toEqual(['asset_id']);expect(row).not.toHaveProperty('filename');}
  expect(calls.findIndex(c=>c==='POST /v1/jobs')).toBeLessThan(calls.findIndex(c=>c==='POST /v1/image-assets'));
});
