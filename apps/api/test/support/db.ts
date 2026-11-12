import { sql } from 'drizzle-orm';
import type { Db } from '../../src/db/client.ts';

export async function resetDatabase(db: Db): Promise<void> {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await db.execute(sql.raw(`truncate ${list} restart identity cascade`));
}
