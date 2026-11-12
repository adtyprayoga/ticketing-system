'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FieldError } from '@/components/field-errors';
import { Button, Field, Input } from '@/components/ui';
import { formErrors, post } from '@/lib/api';
import type { Order, PublicCategory } from '@/lib/types';
import { useMe } from '@/lib/use-me';

/**
 * Buying one place. The checkout attempt key is created when the form opens and reused for
 * every resubmit, so a double click or a lost response returns the same order instead of
 * holding a second place. Opening the form again starts a new attempt.
 */
export function BuyForm({ category }: { category: PublicCategory }) {
  const { user, loading } = useMe();
  const pathname = usePathname();
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!category.salesOpen) return null;
  if (loading) return null;
  if (!user) {
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="text-sm underline">
        Sign in to buy
      </Link>
    );
  }
  if (!attemptKey) {
    return (
      <Button
        disabled={category.available === 0}
        onClick={() => {
          setErrors({});
          setAttemptKey(crypto.randomUUID());
        }}
      >
        Buy a place
      </Button>
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      const order = await post<Order>('/api/checkout', {
        categoryId: category.id,
        participantName: String(form.get('participantName')),
        attemptKey,
      });
      window.location.assign(order.payment?.redirectUrl ?? '/orders');
    } catch (err) {
      setErrors(formErrors(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
      <div>
        <Field label="Participant name">
          <Input name="participantName" autoComplete="off" />
        </Field>
        <p className="mt-1 text-xs text-slate-500">
          The person who will attend. They don&apos;t need an account.
        </p>
        <FieldError errors={errors} name="participantName" />
      </div>
      <FieldError errors={errors} name="_" />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Go to payment
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAttemptKey(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
