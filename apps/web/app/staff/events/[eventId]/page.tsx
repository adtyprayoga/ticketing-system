'use client';

import Link from 'next/link';
import { use, useState, type FormEvent } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { ApiError, api, post } from '@/lib/api';
import { formatWib } from '@/lib/format';

type Lookup = {
  participantName: string;
  categoryName: string;
  checkedInAt: string | null;
  checkedInBy: { name: string } | null;
};

type CheckInResponse = { checkedInAt: string; checkedInBy: { name: string } | null };

/** Two deliberate steps: look the code up (read-only), then confirm check-in. */
export default function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<Lookup | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const path = (c: string) => `/api/staff/events/${eventId}/tickets/${encodeURIComponent(c)}`;

  async function lookUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const typed = String(new FormData(e.currentTarget).get('code')).trim();
    if (!typed) return;
    setBusy(true);
    setTicket(null);
    setMessage(null);
    try {
      setTicket(await api<Lookup>(path(typed)));
      setCode(typed);
    } catch (err) {
      const text =
        err instanceof ApiError && err.body.error === 'other_event'
          ? 'Not a ticket for this event'
          : err instanceof ApiError && err.status === 404
            ? 'No ticket with this code'
            : 'Lookup failed. Try again.';
      setMessage({ tone: 'error', text });
    } finally {
      setBusy(false);
    }
  }

  async function confirmCheckIn() {
    setBusy(true);
    try {
      const done = await post<CheckInResponse>(`${path(code)}/check-in`);
      setTicket((t) => t && { ...t, ...done });
      setMessage({ tone: 'ok', text: 'Checked in. Welcome them in!' });
    } catch (err) {
      if (err instanceof ApiError && err.body.error === 'already_checked_in') {
        const body = err.body as unknown as CheckInResponse;
        setTicket((t) => t && { ...t, ...body });
        setMessage({
          tone: 'warn',
          text: `Already checked in by ${body.checkedInBy?.name ?? 'someone'} at ${formatWib(body.checkedInAt)}`,
        });
      } else {
        setMessage({ tone: 'error', text: 'Check-in failed. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  const tone = { ok: 'text-green-700', warn: 'text-amber-700', error: 'text-red-700' };

  return (
    <div className="space-y-6">
      <Link href="/staff" className="text-sm underline">
        ← Choose another event
      </Link>
      <h1 className="text-2xl font-semibold">Check-in</h1>
      <form onSubmit={lookUp} className="flex max-w-md items-end gap-2">
        <div className="flex-1">
          <Field label="Ticket code">
            <Input name="code" autoComplete="off" placeholder="ABCD-EFGH-JKMN-PQRS" />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>
          Look up
        </Button>
      </form>
      {message && (
        <p className={`text-sm font-medium ${tone[message.tone]}`} role="status">
          {message.text}
        </p>
      )}
      {ticket && (
        <div
          className="space-y-2 rounded-md border border-slate-200 bg-white p-4"
          data-testid="lookup"
        >
          <p className="text-xl font-semibold">{ticket.participantName}</p>
          <p className="text-sm text-slate-600">{ticket.categoryName}</p>
          <p className="text-sm text-slate-600">
            {ticket.checkedInAt
              ? `Checked in by ${ticket.checkedInBy?.name ?? 'someone'} at ${formatWib(ticket.checkedInAt)}`
              : 'Not checked in'}
          </p>
          {!ticket.checkedInAt && (
            <Button onClick={confirmCheckIn} disabled={busy}>
              Confirm check-in
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
