const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { signInWithGoogle } = require('../.private/test-build/training-auth.js');

for (const origin of ['https://zils.ai', 'https://preview.example', 'http://127.0.0.1:3112']) {
  test(`Google sign-in returns to the deployment that started it: ${origin}`, async () => {
    const client = createClient('https://project.example', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const result = await signInWithGoogle(client, origin);
    assert.equal(result.error, null);
    const url = new URL(result.data.url);
    assert.equal(url.origin, 'https://project.example');
    assert.equal(url.pathname, '/auth/v1/authorize');
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('redirect_to'), `${origin}/train`);
    assert.equal(url.searchParams.has('access_type'), false);
    assert.equal(url.searchParams.has('scopes'), false);
  });
}
