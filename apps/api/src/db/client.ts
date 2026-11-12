import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
  // An idle client losing its connection must not crash the process.
  pool.on('error', (err) => console.error('postgres pool error:', err.message));
  return { db: drizzle(pool, { schema }), pool };
}
