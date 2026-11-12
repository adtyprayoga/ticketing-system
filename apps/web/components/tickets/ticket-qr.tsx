'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** The QR code holds only the lookup code: no URL, no participant data. */
export function TicketQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(code.replace(/-/g, ''), { margin: 1, width: 192 }).then(setSrc);
  }, [code]);
  if (!src) return <div className="h-48 w-48 animate-pulse rounded bg-slate-100" />;
  // eslint-disable-next-line @next/next/no-img-element -- a data URL generated in the browser
  return <img src={src} alt={`QR code for ticket ${code}`} width={192} height={192} />;
}
