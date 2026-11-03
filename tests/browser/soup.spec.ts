import { expect, test } from '@playwright/test';

test('/soup explains the greedy soup: seats, crown, house rules and the measured result', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', e => errors.push(e));
  await page.goto('/soup');
  await expect(page).toHaveTitle('Greedy soup — how z3 is made');
  await expect(page.getByRole('heading', { name: 'Greedy soup.', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /bowl of soup/i })).toBeVisible();

  const steps = page.getByRole('list', { name: 'How a soup is made' }).getByRole('listitem');
  await expect(steps).toHaveCount(5);
  await expect(steps.nth(2)).toContainText('only if the soup scores at least 0.5 points higher');

  const bill = page.getByRole('table', { name: 'Who gets paid' });
  await expect(bill.getByRole('row', { name: /Soup seats/ })).toContainText('5 × 16%');
  await expect(bill.getByRole('row', { name: /Soup seats/ })).not.toContainText('Split equally');
  await expect(bill.getByRole('row', { name: /Solo crown/ })).toContainText('20%');
  for (const [who, rate] of [['Trainer', '1×'], ['Scout', '0.25×'], ['House model', '0']]) {
    await expect(page.getByRole('table', { name: 'Seat rates' }).getByRole('row', { name: new RegExp(who) })).toContainText(rate);
  }

  await expect(page.locator('main code', { hasText: 'Qwen/Qwen3.5-4B' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the miner guide' })).toHaveAttribute('href', 'https://docs.zils.ai/operations/soup');
  await expect(page.locator('#start')).toContainText('zils-miner commit-body');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Soup' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('/miners and /z3 point to the soup', async ({ page }) => {
  await page.goto('/z3');
  await page.getByRole('link', { name: 'How the soup is made', exact: true }).click();
  await expect(page).toHaveURL('/soup');
  await page.goto('/miners');
  await expect(page.getByRole('link', { name: 'Bring a body to the soup', exact: true })).toHaveAttribute('href', '/soup');
});

// zils origin/main 16b87a6: zils/data/soup-house.json and docs/mining.md "Soup pool".
const HOUSE = [
  ['d3-mini', 'vllm-sr/d3-mini'],
  ['pplx-decider-flash-v1.2', 'perplexity-ai/pplx-decider-flash-v1.2'],
  ['torchcast-decision-4b', 'torchcast-ai/torchcast-decision-4b'],
  ['Matilda-Decision-v1-Mini', 'Maincode/Matilda-Decision-v1-Mini'],
  ['KnowLine-4B-Gen5', 'PelaAI/KnowLine-4B-Gen5'],
];

// zils main 0974870: zils/data/soup-house-{lite,flash,z3}.json and docs/mining.md "Four pools". No nano pool.
async function expectIngredients(page: import('@playwright/test').Page) {
  const built = page.getByRole('region', { name: 'What each soup is built from' });
  await expect(built.getByRole('button', { name: 'z3-mini' })).toHaveAttribute('aria-pressed', 'true');
  await expect(built.getByRole('link', { name: 'Qwen/Qwen3.5-4B' })).toHaveAttribute('href', /huggingface\.co\/Qwen\/Qwen3\.5-4B/);
  for (const [name, repo] of HOUSE) {
    await expect(built.getByRole('link', { name })).toHaveAttribute('href', new RegExp(`huggingface\\.co/${repo.replace('.', '\\.')}`));
  }
  await expect(built).toContainText('never paid');
  await built.getByRole('button', { name: 'z3-lite' }).click();
  await expect(built.getByRole('link', { name: 'Qwen/Qwen3.5-0.8B' })).toHaveAttribute('href', /huggingface\.co\/Qwen\/Qwen3\.5-0\.8B\/tree\/2fc06364715b967f1860aea9cf38778875588b17/);
  await expect(built.getByRole('link', { name: 'd3-lite' })).toHaveAttribute('href', /huggingface\.co\/vllm-sr\/d3-lite\/tree\/03560c26f5199c3c04129a2ccb38960c913635e0/);
  await expect(built.getByRole('link', { name: 'Intern-Decision-0.8B' })).toHaveAttribute('href', /huggingface\.co\/internlm\/Intern-Decision-0\.8B\/tree\/42457fafd13d10d0b0d9be46cb30a23caa409994/);
  await expect(built.getByRole('link', { name: 'KnowLine-4B-Gen5' })).toHaveCount(0);
  await expect(built.getByRole('button')).toHaveText(['z3-lite', 'z3-mini', 'z3-flash', 'z3']);
  await expect(built).not.toContainText(/nano/i);
  await built.getByRole('button', { name: 'z3-flash' }).click();
  await expect(built.getByRole('link', { name: 'Qwen/Qwen3.5-9B' })).toHaveAttribute('href', /Qwen3\.5-9B\/tree\/c202236235762e1c871ad0ccb60c8ee5ba337b9a/);
  await expect(built.getByRole('link', { name: 'd3-flash' })).toHaveAttribute('href', /vllm-sr\/d3-flash\/tree\/13dc1cc8ef23caefa765907e1d764751e5629f7d/);
  await expect(built).toContainText('Opens later');
  await built.getByRole('button', { name: 'z3', exact: true }).click();
  await expect(built.getByRole('link', { name: 'Qwen/Qwen3.8-27B' })).toHaveAttribute('href', /Qwen3\.8-27B\/tree\/1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0/);
  await expect(built.getByRole('link', { name: 'd3-ultra' })).toHaveAttribute('href', /vllm-sr\/d3-ultra\/tree\/52ba9e7a00402f9560c7fba8c039608e7ddee7fb/);
  await built.getByRole('button', { name: 'z3-mini' }).click();
  await expect(built).not.toContainText('Opens later');
}

test('/soup states the crown bar, house rates and house models without internal scores or dates', async ({ page }) => {
  await page.goto('/soup');
  const crown = page.getByRole('table', { name: 'Who gets paid' }).getByRole('row', { name: /Solo crown/ });
  await expect(crown).toContainText('beats every house model and the current soup by at least 1.2');
  const mix = page.getByRole('table', { name: 'Seat rates' }).getByRole('row', { name: /House mix/ });
  await expect(mix).toContainText('0.25×');
  await expect(mix).toContainText('the soup and the release');
  // zils#159/#163/#164: scouts re-upload models on the known-public list; mixes of listed models pay as scouts;
  // at launch a fine-tune's seat pays only if it beats what it started from.
  const rates = page.getByRole('table', { name: 'Seat rates' });
  await expect(rates.getByRole('row', { name: /Scout/ })).toContainText('known-public list');
  await expect(mix).toContainText('listed public models');
  await expect(rates.getByRole('row', { name: /Trainer/ })).toContainText('beat what they started from by at least 1.2');
  // Scouting is a role, not only a discount: any eligible open fine-tune can be committed by its finder,
  // and a find that is not on the list pays the trainer rate.
  await expect(rates.getByRole('row', { name: /Scout/ })).toContainText('not on the list');
  await expect(page.getByRole('region', { name: 'House rules' })).toContainText('whoever finds it first');
  await expect(page.locator('main')).not.toContainText('released after launch');
  // zils#150: seats and the crown are decided on the last 3 rounds' items together, not one fresh slice.
  const steps = page.getByRole('list', { name: 'How a soup is made' }).getByRole('listitem');
  await expect(steps.nth(1)).toContainText('last three rounds');
  await expect(steps.nth(1)).toContainText('Confidence counts'); // zils#162 calibrated_brier
  await expect(page.locator('main')).not.toContainText('fresh, seeded slice');
  // zils#152: fine-tunes of the soup and release are allowed; zils#153: four pools, flash and z3 open later.
  await expect(page.locator('main')).toContainText('the current soup');
  for (const parent of ['Qwen/Qwen3.5-0.8B', 'Qwen/Qwen3.5-4B', 'Qwen/Qwen3.5-9B', 'Qwen/Qwen3.8-27B']) await expect(page.locator('main code', { hasText: parent }).first()).toBeVisible();
  await expect(page.locator('main')).toContainText('Lite and mini cook from the launch; flash and z3 open later.');
  await expectIngredients(page);
  const text = await page.locator('main').innerText();
  for (const banned of ['+4.26', '+6.63', 'as of', '30 Oct', 'testnet', 'nano', 'Nano']) expect(text).not.toContain(banned);
});

test('soup pages name the miner command zils-miner (zils#171), never the customer CLI', async ({ page }) => {
  for (const path of ['/soup', '/miners']) {
    await page.goto(path);
    const codes = await page.locator('main code').allInnerTexts();
    for (const old of ['zils', 'zils setup', 'zils doctor', 'zils commit-body', 'zils commit-candidate']) expect(codes, `${path}: ${old}`).not.toContain(old);
  }
});

test('/miners: every tier is a soup, with its base and the house models in its pot', async ({ page }) => {
  await page.goto('/miners');
  const bases = { 'z3-lite': 'Qwen/Qwen3.5-0.8B', 'z3-mini': 'Qwen/Qwen3.5-4B', 'z3-flash': 'Qwen/Qwen3.5-9B', 'z3': 'Qwen/Qwen3.8-27B' };
  for (const [tier, repo] of Object.entries(bases)) {
    await expect(page.getByRole('article', { name: tier, exact: true }).getByRole('link', { name: repo })).toHaveAttribute('href', new RegExp(`huggingface\\.co/${repo.replace(/\./g, '\\.')}/tree/`));
  }
  // Tiers that have not cooked show their pot of house models (the miners spec's fake feed may be up, and cooks only mini).
  const lite = page.getByRole('article', { name: 'z3-lite' }).getByRole('list', { name: 'In the pot' });
  await expect(lite.getByRole('link', { name: 'Intern-Decision-0.8B' })).toHaveAttribute('href', /huggingface\.co\/internlm\/Intern-Decision-0\.8B\/tree\/42457fafd13d10d0b0d9be46cb30a23caa409994/);
  await expect(page.getByRole('article', { name: 'z3-flash' }).getByRole('link', { name: 'd3-flash' })).toHaveAttribute('href', /vllm-sr\/d3-flash\/tree\//);
  await expect(page.getByRole('article', { name: 'z3-flash' })).toContainText('Opens later');
  await expect(page.locator('main')).not.toContainText(/nano/i);
  const earn = page.getByRole('region', { name: 'How miners earn' });
  await expect(earn).toContainText('24 paid spots');
  await expect(earn).toContainText('zils-miner commit-body');
  for (const gone of ['40/10/16/4/30', 'kings', 'testnet', 'This validator allocates']) await expect(earn).not.toContainText(gone);
  await expect(page.locator('main')).not.toContainText('king of the hill');
  await expect(page.locator('main')).not.toContainText('status as of');
});

test('/z3 explains that a z3-mini release is a soup that passed the release gate', async ({ page }) => {
  await page.goto('/z3');
  const releases = page.getByRole('region', { name: 'Each new release earns its place.' });
  await expect(releases).toContainText('release gate');
  await expectIngredients(page);
  await expect(page.locator('main')).not.toContainText('testnet');
});

test('/z3 separates the nightly soup from the release window and records soup members', async ({ page }) => {
  await page.goto('/z3');
  await expect(page.getByText(/approved soups become new releases/)).toBeVisible();
  await expect(page.locator('main')).not.toContainText('king of the hill');
  await expect(page.locator('main')).not.toContainText('Other sizes');
  await expect(page.locator('main')).not.toContainText(/nano/i);
  expect(await page.locator('main [lang=ja]').count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByRole('link', { name: 'Start mining', exact: true })).toHaveAttribute('href', '/miners');
  const current = page.getByRole('region', { name: 'v1 today, a soup next.' });
  await expect(current).toContainText('current release');
  await expect(current).toContainText('one of the five house models');
  await expect(page.locator('main')).not.toContainText('A documented starting point');
  const steps = page.getByRole('region', { name: 'Each new release earns its place.' }).getByRole('list').first().getByRole('listitem');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(1)).toContainText('Every night');
  await expect(steps.nth(2)).toContainText('Every 14 to 28 days');
  await expect(steps.nth(3)).toContainText('member list');
  // A window is one night every interval_days (14 to 28, set per validator), so the band marks where the next one can fall.
  const cadence = page.getByRole('figure', { name: 'Release cadence' });
  const readout = cadence.getByRole('status');
  await expect(cadence).toContainText('Next release window falls on one of nights 14 to 28');
  await expect(cadence.getByRole('slider')).toHaveCount(0);
  await cadence.getByRole('button', { name: /^Night 9,/ }).hover();
  await expect(readout).toContainText('Night 9');
  await expect(readout).toContainText('The served model does not change');
  await cadence.getByRole('button', { name: /^Night 20,/ }).hover();
  await expect(readout).toContainText('the release window can fall');
  await cadence.getByRole('button', { name: /^Night 3,/ }).focus();
  await expect(readout).toContainText('Night 3');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('/miners leads with tonight’s soups, then the chain, then how to earn, and is honest about missing feeds', async ({ page }) => {
  await page.goto('/miners');
  await expect(page.locator('main')).not.toContainText('Proposed');
  const top = (name: string) => page.getByRole('region', { name, exact: true }).evaluate(e => e.getBoundingClientRect().top);
  const order = [await top('Tonight’s soup'), await top('Miners on chain'), await top('How miners earn')];
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  await expect(page.getByRole('link', { name: 'Soup guide', exact: true })).toHaveAttribute('href', 'https://docs.zils.ai/operations/soup');
});
