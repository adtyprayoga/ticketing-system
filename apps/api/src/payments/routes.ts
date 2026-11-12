import { Router } from 'express';
import type { AppDeps } from '../deps.ts';
import { HttpError } from '../http/errors.ts';
import { handleNotification } from './confirm.ts';

/** The provider's webhook. Midtrans and the simulator both arrive here. */
export function paymentWebhookRoutes(deps: AppDeps): Router {
  const router = Router();
  router.post('/payments/notifications', async (req, res) => {
    const notification = await deps.payments.parseNotification(req).catch((err: unknown) => {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, { error: 'invalid_notification' });
    });
    await handleNotification(deps, notification);
    res.json({ ok: true });
  });
  return router;
}
