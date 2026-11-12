'use client';

import { useEffect, useState } from 'react';

type Health = { status: string; db: 'up' | 'down'; redis: 'up' | 'down' };

export function HealthStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-red-700">API unreachable</p>;
  if (!health) return <p className="text-sm text-slate-500">Checking the API…</p>;
  return (
    <ul className="text-sm text-slate-600">
      <li>Database: {health.db}</li>
      <li>Redis: {health.redis}</li>
    </ul>
  );
}
