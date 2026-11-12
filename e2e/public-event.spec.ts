import { expect, test } from '@playwright/test';

test('a visitor finds the published event and sees its ticket categories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Jakarta Night Run 2026' }).click();
  await expect(page.getByRole('heading', { name: 'Jakarta Night Run 2026' })).toBeVisible();
  await expect(page.getByText('Sun, 6 Dec 2026, 19:00 WIB · Gelora Bung Karno')).toBeVisible();
  const category = page.getByTestId('category').filter({ hasText: '12K' });
  await expect(category).toContainText('150.000');
  await expect(category).toContainText('places available');
});
