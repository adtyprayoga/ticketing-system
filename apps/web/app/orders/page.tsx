'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Countdown } from '@/components/checkout/countdown';
import { OrderStatusBadge } from '@/components/checkout/order-status';
import { RequireRole } from '@/components/require-role';
import { Button } from '@/components/ui';
import { api, formErrors, post } from '@/lib/api';
import { formatRupiah, formatWib } from '@/lib/format';
import type { Order } from '@/lib/types';

function OrdersList() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Order[]>('/api/orders').then(setOrders);
  }, []);

  async function continuePayment(order: Order) {
    setError('');
    try {
      const { redirectUrl } = await post<{ redirectUrl: string }>(
        `/api/orders/${order.id}/continue-payment`,
      );
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(Object.values(formErrors(err))[0] ?? 'Something went wrong');
    }
  }

  if (!orders) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My orders</h1>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {orders.length === 0 && (
        <p className="text-sm text-slate-500">
          No orders yet.{' '}
          <Link href="/" className="underline">
            Find an event
          </Link>
          .
        </p>
      )}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li
            key={o.id}
            className="rounded-md border border-slate-200 bg-white p-4"
            data-testid="order"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {o.eventName} · {o.categoryName}
              </p>
              <OrderStatusBadge status={o.status} />
            </div>
            <p className="text-sm text-slate-600">
              For {o.participantName} · {formatRupiah(o.amount)} · {formatWib(o.eventStartsAt)}
            </p>
            {o.status === 'pending' && !o.holdReleased && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <Countdown deadline={o.paymentDeadline} />
                <Button onClick={() => continuePayment(o)}>Continue payment</Button>
              </div>
            )}
            {o.status === 'paid' && (
              <Link href="/tickets" className="mt-2 inline-block text-sm underline">
                See the ticket
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireRole roles={['buyer', 'staff', 'admin']}>
      <OrdersList />
    </RequireRole>
  );
}
