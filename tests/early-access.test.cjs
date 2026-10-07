const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const compiled = '../.private/test-build/early-access-server.js';
const config = { url: 'https://project.supabase.co', serviceKey: 'server-secret', adminEmails: 'admin@example.com', siteUrl: 'https://zils.example', mailKey: 'mail-secret', mailFrom: 'hello@zils.example' };
const admin = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com', email_confirmed_at: '2026-10-01T00:00:00Z', is_anonymous: false };
const application = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.com', status: 'invited', invitation_version: '33333333-3333-4333-8333-333333333333' };
const request = (path, body, token, origin = 'https://zils.example') => new Request('https://zils.example'+path, { method: body ? 'POST' : 'GET', headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer '+token } : {}) }, ...(body ? { body: typeof body==='string' ? body : JSON.stringify(body) } : {}) });
function handler() { assert.ok(fs.existsSync(require('node:path').resolve(__dirname, compiled)), 'early-access server handler is implemented'); return require(compiled).handleAccessRequest; }
function transport({user=admin, delivery=200, reserve='ok'}={}) {
 const calls=[];
 const send=async(url, options={})=>{
  const body=options.body ? JSON.parse(options.body):null; calls.push({url, ...options, body});
  if(url.endsWith('/auth/v1/user')) return Response.json(user, {status:user?200:401});
  if(url.endsWith('/rpc/zils_access_apply')) return Response.json('accepted');
  if(url.endsWith('/rpc/zils_access_claim')) return Response.json({status:'active'});
  if(url.endsWith('/rpc/zils_access_overview')) return Response.json({capacity:25,allocated:3,waiting:1,total:1,applications:[application]});
  if(url.endsWith('/rpc/zils_access_invite')) return Response.json({status:reserve,application,send:reserve==='ok'});
  if(url.includes('/auth/v1/admin/generate_link')) return Response.json({action_link:'https://project.supabase.co/auth/v1/verify?token=secret-invite-token',email_otp:'123456',hashed_token:'secret',user:{id:application.id}});
  if(url==='https://api.resend.com/emails') return Response.json(delivery===200?{id:'mail-id'}:{error:'private mail provider error'},{status:delivery});
  if(url.includes('/rest/v1/zils_access_applications?')) return new Response(null,{status:204});
  throw new Error('Unexpected provider operation '+url);
 }; return {send,calls};
}
test('applications normalize email, hash source, and do not create access or send mail',async()=>{
 const t=transport(); const r=await handler()(request('/api/access/apply',{email:' Member@Example.com ',useCase:'Route support requests',website:''}),config,t.send);
 assert.equal(r.status,200); assert.equal((await r.json()).ok,true); assert.equal(t.calls.length,1);
 assert.equal(t.calls[0].body.p_email,'member@example.com'); assert.match(t.calls[0].body.p_source,/^[a-f0-9]{64}$/);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('malformed forms, foreign origins, and oversized bodies never reach storage',async()=>{
 const t=transport(); const h=handler();
 assert.equal((await h(request('/api/access/apply',{email:'x',useCase:'x'}),config,t.send)).status,400);
 assert.equal((await h(request('/api/access/apply',{email:'a@example.com',useCase:'x'},null,'https://evil.example'),config,t.send)).status,403);
 assert.equal((await h(request('/api/access/apply','x'.repeat(13000)),config,t.send)).status,413);
 assert.equal((await h(request('/api/access/apply',{email:'a@example.com',useCase:'x',website:'spam'}),config,t.send)).status,200);
 assert.equal(t.calls.length,0);
});
test('only a verified configured admin can read applicants or invite',async()=>{
 for(const user of [{...admin,email:'customer@example.com',user_metadata:{role:'admin'}},{...admin,email_confirmed_at:null},{...admin,is_anonymous:true},null]) {
  const t=transport({user}); const r=await handler()(request('/api/admin/access',null,'session'),config,t.send);
  assert.ok([401,403].includes(r.status)); assert.equal(t.calls.length,1);
 }
 const t=transport(); assert.equal((await handler()(request('/api/admin/access'),config,t.send)).status,401); assert.equal(t.calls.length,0);
 const allowed=await handler()(request('/api/admin/access?status=waiting&offset=0',null,'session'),config,t.send);
 assert.equal(allowed.status,200); assert.equal((await allowed.json()).allocated,3);
});
test('approved invite uses canonical return URL and does not expose magic-link secrets',async()=>{
 const t=transport(); const r=await handler()(request('/api/admin/access/invite',{email:application.email,action:'approve'},'session'),config,t.send);
 assert.equal(r.status,200); const result=await r.json(); assert.equal(result.delivery,'sent');
 const mail=t.calls.find(x=>x.url==='https://api.resend.com/emails'); assert.deepEqual(mail.body.to,[application.email]); assert.match(mail.body.subject,/invited/i);
 const link=t.calls.find(x=>x.url.includes('generate_link')); assert.equal(new URL(link.url).searchParams.get('redirect_to'),'https://zils.example/train');
 assert.ok(!JSON.stringify(result).includes('secret')); assert.ok(mail.headers['Idempotency-Key'].includes(application.invitation_version));
});
test('capacity reached sends no invitation; delivery failure preserves reserved seat for retry',async()=>{
 const full=transport({reserve:'full'}); const h=handler();
 const r=await h(request('/api/admin/access/invite',{email:application.email,action:'approve'},'session'),config,full.send);
 assert.equal(r.status,409); assert.equal(full.calls.length,2);
 const failed=transport({delivery:500}); const response=await h(request('/api/admin/access/invite',{email:application.email,action:'approve'},'session'),config,failed.send);
 assert.equal(response.status,200); const result=await response.json(); assert.equal(result.delivery,'failed'); assert.match(result.message,/reserved/);
 assert.ok(!JSON.stringify(result).includes('private mail')); assert.equal(failed.calls.at(-1).body.delivery_status,'failed');
});
test('missing server configuration fails closed without contacting a provider',async()=>{
 const t=transport(); const r=await handler()(request('/api/access/session',{},'session'),{},t.send); assert.equal(r.status,503); assert.equal(t.calls.length,0);
});
test('membership is claimed using the server-verified user, never a supplied owner',async()=>{
 const t=transport({user:{...admin,email:'member@example.com'}}); const r=await handler()(request('/api/access/session',{},'session'),config,t.send);
 assert.equal(r.status,200); assert.equal((await r.json()).status,'active'); assert.equal(t.calls.at(-1).body.p_owner,admin.id);
});

test('a refreshed token preserves an approved workspace only for the same account',()=>{
 const { workspaceAccess }=require('../.private/test-build/early-access.js');
 assert.equal(workspaceAccess({owner:'a',token:'old',status:'active'},'a','refreshed'),'active');
 assert.equal(workspaceAccess({owner:'a',token:'old',status:'active'},'b','refreshed'),'checking');
 assert.equal(workspaceAccess({owner:'a',token:'refreshed',status:'paused'},'a','refreshed'),'paused');
 assert.equal(workspaceAccess({owner:'a',token:'refreshed',error:'Unavailable'},'a','refreshed'),'error');
});

test('same-site forms work when Next uses an internal hostname for the request URL',async()=>{
 const t=transport();
 const r=new Request('http://localhost:3109/api/access/apply',{method:'POST',headers:{host:'127.0.0.1:3109',origin:'http://127.0.0.1:3109','content-type':'application/json'},body:JSON.stringify({email:'preview@example.com',useCase:'Support routing'})});
 assert.equal((await handler()(r,config,t.send)).status,200);
});
