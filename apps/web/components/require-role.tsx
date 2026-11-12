'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '@/lib/api';
import { useMe } from '@/lib/use-me';

/** Sends signed-out visitors to sign in; tells signed-in users without the role they lack access. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!roles.includes(user.role)) {
    return <p className="text-sm text-red-700">You don&apos;t have access to this page.</p>;
  }
  return <>{children}</>;
}
