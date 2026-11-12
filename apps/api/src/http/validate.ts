import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from './errors.ts';

/** Parses the JSON body with `schema`; puts the result on res.locals.body or answers 400 per field. */
export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      throw new HttpError(400, { error: 'validation', fields });
    }
    res.locals.body = result.data;
    next();
  };
}

export function body<T>(res: { locals: Record<string, unknown> }): T {
  return res.locals.body as T;
}
