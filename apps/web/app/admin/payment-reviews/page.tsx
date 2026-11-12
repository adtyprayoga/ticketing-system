'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatRupiah, formatWib } from '@/lib/format';
import type { Order } from '@/lib/types';

type Review = Order & {
  buyerEmail: string;
  holdReleasedAt: string | null;
  notifications: { provider: string; status: string; receivedAt: string; raw: unknown }[];
};

/** Late payments: paid after the place went back on sale. Read-only — refunds are out of scope. */
export default function PaymentReviewsPage() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    api<Review[]>('/api/admin/payment-reviews').then(setReviews);
  }, []);

  if (!reviews) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Payment review</h1>
      <p className="text-sm text-slate-600">
        Orders paid after their place was released. Their buyers were told to contact support; any
        ticket already issued to someone else stays valid.
      </p>
      {reviews.length === 0 && <p className="text-sm text-slate-500">Nothing needs review.</p>}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="rounded-md border border-slate-200 bg-white p-4"
            data-testid="review"
          >
            <p className="font-medium">
              {r.eventName} · {r.categoryName} · for {r.participantName}
            </p>
            <p className="text-sm text-slate-600">
              {r.buyerEmail} · {formatRupiah(r.amount)} · order {r.id}
            </p>
            <p className="text-sm text-slate-600">
              Payment window closed {formatWib(r.paymentDeadline)}
              {r.holdReleasedAt && ` · place released ${formatWib(r.holdReleasedAt)}`}
            </p>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Received</th>
                  <th className="py-1 font-medium">Provider</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {r.notifications.map((n, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{formatWib(n.receivedAt)}</td>
                    <td className="py-1">{n.provider}</td>
                    <td className="py-1">{n.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </div>
  );
}
