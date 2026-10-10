import { z } from 'zod';

export const CLI_CALLBACK = 'http://127.0.0.1:43187/callback';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isOAuthClientId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
// Supabase's public authorization ID is distinct from its internal UUID.
export const isAuthorizationId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9]{32}$/.test(value);

export function authorizationReturnUrl(origin: string, authorizationId: string): string {
  if (!isAuthorizationId(authorizationId)) throw new Error('Invalid CLI authorization request.');
  return new URL(`/cli/authorize?authorization_id=${authorizationId}`, origin).href;
}

export function cliCallbackUrl(value: string): string {
  if (typeof value !== 'string' || value.length > 8192 || !value.startsWith(CLI_CALLBACK + '?') || /[\x00-\x20\x7f\\#]|%(?![0-9a-fA-F]{2})/.test(value)) throw new Error('Invalid CLI callback.');
  const url = new URL(value);
  const pairs = [...url.searchParams];
  const keys = pairs.map(([key]) => key);
  if (new Set(keys).size !== keys.length || keys.some(key => !['code', 'state', 'error', 'error_description'].includes(key)) || !url.searchParams.get('state') || Boolean(url.searchParams.get('code')) === Boolean(url.searchParams.get('error'))) throw new Error('Invalid CLI callback.');
  return value;
}

const detailsSchema = z.object({
  authorization_id: z.string(), redirect_uri: z.literal(CLI_CALLBACK),
  client: z.object({ id: z.string() }), user: z.object({ id: z.string(), email: z.string().max(320) }),
  scope: z.literal('email'),
});

export function authorizationDetails(value: unknown, clientId: string, requestId: string, userId: string) {
  const details = detailsSchema.parse(value);
  if (!isOAuthClientId(clientId) || !isAuthorizationId(requestId) || details.client.id !== clientId || details.authorization_id !== requestId || details.user.id !== userId) throw new Error('This request is not for the Zils CLI and signed-in account.');
  return details;
}
