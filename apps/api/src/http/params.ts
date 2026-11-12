import type { Request } from 'express';
import { notFound } from './errors.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The path parameter as a UUID; anything else is a 404 rather than a Postgres error. */
export function uuidParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !UUID.test(value)) notFound();
  return value;
}

export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const pg = e?.cause ?? e;
  return pg?.code === '23505' && pg?.constraint === constraint;
}

export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e?.cause ?? e)?.code === '23503';
}
