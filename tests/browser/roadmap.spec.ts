import { test, expect, type Page } from '@playwright/test';

async function roadmap(page: Page, signedIn: boolean) {
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  if (signedIn) await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  const writes: string[] = [];
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS' };
  await page.route('http://127.0.0.1:8998/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (url.pathname === '/rest/v1/rpc/zils_feature_vote_counts') return route.fulfill({ headers, json: [{ feature: 'points', votes: 5 }, { feature: 'count', votes: 2 }] });
    if (url.pathname === '/rest/v1/zils_feature_votes') {
      if (request.method() === 'GET') return route.fulfill({ headers, json: [] });
      writes.push(`${request.method()} ${request.method() === 'POST' ? request.postData() : url.searchParams.get('feature')}`);
      return route.fulfill({ status: request.method() === 'POST' ? 201 : 204, headers });
    }
    return route.fulfill({ status: 404, json: { error: 'Not part of this test' }, headers });
  });
  await page.goto('/roadmap');
  return writes;
}

test('signed-out visitors see ranked totals and a sign-in link', async ({ page }) => {
  await roadmap(page, false);
  const names = page.getByRole('listitem').getByRole('heading', { level: 3 });
  await expect(names.first()).toHaveText('Points');
  await expect(names.nth(1)).toHaveText('Count');
  await expect(page.getByRole('link', { name: 'Sign in to vote for Points, 5 votes' })).toHaveAttribute('href', '/sign-in');
});

test('signed-in users cast and take back a vote', async ({ page }) => {
  const writes = await roadmap(page, true);
  await page.getByRole('button', { name: 'Vote for Count, 2 votes' }).click();
  const undo = page.getByRole('button', { name: 'Remove your vote for Count, 3 votes' });
  await expect(undo).toHaveAttribute('aria-pressed', 'true');
  await undo.click();
  await expect(page.getByRole('button', { name: 'Vote for Count, 2 votes' })).toHaveAttribute('aria-pressed', 'false');
  expect(writes).toEqual(['POST {"feature":"count"}', 'DELETE eq.count']);
});
