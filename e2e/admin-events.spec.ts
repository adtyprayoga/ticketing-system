import { expect, test, type Page } from '@playwright/test';

async function signInAsAdmin(page: Page) {
  await page.goto('/sign-in?next=/admin/events');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
}

test('an admin creates, publishes and deletes an event', async ({ page }) => {
  const slug = `e2e-run-${Date.now()}`;
  await signInAsAdmin(page);
  await page.getByRole('link', { name: 'New event' }).click();
  await page.getByLabel('Name').fill('E2E Night Run');
  await page.getByLabel('Slug').fill(slug);
  await page.getByLabel('Starts at (WIB)').fill('2026-12-06T19:00');
  await page.getByLabel('Venue').fill('Gelora Bung Karno');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Night Run' })).toBeVisible();

  await page.getByRole('link', { name: '← All events' }).click();
  const row = page.getByTestId('admin-event').filter({ hasText: 'E2E Night Run' });
  await expect(row).toContainText('Sun, 6 Dec 2026, 19:00 WIB');
  await expect(row).toContainText('Draft');
  await row.getByRole('button', { name: 'Publish' }).click();
  await expect(row).toContainText('Published');

  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
});

test('an invalid slug shows a message under the field', async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole('link', { name: 'New event' }).click();
  await page.getByLabel('Name').fill('Bad Slug Run');
  await page.getByLabel('Slug').fill('Bad Slug');
  await page.getByLabel('Starts at (WIB)').fill('2026-12-06T19:00');
  await page.getByLabel('Venue').fill('Monas');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByText('Use lowercase letters, numbers and single hyphens')).toBeVisible();
});
