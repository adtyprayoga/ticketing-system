'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatWib } from '@/lib/format';
import type { PublicEventSummary } from '@/lib/types';

type StaffEvent = PublicEventSummary & { id: string };

export default function StaffEventsPage() {
  const [events, setEvents] = useState<StaffEvent[] | null>(null);
  useEffect(() => {
    api<StaffEvent[]>('/api/staff/events').then(setEvents);
  }, []);

  if (!events) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Check-in: choose your event</h1>
      {events.length === 0 && (
        <p className="text-sm text-slate-500">
          You aren&apos;t assigned to any event. Ask the trainer.
        </p>
      )}
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="rounded-md border border-slate-200 bg-white p-4">
            <Link href={`/staff/events/${e.id}`} className="font-medium underline">
              {e.name}
            </Link>
            <p className="text-sm text-slate-600">
              {formatWib(e.startsAt)} · {e.venue}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
