import { expect, test } from '@playwright/test';

test('a buyer holds a place, continues from My orders, and pays in the simulator', async ({
  page,
}) => {
  await page.goto('/sign-in?next=/events/jakarta-night-run-2026');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Password').fill('workshop-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('button', { name: 'Buy a place' }).click();
  await page.getByRole('button', { name: 'Go to payment' }).click();
  await expect(page.getByText("Enter the participant's name")).toBeVisible();
  await page.getByLabel('Participant name').fill('Putri Participant');
  await page.getByRole('button', { name: 'Go to payment' }).click();
  await expect(page.getByText('Payment simulator')).toBeVisible();

  await page.getByRole('link', { name: 'Back to my orders' }).click();
  const order = page.getByTestId('order').filter({ hasText: 'Putri Participant' });
  await expect(order).toContainText('Waiting for payment');
  await expect(order).toContainText('left to pay');
  await order.getByRole('button', { name: 'Continue payment' }).click();

  await expect(page.getByRole('heading', { name: 'Pay Rp' })).toBeVisible();
  await page.getByRole('button', { name: 'Send notification twice' }).click();
  await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible();
  await expect(page.getByText('Paid')).toBeVisible();

  await page.getByRole('link', { name: 'See the ticket' }).click();
  const ticket = page.getByTestId('ticket').filter({ hasText: 'Putri Participant' });
  await expect(ticket).toHaveCount(1);
  await expect(ticket.getByRole('img', { name: /QR code for ticket/ })).toBeVisible();
  await expect(ticket.getByTestId('lookup-code')).toHaveText(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  await expect(ticket).toContainText('Not checked in yet');
});
