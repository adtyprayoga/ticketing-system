import { existsSync } from 'node:fs';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');
process.env.NODE_ENV = 'test';
// Tests speak plain HTTP; a tunnel's https:// WEB_ORIGIN in .env would make auth cookies secure-only.
delete process.env.WEB_ORIGIN; // config's localhost default
