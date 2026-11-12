import type { Redis } from 'ioredis';

export type CacheState = 'hit' | 'miss' | 'bypass';

const TTL_SECONDS = 60;
const key = (slug: string) => `event:${slug}`;

/**
 * Redis cache for stable public event details. Every Redis failure degrades to "bypass":
 * the caller reads PostgreSQL instead, so the page still loads with Redis down.
 */
export function eventCache(redis: Redis) {
  return {
    async get<T>(slug: string): Promise<{ value: T | null; state: CacheState }> {
      try {
        const raw = await redis.get(key(slug));
        return raw ? { value: JSON.parse(raw) as T, state: 'hit' } : { value: null, state: 'miss' };
      } catch {
        return { value: null, state: 'bypass' };
      }
    },
    async set(slug: string, value: unknown): Promise<void> {
      await redis.set(key(slug), JSON.stringify(value), 'EX', TTL_SECONDS).catch(() => {});
    },
    /** Called after every admin write, so edits show at once instead of after the TTL. */
    async invalidate(slug: string): Promise<void> {
      await redis.del(key(slug)).catch(() => {});
    },
  };
}

export type EventCache = ReturnType<typeof eventCache>;
