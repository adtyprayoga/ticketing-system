import { fromNodeHeaders } from 'better-auth/node';
import { Router, type RequestHandler, type Response } from 'express';
import { HttpError } from '../http/errors.ts';
import type { Auth } from './auth.ts';
import type { Role } from './schema.ts';

export type SessionUser = { id: string; email: string; name: string; role: Role };

export function currentUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new HttpError(401, { error: 'unauthenticated' });
  return user;
}

export function sessionMiddleware(auth: Auth) {
  const requireSession: RequestHandler = async (req, res, next) => {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) throw new HttpError(401, { error: 'unauthenticated' });
    const { id, email, name, role } = result.user;
    res.locals.user = { id, email, name, role: role as Role } satisfies SessionUser;
    next();
  };

  const requireRole =
    (...allowed: Role[]): RequestHandler =>
    async (req, res, next) => {
      await requireSession(req, res, () => {});
      if (!allowed.includes(currentUser(res).role)) {
        throw new HttpError(403, { error: 'forbidden' });
      }
      next();
    };

  return { requireSession, requireRole };
}

export type Guards = ReturnType<typeof sessionMiddleware>;

export function meRoutes({ requireSession }: Guards): Router {
  const router = Router();
  router.get('/me', requireSession, (_req, res) => {
    res.json(currentUser(res));
  });
  return router;
}
