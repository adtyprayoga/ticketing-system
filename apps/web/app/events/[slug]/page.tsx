import { notFound } from 'next/navigation';
import { BuyForm } from '@/components/checkout/buy-form';
import { formatRupiah, formatWib } from '@/lib/format';
import { serverGet } from '@/lib/server-api';
import type { PublicCategory, PublicEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

function availability(c: PublicCategory): string {
  if (!c.salesOpen) return 'Sales closed';
  if (c.available === 0) return 'All remaining places are held — check back in a few minutes';
  return `${c.available} of ${c.capacity} places available`;
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await serverGet<PublicEvent>(`/api/events/${encodeURIComponent(slug)}`);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-slate-600">
          {formatWib(event.startsAt)} · {event.venue}
        </p>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ticket categories</h2>
        {event.categories.length === 0 && (
          <p className="text-sm text-slate-500">No ticket categories yet.</p>
        )}
        <ul className="space-y-3">
          {event.categories.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-slate-200 bg-white p-4"
              data-testid="category"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{c.name}</p>
                <p className="font-medium">{formatRupiah(c.price)}</p>
              </div>
              <p className="text-sm text-slate-600">{availability(c)}</p>
              <div className="mt-3">
                <BuyForm category={c} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
