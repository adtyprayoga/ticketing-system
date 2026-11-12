import { createHash, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDeps, PaymentProvider, PaymentStatus } from '../deps.ts';
import { HttpError } from '../http/errors.ts';
import { orders } from '../orders/schema.ts';
import { PAYMENT_WINDOW_MS } from '../checkout/hold.ts';

// Sandbox only: the workshop never touches real money.
const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const API_URL = 'https://api.sandbox.midtrans.com/v2';
/** How long after the deadline a transaction Midtrans never created counts as expired. */
const NEVER_STARTED_GRACE_MS = 5 * 60 * 1000;

/**
 * Midtrans transaction status → what it means for the order. Anything not listed (refund,
 * capture under fraud challenge, …) is unknown, which keeps the place held.
 */
export function mapMidtransStatus(transactionStatus?: string, fraudStatus?: string): PaymentStatus {
  switch (transactionStatus) {
    case 'settlement':
      return 'paid';
    case 'capture':
      return fraudStatus === 'accept' ? 'paid' : 'unknown';
    case 'pending':
    case 'deny': // the buyer may still retry another card in the same Snap session
      return 'pending';
    case 'expire':
      return 'expired';
    case 'cancel':
      return 'failed';
    default:
      return 'unknown';
  }
}

/** SHA-512 of order_id + status_code + gross_amount + server key, as Midtrans documents it. */
export function verifySignature(
  n: { order_id: string; status_code: string; gross_amount: string; signature_key: string },
  serverKey: string,
): boolean {
  const expected = createHash('sha512')
    .update(n.order_id + n.status_code + n.gross_amount + serverKey)
    .digest();
  const given = Buffer.from(n.signature_key, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Snap's time format, in Jakarta time: "2026-11-15 07:00:00 +0700". */
function snapTime(at: Date): string {
  const wib = new Date(at.getTime() + 7 * 3600_000).toISOString();
  return `${wib.slice(0, 10)} ${wib.slice(11, 19)} +0700`;
}

const notificationSchema = z.object({
  // Not always one of ours: the dashboard's "Test notification URL" sends payment_notif_test_….
  order_id: z.string().min(1),
  status_code: z.string(),
  gross_amount: z.string(),
  signature_key: z.string(),
  transaction_status: z.string(),
  fraud_status: z.string().optional(),
});

export function createMidtransProvider({
  db,
  clock,
  config,
  fetch = globalThis.fetch,
}: Pick<AppDeps, 'db' | 'clock' | 'config'> & {
  fetch?: typeof globalThis.fetch;
}): PaymentProvider {
  const auth = `Basic ${Buffer.from(`${config.midtrans.serverKey}:`).toString('base64')}`;
  const headers = {
    Authorization: auth,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  return {
    async createPayment({ orderId, amount, deadline }) {
      // Snap counts its expiry from start_time, so a retry opened late still closes at the deadline.
      const startTime = snapTime(new Date(deadline.getTime() - PAYMENT_WINDOW_MS));
      const res = await fetch(SNAP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: amount },
          expiry: { start_time: startTime, unit: 'minutes', duration: PAYMENT_WINDOW_MS / 60_000 },
          callbacks: { finish: `${config.webOrigin}/orders/${orderId}/return` },
        }),
      });
      if (!res.ok) throw new Error(`Midtrans Snap returned ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as { token: string; redirect_url: string };
      return { token: body.token, redirectUrl: body.redirect_url };
    },

    async getStatus(orderId) {
      let body: { status_code?: string; transaction_status?: string; fraud_status?: string };
      try {
        const res = await fetch(`${API_URL}/${orderId}/status`, { headers });
        // "Transaction doesn't exist" may come as HTTP 404 or as HTTP 200 with status_code 404.
        if (res.status === 404) body = { status_code: '404' };
        else if (!res.ok) return 'unknown';
        else body = (await res.json()) as typeof body;
      } catch {
        return 'unknown';
      }
      if (body.status_code === '404') {
        // The buyer never chose a payment method, so Midtrans has no transaction. Once Snap's
        // own expiry has surely passed, nothing can be paid any more.
        const [order] = await db
          .select({ deadline: orders.paymentDeadline })
          .from(orders)
          .where(eq(orders.id, orderId));
        if (!order) return 'unknown';
        const expired = clock.now().getTime() > order.deadline.getTime() + NEVER_STARTED_GRACE_MS;
        return expired ? 'expired' : 'pending';
      }
      return mapMidtransStatus(body.transaction_status, body.fraud_status);
    },

    async parseNotification(req) {
      const parsed = notificationSchema.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, { error: 'invalid_notification' });
      if (!verifySignature(parsed.data, config.midtrans.serverKey)) {
        throw new HttpError(401, { error: 'invalid_signature' });
      }
      return {
        orderId: parsed.data.order_id,
        status: mapMidtransStatus(parsed.data.transaction_status, parsed.data.fraud_status),
        raw: req.body,
      };
    },
  };
}
