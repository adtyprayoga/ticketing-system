'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { api, formErrors, post } from '@/lib/api';
import { formatRupiah } from '@/lib/format';

type SimulatedPayment = {
  orderId: string;
  amount: number;
  eventName: string;
  categoryName: string;
  participantName: string;
  orderStatus: string;
  providerStatus: string;
};

/**
 * Local stand-in for the Midtrans payment page. Each button makes the "provider" record an
 * outcome and notify the API's real payment webhook handler.
 */
export default function SimulatorPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const [payment, setPayment] = useState<SimulatedPayment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const path = `/api/simulator/payments/${orderId}`;
  const load = useCallback(() => api<SimulatedPayment>(path).then(setPayment), [path]);
  useEffect(() => {
    api<SimulatedPayment>(path)
      .then(setPayment)
      .catch((err) => setError(Object.values(formErrors(err))[0] ?? 'Simulator unavailable'));
  }, [path]);

  async function act(action: string, body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      await post(`${path}/${action}`, body);
      router.push(`/orders/${orderId}/return`);
    } catch (err) {
      setError(Object.values(formErrors(err))[0] ?? 'Something went wrong');
      await load().catch(() => {});
      setBusy(false);
    }
  }

  async function control(url: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await post(url, body);
      setNotice('Done.');
      await load();
    } catch (err) {
      setError(Object.values(formErrors(err))[0] ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold uppercase tracking-wide">Payment simulator</p>
        <p>Local stand-in for Midtrans. Every button notifies the API&apos;s payment webhook.</p>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {payment && (
        <>
          <div>
            <h1 className="text-2xl font-semibold">Pay {formatRupiah(payment.amount)}</h1>
            <p className="text-sm text-slate-600">
              {payment.eventName} · {payment.categoryName} · for {payment.participantName}
            </p>
            <p className="text-sm text-slate-600">
              Order: {payment.orderStatus} · Provider says: {payment.providerStatus}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('pay')}>
              Pay
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act('pay', { notifications: 2 })}
            >
              Send notification twice
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => act('fail')}>
              Fail
            </Button>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <p className="text-sm font-medium">Trainer controls</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => control(`${path}/provider-status`, { status: 'unknown' })}
              >
                Provider unreachable
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => control(`${path}/provider-status`, { status: 'paid' })}
              >
                Pay without notifying
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => control('/api/simulator/clock/advance', { minutes: 11 })}
              >
                Advance clock 11 minutes
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              These change what the provider will answer next, without notifying. The API asks it
              when the buyer returns and every 30 seconds for orders past their deadline (or run{' '}
              <code>npm run reconcile</code>).
            </p>
            {notice && <p className="text-sm text-green-700">{notice}</p>}
          </div>
        </>
      )}
      <Link href="/orders" className="text-sm underline">
        Back to my orders
      </Link>
    </div>
  );
}
