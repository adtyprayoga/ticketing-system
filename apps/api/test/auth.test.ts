import { afterAll, beforeAll, expect, test } from 'vitest';
import { freshTestApp, type TestApp } from './support/app.ts';
import { agent, PASSWORD, signIn, signUp, uniqueEmail } from './support/auth.ts';

let t: TestApp;
beforeAll(async () => {
  t = await freshTestApp();
});
afterAll(() => t.close());

test('sign-up creates a buyer', async () => {
  const a = await signUp(t, 'new-buyer@example.com', 'New Buyer');
  const me = await a.get('/api/me');
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({
    email: 'new-buyer@example.com',
    name: 'New Buyer',
    role: 'buyer',
  });
});

test('sign-up ignores a role in the body', async () => {
  const email = uniqueEmail();
  const a = agent(t);
  const res = await a
    .post('/api/auth/sign-up/email')
    .send({ email, password: PASSWORD, name: 'Sneaky', role: 'admin' });
  // Better Auth either rejects the unknown field or drops it; either way no admin is created.
  if (res.status === 200) {
    expect((await a.get('/api/me')).body.role).toBe('buyer');
  } else {
    expect(res.status).toBe(400);
  }
});

test('a duplicate email is refused without a server error', async () => {
  const email = uniqueEmail();
  await signUp(t, email);
  const res = await agent(t)
    .post('/api/auth/sign-up/email')
    .send({ email, password: PASSWORD, name: 'Again' });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
  expect(res.body.code).toMatch(/USER_ALREADY_EXISTS/);
});

test('sign-in ignores email letter case', async () => {
  const email = uniqueEmail();
  await signUp(t, email);
  const a = await signIn(t, email.toUpperCase());
  expect((await a.get('/api/me')).body.email).toBe(email);
});

test('sign-out ends the session', async () => {
  const a = await signUp(t);
  await a.post('/api/auth/sign-out').send({});
  const me = await a.get('/api/me');
  expect(me.status).toBe(401);
  expect(me.body).toEqual({ error: 'unauthenticated' });
});
