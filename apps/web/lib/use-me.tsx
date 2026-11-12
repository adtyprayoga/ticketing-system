'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type SessionUser } from './api';

type MeState = { user: SessionUser | null; loading: boolean; refresh: () => Promise<void> };

async function fetchMe(): Promise<SessionUser | null> {
  try {
    return await api<SessionUser>('/api/me');
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) console.error(err);
    return null;
  }
}

const MeContext = createContext<MeState>({ user: null, loading: true, refresh: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchMe().then((next) => {
      if (!active) return;
      setUser(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return <MeContext.Provider value={{ user, loading, refresh }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
