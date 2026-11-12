'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { api, del, formErrors, patch } from '@/lib/api';
import { formatWib } from '@/lib/format';
import type { AdminEvent } from '@/lib/types';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api<AdminEvent[]>('/api/admin/events').then(setEvents), []);
  useEffect(() => {
    api<AdminEvent[]>('/api/admin/events').then(setEvents);
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(Object.values(formErrors(err))[0] ?? 'Something went wrong');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          New event
        </Link>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {!events && <p className="text-sm text-slate-500">Loading…</p>}
      {events?.length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {events?.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center gap-3 p-3"
            data-testid="admin-event"
          >
            <div className="min-w-0 flex-1">
              <Link href={`/admin/events/${e.id}`} className="font-medium underline">
                {e.name}
              </Link>
              <p className="text-sm text-slate-500">
                {formatWib(e.startsAt)} · {e.venue}
              </p>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs ${e.published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
            >
              {e.published ? 'Published' : 'Draft'}
            </span>
            <Button
              variant="secondary"
              onClick={() =>
                run(() => patch(`/api/admin/events/${e.id}`, { published: !e.published }))
              }
            >
              {e.published ? 'Unpublish' : 'Publish'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Delete "${e.name}"?`))
                  void run(() => del(`/api/admin/events/${e.id}`));
              }}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
