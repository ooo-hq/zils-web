import { test, expect } from '@playwright/test';

const tiles = [
  { hash: 'doom', tile: /Survive Doom/, heading: 'Zils reaches the armor. JEV dies in the doorway.' },
  { hash: 'content', tile: /Review a post/, heading: 'Should this creator post be approved?' },
  { hash: 'chess', tile: /Find the mate/, heading: /to move\. Which check is mate\?/ },
  { hash: 'inbox', tile: /Sort an inbox/, heading: 'What does each reply want?' },
  { hash: 'oro', tile: /Referee a shopping AI/, heading: 'Did the assistant actually ask?' },
];

for (const { hash, tile, heading } of tiles) {
  test(`#${hash} selects its tile and demo`, async ({ page }) => {
    await page.goto(`/examples#${hash}`);
    await expect(page.getByRole('button', { name: tile })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  });
}

test('clicking a tile updates the hash; unknown hashes fall back to Doom', async ({ page }) => {
  await page.goto('/examples#inbox');
  await page.getByRole('button', { name: /Referee a shopping AI/ }).click();
  await expect(page).toHaveURL(/#oro$/);
  await page.goto('/examples#nonsense');
  await expect(page.getByRole('button', { name: /Survive Doom/ })).toHaveAttribute('aria-pressed', 'true');
});
