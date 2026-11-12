import { existsSync } from 'node:fs';
import { createDb } from '../../src/db/client.ts';
import { runMigrations } from '../../src/db/migrate.ts';

export default async function setup() {
  if (existsSync('../../.env')) process.loadEnvFile('../../.env');
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  const { db, pool } = createDb(url);
  await runMigrations(db);
  await pool.end();
}
