import type { Request } from 'express';
import type { Redis } from 'ioredis';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';

export interface Clock {
  now(): Date;
}

/** A clock the local simulator and tests can move forward to show expiry without waiting. */
export interface ControllableClock extends Clock {
  advance(ms: number): void;
}

export const systemClock: Clock = { now: () => new Date() };

export function offsetClock(initialOffsetMs = 0): ControllableClock {
  let offset = initialOffsetMs;
  return {
    now: () => new Date(Date.now() + offset),
    advance: (ms) => {
      offset += ms;
    },
  };
}

export type PaymentStatus = 'paid' | 'pending' | 'expired' | 'failed' | 'unknown';

export type PaymentNotification = { orderId: string; status: PaymentStatus; raw: unknown };

export interface PaymentProvider {
  /** The provider's payment must close at the order's `deadline`, however late it is opened. */
  createPayment(order: { orderId: string; amount: number; deadline: Date }): Promise<{
    token: string;
    redirectUrl: string;
  }>;
  getStatus(orderId: string): Promise<PaymentStatus>;
  parseNotification(req: Request): Promise<PaymentNotification>;
}

export type AppDeps = {
  db: Db;
  redis: Redis;
  clock: Clock;
  payments: PaymentProvider;
  config: Config;
};
