import { expect, test } from '@playwright/test';

const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test('a buyer signs up, sees their email, and signs out', async ({ page }) => {
  const email = unique();
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill('Eka Buyer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText(`${email} · buyer`)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('a duplicate email shows a message under the email field', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill('Bima Again');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('An account with this email already exists')).toBeVisible();
});

test('a seeded admin signs in with any letter case', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(' Admin@Example.com ');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('admin@example.com · admin')).toBeVisible();
});
