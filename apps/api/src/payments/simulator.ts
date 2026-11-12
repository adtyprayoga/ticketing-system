import { eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  offsetClock,
  systemClock,
  type AppDeps,
  type Clock,
  type ControllableClock,
  type PaymentProvider,
  type PaymentStatus,
} from '../deps.ts';
import { conflict, HttpError, notFound } from '../http/errors.ts';
import { uuidParam } from '../http/params.ts';
import { body, validateBody } from '../http/validate.ts';
import { findOrderWithNames } from '../orders/routes.ts';
import { orders } from '../orders/schema.ts';
import { handleNotification } from './confirm.ts';
import { simulatorClock, simulatorPayments } from './schema.ts';

const statuses = ['paid', 'pending', 'expired', 'failed', 'unknown'] as const;
const notificationBody = z.object({ orderId: z.uuid(), status: z.enum(statuses) });

/**
 * Local payment simulator: stands in for Midtrans so the whole journey works offline.
 * Its payment page lives in the web app at /simulator/pay/:orderId.
 */
export function createSimulatorProvider({
  db,
  clock,
}: Pick<AppDeps, 'db' | 'clock'>): PaymentProvider {
  return {
    async createPayment({ orderId }) {
      return { token: orderId, redirectUrl: `/simulator/pay/${orderId}` };
    },
    async getStatus(orderId) {
      const [row] = await db
        .select({ status: simulatorPayments.status })
        .from(simulatorPayments)
        .where(eq(simulatorPayments.orderId, orderId));
      if (row) return row.status as PaymentStatus;
      // Like Midtrans: an unpaid payment expires when its window closes.
      const [order] = await db
        .select({ deadline: orders.paymentDeadline })
        .from(orders)
        .where(eq(orders.id, orderId));
      return order && order.deadline <= clock.now() ? 'expired' : 'pending';
    },
    async parseNotification(req) {
      const result = notificationBody.safeParse(req.body);
      if (!result.success) throw new HttpError(400, { error: 'invalid_notification' });
      return { ...result.data, raw: req.body };
    },
  };
}

/**
 * The clock for the API and `npm run reconcile`. With the simulator it starts where "Advance
 * clock" last left it, so both processes agree on the time.
 */
export async function appClock(db: AppDeps['db'], config: AppDeps['config']): Promise<Clock> {
  if (!simulatorEnabled(config)) return systemClock;
  const [row] = await db.select({ offsetMs: simulatorClock.offsetMs }).from(simulatorClock);
  return offsetClock(row?.offsetMs ?? 0);
}

/** Config refuses the simulator in production, so this is never true there. */
export function simulatorEnabled(config: AppDeps['config']): boolean {
  return config.paymentProvider === 'simulator';
}

async function setSimulatedStatus(deps: AppDeps, orderId: string, status: PaymentStatus) {
  const now = deps.clock.now();
  await deps.db
    .insert(simulatorPayments)
    .values({ orderId, status, updatedAt: now })
    .onConflictDoUpdate({ target: simulatorPayments.orderId, set: { status, updatedAt: now } });
}

/** Dev-only controls behind the simulator page. Mounted only when simulatorEnabled(). */
export function simulatorRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get('/payments/:orderId', async (req, res) => {
    const row = await findOrderWithNames(deps.db, uuidParam(req, 'orderId'));
    if (!row) notFound();
    res.json({
      orderId: row.order.id,
      amount: row.order.amount,
      eventName: row.eventName,
      categoryName: row.categoryName,
      participantName: row.order.participantName,
      orderStatus: row.order.status,
      providerStatus: await deps.payments.getStatus(row.order.id),
    });
  });

  /** "Pay": the provider records the payment, then notifies the webhook handler, once or twice. */
  router.post(
    '/payments/:orderId/pay',
    validateBody(z.object({ notifications: z.union([z.literal(1), z.literal(2)]).default(1) })),
    async (req, res) => {
      const orderId = uuidParam(req, 'orderId');
      if (!(await findOrderWithNames(deps.db, orderId))) notFound();
      const { notifications } = body<{ notifications: 1 | 2 }>(res);
      await setSimulatedStatus(deps, orderId, 'paid');
      const notification = {
        orderId,
        status: 'paid' as const,
        raw: { orderId, status: 'paid', simulated: true },
      };
      await Promise.all(
        Array.from({ length: notifications }, () => handleNotification(deps, notification)),
      );
      res.json({ ok: true });
    },
  );

  /** "Fail": the provider declines for good and says so. */
  router.post('/payments/:orderId/fail', async (req, res) => {
    const orderId = uuidParam(req, 'orderId');
    if (!(await findOrderWithNames(deps.db, orderId))) notFound();
    await setSimulatedStatus(deps, orderId, 'failed');
    await handleNotification(deps, {
      orderId,
      status: 'failed',
      raw: { orderId, status: 'failed', simulated: true },
    });
    res.json({ ok: true });
  });

  /** What the provider will answer next time it is asked, without notifying ("Provider unreachable" = unknown). */
  router.post(
    '/payments/:orderId/provider-status',
    validateBody(z.object({ status: z.enum(statuses) })),
    async (req, res) => {
      const orderId = uuidParam(req, 'orderId');
      if (!(await findOrderWithNames(deps.db, orderId))) notFound();
      await setSimulatedStatus(deps, orderId, body<{ status: PaymentStatus }>(res).status);
      res.json({ ok: true });
    },
  );

  /** Move the API's clock forward so payment windows close without waiting 10 minutes. */
  router.post(
    '/clock/advance',
    validateBody(
      z.object({
        minutes: z
          .number()
          .int()
          .positive()
          .max(24 * 60),
      }),
    ),
    async (_req, res) => {
      const clock = deps.clock as Partial<ControllableClock>;
      if (!clock.advance) conflict('clock_fixed', 'This clock cannot move.');
      const ms = body<{ minutes: number }>(res).minutes * 60_000;
      await deps.db
        .insert(simulatorClock)
        .values({ offsetMs: ms })
        .onConflictDoUpdate({
          target: simulatorClock.id,
          set: { offsetMs: sql`${simulatorClock.offsetMs} + ${ms}` },
        });
      clock.advance(ms);
      res.json({ now: deps.clock.now().toISOString() });
    },
  );

  return router;
}
