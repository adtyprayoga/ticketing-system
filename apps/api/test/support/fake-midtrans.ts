import { createHash } from 'node:crypto';

export const SERVER_KEY = 'SB-Mid-server-TESTKEY';

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };

/** A stand-in for Midtrans at the HTTP layer: records requests, answers from a script. */
export function fakeMidtrans() {
  const calls: Call[] = [];
  const statuses = new Map<string, { status: number; body: unknown } | 'network-error'>();
  let snapFailures = 0;
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    calls.push({
      method: init.method ?? 'GET',
      url,
      headers,
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.includes('/snap/v1/transactions')) {
      if (snapFailures > 0) {
        snapFailures -= 1;
        return Response.json({ error_messages: ['Service unavailable'] }, { status: 503 });
      }
      const orderId = (
        JSON.parse(String(init.body)) as { transaction_details: { order_id: string } }
      ).transaction_details.order_id;
      return Response.json(
        {
          token: `snap-${orderId}`,
          redirect_url: `https://app.sandbox.midtrans.com/snap/v4/redirection/snap-${orderId}`,
        },
        { status: 201 },
      );
    }
    const match = url.match(/\/v2\/([^/]+)\/status$/);
    if (match) {
      const scripted = statuses.get(match[1]!);
      if (scripted === 'network-error') throw new TypeError('fetch failed');
      if (scripted) return Response.json(scripted.body, { status: scripted.status });
      return Response.json({ status_code: '404', status_message: "Transaction doesn't exist." });
    }
    return new Response('not found', { status: 404 });
  };
  return {
    fetch,
    calls,
    /** The next `times` Snap requests fail with 503. */
    failSnap(times: number) {
      snapFailures = times;
    },
    /** What the Status API answers for this order next time. */
    setStatus(orderId: string, body: Record<string, string> | 'network-error', status = 200) {
      statuses.set(
        orderId,
        body === 'network-error' ? body : { status, body: { order_id: orderId, ...body } },
      );
    },
  };
}

/** A notification as Midtrans sends it, signed the documented way. */
export function signedNotification(
  orderId: string,
  amount: number,
  fields: { transaction_status: string; fraud_status?: string; status_code?: string },
) {
  const statusCode =
    fields.status_code ?? (fields.transaction_status === 'pending' ? '201' : '200');
  const grossAmount = `${amount}.00`;
  const signature = createHash('sha512')
    .update(orderId + statusCode + grossAmount + SERVER_KEY)
    .digest('hex');
  return {
    transaction_time: '2026-11-15 07:01:00',
    transaction_id: '9aed5972-5b6a-401e-894b-a32c91ed1a3a',
    payment_type: 'bank_transfer',
    order_id: orderId,
    gross_amount: grossAmount,
    currency: 'IDR',
    status_message: 'midtrans payment notification',
    ...fields,
    status_code: statusCode,
    signature_key: signature,
  };
}
