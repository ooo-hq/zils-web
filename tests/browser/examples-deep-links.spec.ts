import { test, expect } from '@playwright/test';

test('examples hash opens the matching demo and tabs update the hash', async ({ page }) => {
  await page.goto('/examples#inbox');
  await expect(page.getByRole('button', { name: /Sort an inbox/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Leadpoet · sales replies')).toBeVisible();
  await page.getByRole('button', { name: /Referee a shopping AI/ }).click();
  await expect(page).toHaveURL(/#oro$/);
  await page.goto('/examples#nonsense');
  await expect(page.getByRole('button', { name: /Survive Doom/ })).toHaveAttribute('aria-pressed', 'true');
});
