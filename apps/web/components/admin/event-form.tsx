'use client';

import { useState, type FormEvent } from 'react';
import { FieldError } from '@/components/field-errors';
import { Button, Field, Input } from '@/components/ui';
import { formErrors } from '@/lib/api';
import { isoToWibLocal, wibLocalToIso } from '@/lib/format';
import type { AdminEvent } from '@/lib/types';

export type EventInput = { slug: string; name: string; startsAt: string; venue: string };

export function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: AdminEvent;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<void>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const startsAt = String(form.get('startsAt'));
    setBusy(true);
    setErrors({});
    try {
      await onSubmit({
        slug: String(form.get('slug') ?? initial?.slug),
        name: String(form.get('name')),
        venue: String(form.get('venue')),
        startsAt: startsAt ? wibLocalToIso(startsAt) : '',
      });
    } catch (err) {
      setErrors(formErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
      <div>
        <Field label="Name">
          <Input name="name" defaultValue={initial?.name} />
        </Field>
        <FieldError errors={errors} name="name" />
      </div>
      <div>
        <Field label="Slug">
          <Input name="slug" defaultValue={initial?.slug} disabled={initial?.published} />
        </Field>
        <p className="mt-1 text-xs text-slate-500">
          Lowercase and hyphens, e.g. jakarta-night-run. Slug is fixed once published.
        </p>
        <FieldError errors={errors} name="slug" />
      </div>
      <div>
        <Field label="Starts at (WIB)">
          <Input
            name="startsAt"
            type="datetime-local"
            defaultValue={initial ? isoToWibLocal(initial.startsAt) : undefined}
          />
        </Field>
        <FieldError errors={errors} name="startsAt" />
      </div>
      <div>
        <Field label="Venue">
          <Input name="venue" defaultValue={initial?.venue} />
        </Field>
        <FieldError errors={errors} name="venue" />
      </div>
      <FieldError errors={errors} name="_" />
      <Button type="submit" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
