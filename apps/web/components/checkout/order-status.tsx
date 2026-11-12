import type { Order } from '@/lib/types';

const labels: Record<Order['status'], [string, string]> = {
  pending: ['Waiting for payment', 'bg-amber-100 text-amber-800'],
  paid: ['Paid', 'bg-green-100 text-green-800'],
  expired: ['Expired — the place was released', 'bg-slate-100 text-slate-600'],
  failed: ['Payment failed — the place was released', 'bg-slate-100 text-slate-600'],
  payment_review: ['Needs support — contact the organizer', 'bg-red-100 text-red-800'],
};

export function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const [label, style] = labels[status];
  return <span className={`rounded px-2 py-0.5 text-xs ${style}`}>{label}</span>;
}
