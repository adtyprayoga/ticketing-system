import { Redis } from 'ioredis';

export function createRedis(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
  });
  let logged = false;
  // Without a listener, ioredis emits unhandled 'error' events and crashes the process.
  redis.on('error', (err) => {
    if (!logged) console.error('redis error:', err.message);
    logged = true;
  });
  redis.on('ready', () => {
    logged = false;
  });
  redis.connect().catch(() => {});
  return redis;
}

/** Resolves once connected, or after `timeoutMs` if Redis is unreachable (the app runs without it). */
export function waitForRedis(redis: Redis, timeoutMs = 1500): Promise<void> {
  if (redis.status === 'ready') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      redis.off('ready', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    redis.once('ready', done);
  });
}
