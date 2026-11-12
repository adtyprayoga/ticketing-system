import { sql } from 'drizzle-orm';
import { createRedis, waitForRedis } from '../redis.ts';
import { createDb } from './client.ts';

// Wipes every table and the Redis cache (cached events would point at deleted rows). Refuses to touch anything that isn't a *_test database.
const url = process.env.DATABASE_URL ?? '';
const name = new URL(url).pathname.slice(1);
if (!name.endsWith('_test')) {
  console.error(`db:reset refuses to wipe "${name}": only *_test databases can be reset`);
  process.exit(1);
}
const { db, pool } = createDb(url);
const { rows } = await db.execute<{ tablename: string }>(
  sql`select tablename from pg_tables where schemaname = 'public'`,
);
if (rows.length > 0) {
  await db.execute(
    sql.raw(
      `truncate ${rows.map((r) => `"public"."${r.tablename}"`).join(', ')} restart identity cascade`,
    ),
  );
}
await pool.end();
if (process.env.REDIS_URL) {
  const redis = createRedis(process.env.REDIS_URL);
  await waitForRedis(redis);
  await redis.flushdb().catch(() => {});
  redis.disconnect();
}
console.log(`reset ${name}`);
