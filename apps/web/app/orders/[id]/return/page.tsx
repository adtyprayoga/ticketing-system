'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { OrderStatusBadge } from '@/components/checkout/order-status';
import { RequireRole } from '@/components/require-role';
import { post } from '@/lib/api';
import type { Order } from '@/lib/types';

/** Where the buyer lands after paying. It never trusts its own query string. */
function ReturnView({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  useEffect(() => {
    // Ask the API to check with the payment provider; never trust this page's query string.
    post<Order>(`/api/orders/${id}/refresh`).then(setOrder);
  }, [id]);

  if (!order) return <p className="text-sm text-slate-500">Checking your payment…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {order.status === 'paid' ? 'Payment received' : 'Your order'}
      </h1>
      <p className="text-sm text-slate-600">
        {order.eventName} · {order.categoryName} · for {order.participantName}
      </p>
      <OrderStatusBadge status={order.status} />
      <div className="flex gap-4 text-sm">
        {order.status === 'paid' && (
          <Link href="/tickets" className="underline">
            See the ticket
          </Link>
        )}
        <Link href="/orders" className="underline">
          My orders
        </Link>
      </div>
    </div>
  );
}

export default function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireRole roles={['buyer', 'staff', 'admin']}>
      <ReturnView id={id} />
    </RequireRole>
  );
}
