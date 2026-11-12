'use client';

import { useEffect, useState } from 'react';

/** Time left in the payment window, ticking every second. */
export function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, new Date(deadline).getTime() - now);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  if (left === 0) return <span>Payment window closed — checking with the payment provider</span>;
  return (
    <span>
      {minutes}:{String(seconds).padStart(2, '0')} left to pay
    </span>
  );
}
