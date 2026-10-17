/** True when the request carries a Supabase access token for a signed-in user. */
export async function signedIn(request: Request, send: typeof fetch = fetch): Promise<boolean> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return false;
  try {
    const response = await send(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch { return false; }
}

export const signInRequired = (headers: HeadersInit = {}) => Response.json({ error: 'Your session has expired. Sign in again to continue.' }, { status: 401, headers });
