import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { AppDeps } from '../deps.ts';
import { account, session, user, verification } from './schema.ts';

export function createAuth({ db, config }: Pick<AppDeps, 'db' | 'config'>) {
  return betterAuth({
    // The browser reaches the API through the web app's /api rewrite, so cookies belong to WEB_ORIGIN.
    baseURL: config.webOrigin,
    basePath: '/api/auth',
    secret: config.betterAuthSecret,
    trustedOrigins: [config.webOrigin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      additionalFields: {
        // input: false — a sign-up request can never choose its role.
        role: { type: 'string', defaultValue: 'buyer', input: false },
      },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
