import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    PAYMENT_PROVIDER: z.enum(['simulator', 'midtrans']).default('simulator'),
    MIDTRANS_SERVER_KEY: z.string().default(''),
    MIDTRANS_CLIENT_KEY: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === 'simulator' && env.NODE_ENV === 'production') {
      // The simulator's notifications are unsigned: in production anyone could mark an order paid.
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'simulator is not allowed in production; set PAYMENT_PROVIDER=midtrans',
      });
    }
    if (env.PAYMENT_PROVIDER === 'midtrans' && !env.MIDTRANS_SERVER_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['MIDTRANS_SERVER_KEY'],
        message: 'is required when PAYMENT_PROVIDER=midtrans',
      });
    }
  });

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  apiPort: number;
  webOrigin: string;
  betterAuthSecret: string;
  paymentProvider: 'simulator' | 'midtrans';
  midtrans: { serverKey: string; clientKey: string };
};

export function parseConfig(env: Record<string, string | undefined>): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`);
    throw new Error(`Invalid environment:\n  ${lines.join('\n  ')}`);
  }
  const e = result.data;
  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    apiPort: e.API_PORT,
    webOrigin: e.WEB_ORIGIN.replace(/\/$/, ''),
    betterAuthSecret: e.BETTER_AUTH_SECRET,
    paymentProvider: e.PAYMENT_PROVIDER,
    midtrans: { serverKey: e.MIDTRANS_SERVER_KEY, clientKey: e.MIDTRANS_CLIENT_KEY },
  };
}
