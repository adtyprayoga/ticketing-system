'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { TicketQr } from '@/components/tickets/ticket-qr';
import { api } from '@/lib/api';
import { formatWib } from '@/lib/format';
import type { Ticket } from '@/lib/types';

function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  useEffect(() => {
    api<Ticket[]>('/api/tickets').then(setTickets);
  }, []);

  if (!tickets) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My tickets</h1>
      {tickets.length === 0 && (
        <p className="text-sm text-slate-500">
          No tickets yet. Paid orders show up here.{' '}
          <Link href="/orders" className="underline">
            My orders
          </Link>
        </p>
      )}
      <ul className="space-y-4">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-6 rounded-md border border-slate-200 bg-white p-4"
            data-testid="ticket"
          >
            <TicketQr code={t.lookupCode} />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t.participantName}</p>
              <p className="text-sm text-slate-600">
                {t.eventName} · {t.categoryName}
              </p>
              <p className="text-sm text-slate-600">
                {formatWib(t.eventStartsAt)} · {t.venue}
              </p>
              <p className="pt-2 font-mono text-lg tracking-wider" data-testid="lookup-code">
                {t.lookupCode}
              </p>
              <p className="text-sm text-slate-600">
                {t.checkedInAt ? `Checked in ${formatWib(t.checkedInAt)}` : 'Not checked in yet'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <RequireRole roles={['buyer', 'staff', 'admin']}>
      <TicketList />
    </RequireRole>
  );
}
