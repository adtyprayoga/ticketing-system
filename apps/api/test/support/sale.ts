import type { Agent } from 'supertest';
import type { TestApp } from './app.ts';
import { agentWithRole } from './auth.ts';
import { createCategory, createEvent } from './catalog.ts';
import { checkout } from './checkout.ts';

/** A published event with one ticket category, an admin, and a buyer. */
export async function onSale(t: TestApp, capacity = 3, price = 150000) {
  const admin = await agentWithRole(t, 'admin');
  const buyer = await agentWithRole(t, 'buyer');
  const event = await createEvent(admin, { name: 'Pay Run' }, true);
  const category = await createCategory(admin, event.id, { name: '12K', price, capacity });
  return { admin, buyer, event, category };
}

export async function pendingOrder(buyer: Agent, categoryId: string, participantName?: string) {
  const res = await checkout(buyer, categoryId, { participantName });
  if (res.status !== 201) throw new Error(`checkout failed: ${res.status} ${res.text}`);
  return res.body as {
    id: string;
    status: string;
    amount: number;
    createdAt: string;
    payment: { redirectUrl: string } | null;
  };
}
