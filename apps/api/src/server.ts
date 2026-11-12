import { createApp } from './app.ts';
import { parseConfig, type Config } from './config.ts';
import { createDb } from './db/client.ts';
import { createPaymentProvider } from './payments/provider.ts';
import { appClock } from './payments/simulator.ts';
import { startReconciler } from './reconciliation/reconcile.ts';
import { createRedis } from './redis.ts';

let config: Config;
try {
  config = parseConfig(process.env);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const { db } = createDb(config.databaseUrl);
const redis = createRedis(config.redisUrl);
// In simulator mode the clock can be moved forward to show expiry without waiting.
const clock = await appClock(db, config);
const payments = createPaymentProvider({ db, clock, config });
const deps = { db, redis, clock, payments, config };
const app = createApp(deps);
startReconciler(deps);

app.listen(config.apiPort, () => {
  console.log(
    `api listening on http://localhost:${config.apiPort} (payments: ${config.paymentProvider})`,
  );
});
