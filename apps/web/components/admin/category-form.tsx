'use client';

import { useState, type FormEvent } from 'react';
import { FieldError } from '@/components/field-errors';
import { Button, Field, Input } from '@/components/ui';
import { formErrors } from '@/lib/api';
import type { AdminCategory } from '@/lib/types';

export type CategoryInput = { name: string; price: number; capacity: number };

const toNumber = (v: FormDataEntryValue | null) => (v === null || v === '' ? NaN : Number(v));

export function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AdminCategory;
  submitLabel: string;
  onSubmit: (input: CategoryInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setErrors({});
    try {
      await onSubmit({
        name: String(form.get('name')),
        price: toNumber(form.get('price')),
        capacity: toNumber(form.get('capacity')),
      });
      if (!initial) formEl.reset();
    } catch (err) {
      setErrors(formErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4" noValidate>
      <div>
        <Field label="Category name">
          <Input name="name" defaultValue={initial?.name} />
        </Field>
        <FieldError errors={errors} name="name" />
      </div>
      <div>
        <Field label="Price (Rp)">
          <Input name="price" type="number" min={1} step={1} defaultValue={initial?.price} />
        </Field>
        <FieldError errors={errors} name="price" />
      </div>
      <div>
        <Field label="Capacity">
          <Input name="capacity" type="number" min={1} step={1} defaultValue={initial?.capacity} />
        </Field>
        <FieldError errors={errors} name="capacity" />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      <div className="sm:col-span-4">
        <FieldError errors={errors} name="_" />
      </div>
    </form>
  );
}
