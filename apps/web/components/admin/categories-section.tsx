'use client';

import { useCallback, useEffect, useState } from 'react';
import { CategoryForm } from '@/components/admin/category-form';
import { Button } from '@/components/ui';
import { api, del, formErrors, patch, post } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import type { AdminCategory } from '@/lib/types';

export function CategoriesSection({ eventId }: { eventId: string }) {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const path = `/api/admin/events/${eventId}/categories`;
  const load = useCallback(() => api<AdminCategory[]>(path).then(setCategories), [path]);
  useEffect(() => {
    api<AdminCategory[]>(path).then(setCategories);
  }, [path]);

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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Ticket categories</h2>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {categories?.length === 0 && (
        <p className="text-sm text-slate-500">No ticket categories yet.</p>
      )}
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {categories?.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="p-3">
              <CategoryForm
                initial={c}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  await patch(`/api/admin/categories/${c.id}`, input);
                  setEditing(null);
                  await load();
                }}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 p-3"
              data-testid="admin-category"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-500">
                  {formatRupiah(c.price)} · {c.held} of {c.capacity} places held or sold
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs ${c.salesOpen ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
              >
                {c.salesOpen ? 'Sales open' : 'Sales closed'}
              </span>
              <Button variant="secondary" onClick={() => setEditing(c.id)}>
                Edit
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  run(() => patch(`/api/admin/categories/${c.id}`, { salesOpen: !c.salesOpen }))
                }
              >
                {c.salesOpen ? 'Close sales' : 'Open sales'}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(`Delete "${c.name}"?`))
                    void run(() => del(`/api/admin/categories/${c.id}`));
                }}
              >
                Delete
              </Button>
            </li>
          ),
        )}
      </ul>
      <div className="rounded-md border border-dashed border-slate-300 p-3">
        <p className="mb-2 text-sm font-medium">Add a ticket category</p>
        <CategoryForm
          submitLabel="Add category"
          onSubmit={async (input) => {
            await post(path, input);
            await load();
          }}
        />
      </div>
    </section>
  );
}
