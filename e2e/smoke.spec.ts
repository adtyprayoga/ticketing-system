import { expect, test } from '@playwright/test';

test('home page shows api health through the rewrite', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Database: up')).toBeVisible();
  await expect(page.getByText('Redis: up')).toBeVisible();
});
