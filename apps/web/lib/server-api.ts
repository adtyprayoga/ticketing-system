import 'server-only';

/** Server-side read of a public endpoint, straight to the API (no session, so no cookies). */
export async function serverGet<T>(path: string): Promise<T | null> {
  const origin = process.env.API_ORIGIN ?? 'http://localhost:4000';
  const res = await fetch(`${origin}${path}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
