'use client';

import { useRouter } from 'next/navigation';
import { EventForm } from '@/components/admin/event-form';
import { post } from '@/lib/api';
import type { AdminEvent } from '@/lib/types';

export default function NewEventPage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New event</h1>
      <EventForm
        submitLabel="Create event"
        onSubmit={async (input) => {
          const event = await post<AdminEvent>('/api/admin/events', input);
          router.push(`/admin/events/${event.id}`);
        }}
      />
    </div>
  );
}
