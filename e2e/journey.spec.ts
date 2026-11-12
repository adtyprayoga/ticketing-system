import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../playwright.config.ts';

async function signIn(page: Page, email: string, next = '/') {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`${email} ·`)).toBeVisible();
}

test('the whole journey: admin sets up a race, a buyer pays, staff check the participant in', async ({
  browser,
}) => {
  const slug = `journey-run-${Date.now()}`;
  const buyerEmail = `journey-${Date.now()}@example.com`;

  // 1. An admin creates and publishes an event with a ticket category.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, 'admin@example.com', '/admin/events/new');
  await admin.getByLabel('Name').fill('Journey Night Run');
  await admin.getByLabel('Slug').fill(slug);
  await admin.getByLabel('Starts at (WIB)').fill('2026-12-20T19:00');
  await admin.getByLabel('Venue').fill('Gelora Bung Karno');
  await admin.getByRole('button', { name: 'Create event' }).click();
  await admin.getByLabel('Category name').fill('12K');
  await admin.getByLabel('Price (Rp)').fill('150000');
  await admin.getByLabel('Capacity').fill('2');
  await admin.getByRole('button', { name: 'Add category' }).click();
  await expect(admin.getByTestId('admin-category')).toContainText('0 of 2 places');
  await admin.getByRole('link', { name: '← All events' }).click();
  const row = admin.getByTestId('admin-event').filter({ hasText: 'Journey Night Run' });
  await row.getByRole('button', { name: 'Publish' }).click();
  await expect(row).toContainText('Published');

  // The trainer assigns two staff members to the new event (assignments have no UI).
  for (const email of ['staff1@example.com', 'staff2@example.com']) {
    execSync(`npm run staff:assign -w apps/api -- --event ${slug} --email ${email}`, {
      env: { ...process.env, ...e2eEnv },
      stdio: 'pipe',
    });
  }

  // 2. A buyer signs up, buys a place for a participant, pays, and sees the ticket.
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto('/sign-up');
  await buyer.getByLabel('Name').fill('Journey Buyer');
  await buyer.getByLabel('Email').fill(buyerEmail);
  await buyer.getByLabel('Password').fill('workshop-password');
  await buyer.getByRole('button', { name: 'Sign up' }).click();
  await expect(buyer.getByText(`${buyerEmail} · buyer`)).toBeVisible();
  await buyer.goto('/');
  await buyer.getByRole('link', { name: 'Journey Night Run' }).click();
  await expect(buyer.getByTestId('category')).toContainText('2 of 2 places available');
  await buyer.getByRole('button', { name: 'Buy a place' }).click();
  await buyer.getByLabel('Participant name').fill('Dimas Participant');
  await buyer.getByRole('button', { name: 'Go to payment' }).click();
  await buyer.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(buyer.getByRole('heading', { name: 'Payment received' })).toBeVisible();
  await buyer.getByRole('link', { name: 'See the ticket' }).click();
  const ticket = buyer.getByTestId('ticket').filter({ hasText: 'Dimas Participant' });
  await expect(ticket.getByRole('img', { name: /QR code/ })).toBeVisible();
  const code = (await ticket.getByTestId('lookup-code').textContent())!.trim();

  // 3. Two staff members look the ticket up; one admits the participant, the other is told.
  const staff1 = await (await browser.newContext()).newPage();
  const staff2 = await (await browser.newContext()).newPage();
  for (const [page, email] of [
    [staff1, 'staff1@example.com'],
    [staff2, 'staff2@example.com'],
  ] as const) {
    await signIn(page, email, '/staff');
    await page.getByRole('link', { name: 'Journey Night Run' }).click();
    await page.getByLabel('Ticket code').fill(code.toLowerCase());
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page.getByTestId('lookup')).toContainText('Dimas Participant');
    await expect(page.getByTestId('lookup')).toContainText('Not checked in');
  }
  await staff1.getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(staff1.getByText('Checked in. Welcome them in!')).toBeVisible();
  await staff2.getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(staff2.getByText(/Already checked in by Sari Staff/)).toBeVisible();

  // The buyer's ticket now shows the check-in.
  await buyer.reload();
  await expect(ticket).toContainText('Checked in');
});
