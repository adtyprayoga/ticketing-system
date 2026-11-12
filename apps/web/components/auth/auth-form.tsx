'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FieldError } from '@/components/field-errors';
import { Button, Field, Input } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { useMe } from '@/lib/use-me';

const messages: Record<string, [field: string, message: string]> = {
  USER_ALREADY_EXISTS: ['email', 'An account with this email already exists'],
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ['email', 'An account with this email already exists'],
  INVALID_EMAIL_OR_PASSWORD: ['_', 'Wrong email or password'],
  PASSWORD_TOO_SHORT: ['password', 'Use at least 8 characters'],
  INVALID_EMAIL: ['email', 'Enter a valid email address'],
};

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const { refresh } = useMe();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    setBusy(true);
    setErrors({});
    try {
      if (mode === 'sign-up') {
        await post('/api/auth/sign-up/email', {
          email,
          password,
          name: String(form.get('name')).trim(),
        });
      } else {
        await post('/api/auth/sign-in/email', { email, password });
      }
      await refresh();
      router.push(next.startsWith('/') ? next : '/');
    } catch (err) {
      const code = err instanceof ApiError ? (err.body.code ?? '') : '';
      const [field, message] = messages[code] ?? ['_', 'Something went wrong. Try again.'];
      setErrors({ [field]: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">
        {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
      </h1>
      {mode === 'sign-up' && (
        <Field label="Name">
          <Input name="name" required autoComplete="name" />
        </Field>
      )}
      <div>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <FieldError errors={errors} name="email" />
      </div>
      <div>
        <Field label="Password">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />
        </Field>
        <FieldError errors={errors} name="password" />
      </div>
      <FieldError errors={errors} name="_" />
      <Button type="submit" disabled={busy}>
        {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
      </Button>
      <p className="text-sm text-slate-600">
        {mode === 'sign-in' ? (
          <>
            No account?{' '}
            <Link href="/sign-up" className="underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
