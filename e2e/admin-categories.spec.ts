import { expect, test } from '@playwright/test';

test('an admin adds, edits, closes and deletes a ticket category', async ({ page }) => {
  await page.goto('/sign-in?next=/admin/events/new');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByLabel('Name').fill('Category Run');
  await page.getByLabel('Slug').fill(`category-run-${Date.now()}`);
  await page.getByLabel('Starts at (WIB)').fill('2026-12-13T06:00');
  await page.getByLabel('Venue').fill('Monas');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByRole('heading', { name: 'Ticket categories' })).toBeVisible();

  await page.getByLabel('Category name').fill('12K');
  await page.getByLabel('Price (Rp)').fill('150000');
  await page.getByLabel('Capacity').fill('3');
  await page.getByRole('button', { name: 'Add category' }).click();
  const row = page.getByTestId('admin-category').filter({ hasText: '12K' });
  await expect(row).toContainText('0 of 3 places held or sold');
  await expect(row).toContainText('150.000');

  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Capacity').first().fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Capacity must be at least 1')).toBeVisible();
  await page.getByLabel('Capacity').first().fill('5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(row).toContainText('0 of 5 places held or sold');

  await row.getByRole('button', { name: 'Close sales' }).click();
  await expect(row).toContainText('Sales closed');

  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No ticket categories yet.')).toBeVisible();
});
