import { toNodeHandler } from 'better-auth/node';
import express, { Router } from 'express';
import { paymentReviewRoutes } from './admin/payment-review-routes.ts';
import { createAuth } from './auth/auth.ts';
import { checkInRoutes } from './checkin/routes.ts';
import { meRoutes, sessionMiddleware } from './auth/session.ts';
import { adminCategoryRoutes } from './catalog/category-routes.ts';
import { adminEventRoutes } from './catalog/event-routes.ts';
import type { AppDeps } from './deps.ts';
import { eventCache } from './events/cache.ts';
import { publicEventRoutes } from './events/routes.ts';
import { healthRoutes } from './health/routes.ts';
import { orderRoutes } from './orders/routes.ts';
import { paymentWebhookRoutes } from './payments/routes.ts';
import { simulatorEnabled, simulatorRoutes } from './payments/simulator.ts';
import { ticketRoutes } from './tickets/routes.ts';
import { errorHandler, notFoundHandler } from './http/errors.ts';

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');

  const auth = createAuth(deps);
  const guards = sessionMiddleware(auth);
  // Better Auth reads the raw body itself, so it is mounted before express.json().
  app.all('/api/auth/{*any}', toNodeHandler(auth));
  app.use(express.json());

  app.use('/api', healthRoutes(deps));
  app.use('/api', meRoutes(guards));

  const cache = eventCache(deps.redis);
  app.use('/api', publicEventRoutes(deps, cache));
  app.use('/api', orderRoutes(deps, guards));
  app.use('/api', ticketRoutes(deps, guards));
  app.use('/api', paymentWebhookRoutes(deps));
  if (simulatorEnabled(deps.config)) app.use('/api/simulator', simulatorRoutes(deps));

  const staff = Router();
  staff.use(guards.requireRole('staff'));
  staff.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  staff.use(checkInRoutes(deps));
  app.use('/api/staff', staff);

  const admin = Router();
  admin.use(guards.requireRole('admin'));
  admin.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  const catalogHooks = { onEventChanged: (slug: string) => cache.invalidate(slug) };
  admin.use(adminEventRoutes(deps, catalogHooks));
  admin.use(adminCategoryRoutes(deps, catalogHooks));
  admin.use(paymentReviewRoutes(deps));
  app.use('/api/admin', admin);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
