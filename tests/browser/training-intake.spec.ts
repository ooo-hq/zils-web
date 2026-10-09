import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';

const example = readFileSync('public/training/support-routing-example.csv', 'utf8');
const jobId = '10000000-0000-4000-8000-000000000001';

// All service requests are intercepted. These tests never send customer data or
// start a job on a real coordinator, even when a developer has local env files.
async function workspace(page: Page) {
  const uploads: Record<string, string> = {};
  const mutations: string[] = [];
  const user = { id: '10000000-0000-4000-8000-000000000002', email: 'client@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.browser-test`;
  await page.addInitScript(({ user, token, expires }) => {
    localStorage.setItem('zils-training-auth', JSON.stringify({ user, access_token: token, refresh_token: 'browser-test', token_type: 'bearer', expires_in: 3600, expires_at: expires }));
  }, { user, token, expires });
  let job: { id: string; name: string; status: string } | undefined;
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:3107') return route.continue();
    if (!['http://127.0.0.1:8998', 'http://127.0.0.1:8999'].includes(url.origin)) return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user, headers });
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${url.pathname}`);
    if (request.method() === 'PUT' && url.pathname.startsWith('/storage/v1/object/')) {
      uploads[url.pathname.split('/').at(-1)!.replace(/\.jsonl$/, '')] = request.postDataBuffer()!.toString('utf8');
      return route.fulfill({ json: {}, headers });
    }
    if (url.pathname === '/v1/jobs' && request.method() === 'GET') return route.fulfill({ json: { jobs: job ? [job] : [] }, headers });
    if (url.pathname === '/v1/jobs' && request.method() === 'POST') {
      job = { id: jobId, name: request.postDataJSON().name, status: 'uploading' };
      const slots = Object.fromEntries(['train', 'calibration', 'test'].map(split => [split, { url: `http://127.0.0.1:8998/storage/v1/object/upload/sign/fez-training-data/${jobId}/inputs/${split}.jsonl?token=test-upload`, method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' } }]));
      return route.fulfill({ json: { job, uploads: slots }, headers });
    }
    if (url.pathname === `/v1/jobs/${jobId}/submit` && job) {
      job.status = 'validating';
      return route.fulfill({ json: { job }, headers });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected test request' }, headers });
  });
  await page.goto('/train');
  await page.getByRole('button', { name: 'Train a model', exact: true }).click();
  await page.getByLabel('The decision', { exact: true }).fill('Which team should handle this support ticket?');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  return { uploads, mutations };
}

function workbook(rows: string[][]) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sheet = (data: string[][]) => strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
  return Buffer.from(zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    'xl/workbook.xml': strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Examples" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/><Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>'),
    'xl/worksheets/sheet1.xml': sheet([['Instructions']]),
    'xl/worksheets/sheet2.xml': sheet(rows),
  }));
}

test('Excel import, corrections and exclusions reach the existing submission contract', async ({ page }) => {
  const { uploads, mutations } = await workspace(page);
  const rows = [['Ticket ID', 'Message', 'Correct Answer', 'Customer Email'], ...Array.from({ length: 18 }, (_, index) => [`case-${index}`, `Help with request ${index}`, ['Billing', 'Technical support', 'Account changes'][index % 3], 'private@example.com'])];
  rows[1][2] = '';
  rows.push([...rows[2]]);
  await page.getByLabel('Drop your spreadsheet here or choose a file').setInputFiles({ name: 'tickets.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook(rows) });
  await expect(page.getByText('19 examples found')).toBeVisible();
  await expect(page.getByLabel('Choose the sheet with your examples')).toHaveValue('1');
  await page.getByLabel('Choose the sheet with your examples').selectOption('0');
  await expect(page.getByRole('alert')).toContainText('header');
  await page.getByLabel('Choose the sheet with your examples').selectOption('1');
  await expect(page.getByLabel('Use this reference to identify each case')).toHaveValue('Ticket ID');
  await page.getByRole('button', { name: 'Review examples', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check readiness' })).toBeDisabled();
  await page.getByLabel('Examples to review').selectOption('issues');
  await expect(page.getByText(/Spreadsheet row 2$/)).toBeVisible();
  await page.getByLabel('Correct answer', { exact: true }).selectOption('Billing');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Spreadsheet row 20$/)).toBeVisible();
  await page.getByRole('button', { name: 'Leave out of this run' }).click();
  await expect(page.getByText('No examples need attention.', { exact: false })).toBeVisible();
  await page.getByLabel('Examples to review').selectOption('sample');
  await page.getByRole('heading', { name: 'Check what your model will learn.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.private/onboarding-review-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Check readiness' }).click();
  await expect(page.getByRole('heading', { name: 'Your data is ready for an experiment.' })).toBeVisible();
  await expect(page.getByText('18 examples from 18 separate cases.')).toBeVisible();
  expect(mutations).toEqual([]);
  await page.getByLabel('Run name', { exact: true }).fill('reviewed-client-run');
  await page.getByLabel('I checked the answers', { exact: false }).check();
  await page.getByLabel('I am authorized', { exact: false }).check();
  await page.getByRole('button', { name: 'Send for training', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(Object.keys(uploads).sort()).toEqual(['calibration', 'test', 'train']);
  const examples = Object.values(uploads).flatMap(text => text.trim().split('\n').map(line => JSON.parse(line)));
  expect(examples).toHaveLength(18);
  expect(examples.every(row => row.family === 'reviewed-client-run')).toBe(true);
  expect(examples.every(row => Object.keys(row.state.information).join() === 'Message')).toBe(true);
  expect(JSON.stringify(examples)).not.toContain('private@example.com');
  const corrected = examples.find(row => row.state.information.Message === 'Help with request 0');
  expect(corrected.question.criteria[corrected.label]).toBe('Billing');
  expect(mutations).toHaveLength(5);
});

test('mobile CSV review preserves the draft and requires resolving expert flags', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  const { mutations } = await workspace(page);
  const background = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', background);
  await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'dark');
  const input = page.getByLabel('Drop your spreadsheet here or choose a file');
  await input.setInputFiles({ name: 'old.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('old') });
  await expect(page.getByRole('alert')).toContainText('.xlsx');
  await input.setInputFiles({ name: 'examples.csv', mimeType: 'text/csv', buffer: Buffer.from(example) });
  await expect(page.getByText('18 examples found')).toBeVisible();
  await page.getByRole('button', { name: 'Review examples', exact: true }).click();
  await page.getByRole('button', { name: 'Needs an expert' }).click();
  await expect(page.getByRole('button', { name: 'Check readiness' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Train a model', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check what your model will learn.' })).toBeVisible();
  await page.getByLabel('Examples to review').selectOption('issues');
  await page.getByRole('button', { name: 'Confirm answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check readiness' })).toBeEnabled();
  await page.getByLabel('Examples to review').selectOption('all');
  await page.getByRole('button', { name: 'Leave out of this run' }).click();
  await expect(page.getByRole('button', { name: 'Include again' })).toBeVisible();
  await page.getByRole('button', { name: 'Include again' }).click();
  await page.getByRole('heading', { name: 'Check what your model will learn.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.private/onboarding-review-mobile.png', fullPage: true });
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Check readiness' }).click();
  await expect(page.getByText('18 examples from 18 separate cases.')).toBeVisible();
  expect(mutations).toEqual([]);
});
