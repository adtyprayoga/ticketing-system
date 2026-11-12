const wib = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Sun, 6 Dec 2026, 19:00 WIB" */
export function formatWib(iso: string): string {
  return `${wib.format(new Date(iso))} WIB`;
}

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** "Rp 150.000" */
export function formatRupiah(n: number): string {
  return rupiah.format(n);
}

/** A datetime-local value typed in WIB → ISO with the +07:00 offset. "2026-12-06T19:00" → "2026-12-06T19:00:00+07:00" */
export function wibLocalToIso(local: string): string {
  return `${local}:00+07:00`;
}

/** ISO (any offset) → datetime-local value in WIB, for prefilling forms. */
export function isoToWibLocal(iso: string): string {
  const wibMs = new Date(iso).getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 16);
}
