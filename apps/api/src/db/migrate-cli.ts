import { createDb } from './client.ts';
import { runMigrations } from './migrate.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Invalid environment: DATABASE_URL is required');
  process.exit(1);
}
const { db, pool } = createDb(url);
await runMigrations(db);
await pool.end();
console.log('migrations applied');
