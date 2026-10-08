import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.private/browser-results',
  fullyParallel: true,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:3107', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI
      ? 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3107'
      : 'npm run dev -- --hostname 127.0.0.1 --port 3107',
    url: 'http://127.0.0.1:3107/train',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ZILS_SETUP_API_URL: 'http://127.0.0.1:8997/v1/chat/completions',
      ZILS_SETUP_API_KEY: 'browser-test-only',
      ZILS_SETUP_MODEL: 'browser-test-model',
      ZILS_DECISION_API_URL: 'http://127.0.0.1:8997/v1/systemone',
      ZILS_DECISION_API_KEY: 'browser-test-only',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:8998',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-browser-test-key',
      NEXT_PUBLIC_ZILS_GOOGLE_AUTH_ENABLED: 'true',
      NEXT_PUBLIC_ZILS_TRAINING_API_URL: 'http://127.0.0.1:8999',
      NEXT_PUBLIC_ZILS_API_URL: 'http://127.0.0.1:8999',
      NEXT_PUBLIC_ZILS_BILLING_PREVIEW: 'test',
    },
  },
});
