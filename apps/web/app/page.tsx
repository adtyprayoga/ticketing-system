import Link from 'next/link';
import { formatWib } from '@/lib/format';
import { serverGet } from '@/lib/server-api';
import type { PublicEventSummary } from '@/lib/types';
import { HealthStatus } from './health-status';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = (await serverGet<PublicEventSummary[]>('/api/events')) ?? [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Upcoming events</h1>
      {events.length === 0 && <p className="text-sm text-slate-500">No events on sale yet.</p>}
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.slug} className="rounded-md border border-slate-200 bg-white p-4">
            <Link href={`/events/${e.slug}`} className="text-lg font-medium underline">
              {e.name}
            </Link>
            <p className="text-sm text-slate-600">
              {formatWib(e.startsAt)} · {e.venue}
            </p>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-200 pt-4">
        <HealthStatus />
      </footer>
    </div>
  );
}
