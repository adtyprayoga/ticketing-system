import { expect, test } from '@playwright/test';

test('a held place is released once the payment window has closed', async ({ page }) => {
  await page.goto('/sign-in?next=/events/jakarta-night-run-2026');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('button', { name: 'Buy a place' }).click();
  await page.getByLabel('Participant name').fill('Expiry Participant');
  await page.getByRole('button', { name: 'Go to payment' }).click();
  await expect(page.getByText('Payment simulator')).toBeVisible();
  const orderId = new URL(page.url()).pathname.split('/').pop();

  await page.getByRole('button', { name: 'Advance clock 11 minutes' }).click();
  await expect(page.getByText('Done.')).toBeVisible();
  // Returning makes the API ask the provider, which now reports the payment as expired.
  await page.goto(`/orders/${orderId}/return`);
  await expect(page.getByText('Expired — the place was released')).toBeVisible();
});
