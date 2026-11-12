import { expect, test } from 'vitest';
import { parseConfig } from '../src/config.ts';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

test('names each missing variable', () => {
  expect(() => parseConfig({})).toThrow(/DATABASE_URL[\s\S]*REDIS_URL/);
});

test('rejects an unknown payment provider', () => {
  expect(() => parseConfig({ ...valid, PAYMENT_PROVIDER: 'stripe' })).toThrow(/PAYMENT_PROVIDER/);
});

test('defaults to the simulator, port 4000 and web origin localhost:3000', () => {
  const config = parseConfig(valid);
  expect(config.paymentProvider).toBe('simulator');
  expect(config.apiPort).toBe(4000);
  expect(config.webOrigin).toBe('http://localhost:3000');
});

test('production refuses the simulator, whose notifications are unsigned', () => {
  expect(() => parseConfig({ ...valid, NODE_ENV: 'production' })).toThrow(
    /PAYMENT_PROVIDER simulator is not allowed in production/,
  );
  expect(
    parseConfig({
      ...valid,
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'midtrans',
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-x',
    }).paymentProvider,
  ).toBe('midtrans');
});

test('midtrans requires a server key', () => {
  expect(() => parseConfig({ ...valid, PAYMENT_PROVIDER: 'midtrans' })).toThrow(
    /MIDTRANS_SERVER_KEY/,
  );
});
