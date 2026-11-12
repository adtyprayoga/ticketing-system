import { parseArgs } from 'node:util';
import { createDb } from '../db/client.ts';
import { assignStaff } from './assign.ts';

// npm run staff:assign -- --event <slug> --email <email>
const { values } = parseArgs({
  options: { event: { type: 'string' }, email: { type: 'string' } },
});
if (!values.event || !values.email || !process.env.DATABASE_URL) {
  console.error('usage: npm run staff:assign -- --event <slug> --email <staff email>');
  process.exit(1);
}
const { db, pool } = createDb(process.env.DATABASE_URL);
try {
  await assignStaff(db, { eventSlug: values.event, email: values.email });
  console.log(`assigned ${values.email} to ${values.event}`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
