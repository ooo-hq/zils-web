import { createHmac } from 'node:crypto';
import { z } from 'zod';

type Config = { url?: string; serviceKey?: string; adminEmails?: string; siteUrl?: string; mailKey?: string; mailFrom?: string };
const email = z.string().trim().max(254).pipe(z.email({ pattern: z.regexes.html5Email })).transform(value => value.toLowerCase());
const application = z.strictObject({ email, useCase: z.string().trim().min(1).max(2000), website: z.string().max(500).default('') });
const invite = z.strictObject({ email, action: z.enum(['approve', 'resend', 'pause']) });
const userSchema = z.object({ id: z.uuid(), email: z.string(), email_confirmed_at: z.string().nullable().optional(), is_anonymous: z.boolean().optional() });
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const unavailable = () => new AccessError(503, 'Early access is temporarily unavailable. Please try again shortly.');

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AccessError(415, 'Use the form to submit your details.');
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, 'Check your details and try again.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 12_288) { await reader.cancel(); throw new AccessError(413, 'Please keep your answer to 2,000 characters.'); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new AccessError(400, 'Check your details and try again.'); }
  } finally { reader.releaseLock(); }
}

/** Server routes only: service credentials and invitation links never enter API responses. */
export async function handleAccessRequest(request: Request, config: Config, send: typeof fetch = fetch): Promise<Response> {
  try {
    const target = new URL(request.url);
    const host = request.headers.get('host') || target.host;
    const origin = request.headers.get('origin');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`https://${host}`).hostname);
    if (request.method === 'POST' && origin !== `https://${host}` && !(local && origin === `http://${host}`)) throw new AccessError(403, 'Open this form on the Zils website.');
    const parsedUrl = z.url().safeParse(config.url);
    if (!parsedUrl.success || !config.serviceKey?.trim()) throw unavailable();
    const provider = new URL(parsedUrl.data);
    if (provider.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(provider.hostname) && provider.protocol === 'http:')) throw unavailable();
    const base = provider.origin;
    const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' };
    async function remote(path: string, body?: object, method = 'POST') {
      const response = await send(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store' });
      if (!response.ok) throw unavailable();
      return response.status === 204 ? null : response.json();
    }
    const rpc = (name: string, body: object) => remote(`/rest/v1/rpc/${name}`, body);
    if (target.pathname === '/api/access/apply' && request.method === 'POST') {
      const parsed = application.safeParse(await readBody(request));
      if (!parsed.success) throw new AccessError(400, 'Enter a valid email and a short description of what you want to build.');
      if (parsed.data.website) return reply({ ok: true });
      // Only use the edge-overwritten Vercel header. Raw forwarded headers can be spoofed.
      const source = request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'local';
      const fingerprint = createHmac('sha256', config.serviceKey).update(source).digest('hex');
      const result = await rpc('zils_access_apply', { p_email: parsed.data.email, p_use_case: parsed.data.useCase, p_source: fingerprint });
      if (result === 'limited') throw new AccessError(429, 'Too many requests. Please try again in an hour.');
      if (result !== 'accepted') throw unavailable();
      return reply({ ok: true });
    }
    const token = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('authorization') || '')?.[1];
    if (!token) throw new AccessError(401, 'Sign in to continue.');
    const verified = await send(`${base}/auth/v1/user`, { headers: { ...headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store' });
    if ([401, 403].includes(verified.status)) throw new AccessError(401, 'Your session expired. Sign in again.');
    if (!verified.ok) throw unavailable();
    const parsedUser = userSchema.safeParse(await verified.json());
    if (!parsedUser.success || parsedUser.data.is_anonymous || !parsedUser.data.email_confirmed_at) throw new AccessError(403, 'Sign in with a verified email address.');
    const user = parsedUser.data;
    if (target.pathname === '/api/access/session' && request.method === 'POST') {
      return reply(await rpc('zils_access_claim', { p_owner: user.id }));
    }
    const admins = (config.adminEmails || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(user.email.toLowerCase())) throw new AccessError(403, 'This page is only available to Zils administrators.');
    if (target.pathname === '/api/admin/access' && request.method === 'GET') {
      const status = z.enum(['all', 'waiting', 'invited', 'active', 'paused', 'expired']).safeParse(target.searchParams.get('status') || 'all');
      const offset = z.coerce.number().int().min(0).max(1_000_000_000).safeParse(target.searchParams.get('offset') || 0);
      if (!status.success || !offset.success) throw new AccessError(400, 'Choose a valid list filter.');
      return reply(await rpc('zils_access_overview', { p_status: status.data, p_offset: offset.data }));
    }
    if (target.pathname === '/api/admin/access/invite' && request.method === 'POST') {
      const parsed = invite.safeParse(await readBody(request));
      if (!parsed.success) throw new AccessError(400, 'Enter a valid email and action.');
      const { email: recipient, action } = parsed.data;
      let site: URL | undefined;
      try { site = new URL(config.siteUrl || ''); } catch { /* Fail before reserving capacity. */ }
      if (action !== 'pause' && (!config.mailKey || !email.safeParse(config.mailFrom).success || !site || (site.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(site.hostname)))) throw new AccessError(503, 'Invitation email is not configured yet. No new spot was reserved.');
      const result = await rpc('zils_access_invite', { p_email: recipient, p_action: action, p_actor: user.id });
      if (result.status === 'full') throw new AccessError(409, 'All spots are allocated. Pause an account or wait for an invitation to expire.');
      if (result.status === 'wait') throw new AccessError(429, 'Wait one minute before resending this invitation.');
      if (result.status === 'not_found') throw new AccessError(404, 'Application not found.');
      if (result.status !== 'ok') throw unavailable();
      if (!result.send) return reply({ ok: true, delivery: 'unchanged', message: action === 'pause' ? 'Access paused. The spot is available again.' : 'This account already has access or an outstanding invitation.' });
      let delivered = false;
      try {
        const link = await remote(`/auth/v1/admin/generate_link?redirect_to=${encodeURIComponent(`${site!.origin}/train`)}`, { type: 'magiclink', email: recipient });
        const actionLink = new URL(link.action_link);
        if (actionLink.origin !== base || actionLink.pathname !== '/auth/v1/verify') throw unavailable();
        const mail = await send('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${config.mailKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `access/${result.application.id}/${result.application.invitation_version}` },
          body: JSON.stringify({ from: `Zils <${config.mailFrom}>`, to: [recipient], subject: 'You’re invited to Zils early access', text: `Your Zils early-access spot is ready.\n\nOpen your workspace:\n${actionLink.href}\n\nYour spot is reserved for seven days. If this sign-in link expires, request a new one at ${site!.origin}/train using this email address.\n\nYou can use multiple Zils for different decisions in your app. We’ll confirm training and usage allowances separately; this invitation does not include unlimited usage.\n\nThe Zils team` }),
          signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store',
        });
        delivered = mail.ok && typeof (await mail.json()).id === 'string';
      } catch { /* The reservation survives, so the administrator can resend. */ }
      const delivery = delivered ? 'sent' : 'failed';
      try {
        await remote(`/rest/v1/zils_access_applications?id=eq.${encodeURIComponent(result.application.id)}&invitation_version=eq.${encodeURIComponent(result.application.invitation_version)}`, { delivery_status: delivery }, 'PATCH');
      } catch { /* A pending record remains visible if delivery bookkeeping fails. */ }
      return reply({ ok: true, delivery, message: delivered ? 'Invitation sent. One spot is reserved for seven days.' : 'The spot is reserved, but email delivery was not confirmed. Use Resend invite to try again.' });
    }
    throw new AccessError(404, 'Page not found.');
  } catch (error) {
    const safe = error instanceof AccessError ? error : unavailable();
    return reply({ error: safe.message }, safe.status);
  }
}
