import { eq } from 'drizzle-orm';
import request from 'supertest';
import { user, type Role } from '../../src/auth/schema.ts';
import type { TestApp } from './app.ts';

export const PASSWORD = 'workshop-password';
let counter = 0;

export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

/** An agent that keeps cookies and sends the Origin header Better Auth expects from the browser. */
export function agent(t: TestApp) {
  return request.agent(t.app).set('Origin', t.deps.config.webOrigin);
}

export async function signUp(t: TestApp, email = uniqueEmail(), name = 'Test User') {
  const a = agent(t);
  const res = await a.post('/api/auth/sign-up/email').send({ email, password: PASSWORD, name });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${res.text}`);
  return a;
}

export async function signIn(t: TestApp, email: string, password = PASSWORD) {
  const a = agent(t);
  const res = await a.post('/api/auth/sign-in/email').send({ email, password });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${res.text}`);
  return a;
}

/** Signs up a fresh account, gives it `role`, and returns an agent holding its session. */
export async function agentWithRole(t: TestApp, role: Role, email = uniqueEmail(role)) {
  const a = await signUp(t, email);
  await t.deps.db.update(user).set({ role }).where(eq(user.email, email));
  return a;
}
