import { and, asc, eq } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { currentUser } from '../auth/session.ts';
import { events, ticketCategories } from '../catalog/schema.ts';
import type { AppDeps } from '../deps.ts';
import { HttpError, notFound } from '../http/errors.ts';
import { uuidParam } from '../http/params.ts';
import { orders } from '../orders/schema.ts';
import { staffAssignments } from '../staff/schema.ts';
import { normalizeLookupCode } from '../tickets/lookup-code.ts';
import { tickets } from '../tickets/schema.ts';
import { checkIn, staffName } from './check-in.ts';

/** Ticket lookup and check-in at the door. Mounted under /api/staff (staff role required). */
export function checkInRoutes(deps: AppDeps): Router {
  const { db } = deps;
  const router = Router();

  async function assignedEvent(req: Request, res: Response): Promise<string> {
    const eventId = uuidParam(req, 'eventId');
    const [assignment] = await db
      .select({ eventId: staffAssignments.eventId })
      .from(staffAssignments)
      .where(
        and(
          eq(staffAssignments.eventId, eventId),
          eq(staffAssignments.userId, currentUser(res).id),
        ),
      );
    if (!assignment) throw new HttpError(403, { error: 'forbidden' });
    return eventId;
  }

  /** The ticket behind a typed or scanned code, only if it belongs to this event. */
  async function ticketForEvent(eventId: string, rawCode: string) {
    const [row] = await db
      .select({
        id: tickets.id,
        checkedInAt: tickets.checkedInAt,
        checkedInBy: tickets.checkedInBy,
        participantName: orders.participantName,
        categoryName: ticketCategories.name,
        eventId: ticketCategories.eventId,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(ticketCategories, eq(ticketCategories.id, orders.categoryId))
      .where(eq(tickets.lookupCode, normalizeLookupCode(rawCode)));
    if (!row) notFound();
    if (row.eventId !== eventId) {
      throw new HttpError(404, { error: 'other_event', message: 'Not a ticket for this event' });
    }
    return row;
  }

  router.get('/events', async (_req, res) => {
    const rows = await db
      .select({
        id: events.id,
        slug: events.slug,
        name: events.name,
        startsAt: events.startsAt,
        venue: events.venue,
      })
      .from(staffAssignments)
      .innerJoin(events, eq(events.id, staffAssignments.eventId))
      .where(eq(staffAssignments.userId, currentUser(res).id))
      .orderBy(asc(events.startsAt));
    res.json(rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString() })));
  });

  /** Read-only: looking a ticket up never changes its entry status. */
  router.get('/events/:eventId/tickets/:code', async (req, res) => {
    const eventId = await assignedEvent(req, res);
    const ticket = await ticketForEvent(eventId, String(req.params.code));
    res.json({
      participantName: ticket.participantName,
      categoryName: ticket.categoryName,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      checkedInBy: await staffName(db, ticket.checkedInBy),
    });
  });

  router.post('/events/:eventId/tickets/:code/check-in', async (req, res) => {
    const eventId = await assignedEvent(req, res);
    const ticket = await ticketForEvent(eventId, String(req.params.code));
    const outcome = await checkIn(deps, ticket.id, currentUser(res).id);
    const body = {
      checkedInAt: outcome.checkedInAt.toISOString(),
      checkedInBy: await staffName(db, outcome.staffId),
    };
    if (outcome.result === 'checked_in') {
      res.json({ result: 'checked_in', ...body });
      return;
    }
    res.status(409).json({ error: 'already_checked_in', message: 'Already checked in', ...body });
  });

  return router;
}
