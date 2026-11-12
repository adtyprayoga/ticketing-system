import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error ?? status));
    this.status = status;
    this.body = body;
  }
}

export function fieldError(field: string, message: string): never {
  throw new HttpError(400, { error: 'validation', fields: { [field]: message } });
}

export function conflict(code: string, message: string): never {
  throw new HttpError(409, { error: code, message });
}

export function notFound(): never {
  throw new HttpError(404, { error: 'not_found' });
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.body);
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
};
