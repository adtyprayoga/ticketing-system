'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api';
import { useMe } from '@/lib/use-me';

export function SiteHeader() {
  const { user, loading, refresh } = useMe();
  const router = useRouter();

  async function signOut() {
    await post('/api/auth/sign-out');
    await refresh();
    router.push('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Ticketing workshop
        </Link>
        {user && (
          <>
            <Link href="/orders">My orders</Link>
            <Link href="/tickets">My tickets</Link>
            {user.role === 'staff' && <Link href="/staff">Check-in</Link>}
            {user.role === 'admin' && <Link href="/admin/events">Events admin</Link>}
            {user.role === 'admin' && <Link href="/admin/payment-reviews">Payment review</Link>}
          </>
        )}
        <span className="ml-auto" />
        {!loading && !user && (
          <>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Sign up</Link>
          </>
        )}
        {user && (
          <>
            <span className="text-slate-500">
              {user.email} · {user.role}
            </span>
            <button onClick={signOut} className="text-slate-700 underline">
              Sign out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
