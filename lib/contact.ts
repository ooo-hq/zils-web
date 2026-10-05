import { createHash } from 'node:crypto';
import { z } from 'zod';

const contact = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254).pipe(z.email({ pattern: z.regexes.html5Email })),
  company: z.string().trim().max(160).default(''),
  message: z.string().trim().min(1).max(3000),
  website: z.string().max(500).default(''),
  requestId: z.string().uuid(),
});
type DeliveryConfig = { apiKey?: string; from?: string; to?: string };
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const unavailable = () => reply({ error: 'Your message could not be sent. Your details are still here; please try again in a moment.' }, 503);

/** Fixed-recipient contact delivery. No submitted content is logged or stored locally. */
export async function handleContactRequest(request: Request, config: DeliveryConfig, send: typeof fetch = fetch): Promise<Response> {
  const host = request.headers.get('host') || new URL(request.url).host;
  const origin = request.headers.get('origin');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
  if (origin !== `https://${host}` && !(local && origin === `http://${host}`)) {
    return reply({ error: 'Open the contact page on this website to send a message.' }, 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply({ error: 'Use the contact form to send your message.' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Enter your contact details and a message.' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24_576) { await reader.cancel(); return reply({ error: 'Please keep your message to 3,000 characters.' }, 413); }
      chunks.push(value);
    }
  } catch { return reply({ error: 'Your message could not be read. Please try again.' }, 400); }
  finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return reply({ error: 'Enter your contact details and a message.' }, 400); }
  const parsed = contact.safeParse(body);
  if (!parsed.success) return reply({ error: 'Check your name, email, and message. Keep your message to 3,000 characters.' }, 400);
  const { name, email, company, message, website, requestId } = parsed.data;
  if (website) return reply({ ok: true });
  if (!config.apiKey?.trim() || !z.email().safeParse(config.from).success || !z.email().safeParse(config.to).success) return unavailable();
  const payload = {
    from: `Zils <${config.from}>`, to: [config.to], reply_to: email,
    subject: 'New message from the Zils contact form',
    text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'Not provided'}\n\n${message}`,
  };
  // Reuse the provider key after a lost response; edits produce a different key.
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `contact/${requestId}/${digest}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000), redirect: 'error', cache: 'no-store',
    });
    if (response.ok && z.object({ id: z.string().min(1) }).safeParse(await response.json()).success) return reply({ ok: true });
  } catch { /* Do not expose submitted content, credentials, or provider errors. */ }
  return unavailable();
}
