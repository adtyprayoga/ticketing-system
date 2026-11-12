export type Role = 'buyer' | 'staff' | 'admin';
export type SessionUser = { id: string; email: string; name: string; role: Role };

export class ApiError extends Error {
  status: number;
  body: { error?: string; message?: string; code?: string; fields?: Record<string, string> };
  constructor(status: number, body: ApiError['body']) {
    super(body.message ?? body.error ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

/** Calls the Express API through the same-origin /api rewrite. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data ?? {});
  return data as T;
}

export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => api<null>(path, { method: 'DELETE' });

/** Field errors from a 400 response, or a single form-level message for anything else. */
export function formErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.body.fields) return err.body.fields;
  if (err instanceof ApiError) return { _: err.body.message ?? 'Something went wrong. Try again.' };
  return { _: 'Could not reach the server. Try again.' };
}
