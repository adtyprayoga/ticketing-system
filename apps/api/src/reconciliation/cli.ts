import { createDb } from '../db/client.ts';
import { parseConfig } from '../config.ts';
import { createPaymentProvider } from '../payments/provider.ts';
import { appClock } from '../payments/simulator.ts';
import { createRedis } from '../redis.ts';
import { reconcileExpired } from './reconcile.ts';

// `npm run reconcile`: settle every pending order past its deadline now. Safe to rerun.
const config = parseConfig(process.env);
const { db, pool } = createDb(config.databaseUrl);
const redis = createRedis(config.redisUrl);
// The simulator's clock, moved by "Advance clock" in the running API.
const clock = await appClock(db, config);
const payments = createPaymentProvider({ db, clock, config });
const result = await reconcileExpired({ db, redis, clock, payments, config });
console.log(result);
await pool.end();
redis.disconnect();
