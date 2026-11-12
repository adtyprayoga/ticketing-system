'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { CategoriesSection } from '@/components/admin/categories-section';
import { EventForm } from '@/components/admin/event-form';
import { api, patch } from '@/lib/api';
import type { AdminEvent } from '@/lib/types';

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<AdminEvent>(`/api/admin/events/${id}`).then(setEvent);
  }, [id]);

  if (!event) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/admin/events" className="text-sm underline">
          ← All events
        </Link>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-600">{event.published ? 'Published' : 'Draft'}</p>
        <EventForm
          key={event.id + String(event.published)}
          initial={event}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            setEvent(await patch<AdminEvent>(`/api/admin/events/${id}`, input));
            setSaved(true);
          }}
        />
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </div>
      <CategoriesSection eventId={event.id} />
    </div>
  );
}
