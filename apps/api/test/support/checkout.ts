import { randomUUID } from 'node:crypto';
import type { Agent } from 'supertest';

export function checkout(
  buyer: Agent,
  categoryId: string,
  overrides: { attemptKey?: string; participantName?: string } = {},
) {
  return buyer.post('/api/checkout').send({
    categoryId,
    participantName: overrides.participantName ?? 'Putri Participant',
    attemptKey: overrides.attemptKey ?? randomUUID(),
  });
}
