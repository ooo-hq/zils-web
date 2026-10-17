import type { Page } from '@playwright/test';

/** Seeds a stored Supabase session and answers the auth and service calls the console makes. */
export async function signIn(page: Page) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  for (const origin of ['http://127.0.0.1:8998', 'http://127.0.0.1:8999']) await page.route(`${origin}/**`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (new URL(route.request().url()).pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    return route.fulfill({ status: 404, json: { error: 'Not part of this test' }, headers });
  });
}
