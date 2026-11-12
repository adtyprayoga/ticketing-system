import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { AppDeps } from '../deps.ts';

async function probe(check: () => Promise<unknown>): Promise<'up' | 'down'> {
  try {
    await check();
    return 'up';
  } catch {
    return 'down';
  }
}

export function healthRoutes({ db, redis }: AppDeps): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const [dbState, redisState] = await Promise.all([
      probe(() => db.execute(sql`select 1`)),
      probe(() => redis.ping()),
    ]);
    if (dbState === 'down') {
      res.status(503).json({ status: 'down', db: dbState, redis: redisState });
      return;
    }
    res.json({ status: redisState === 'up' ? 'ok' : 'degraded', db: dbState, redis: redisState });
  });
  return router;
}
