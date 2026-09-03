/**
 * immutable.guard.ts — Trip Immutability Guard (BR-TR-06)
 * Chặn write mutation khi trip.status === 'CLOSED'.
 */

import { Request, Response, NextFunction } from 'express';
import { Errors } from './error-handler';
import prisma from '../prisma/client';

export async function immutableGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!writeMethods.includes(req.method)) { next(); return; }

  const tripId = req.params['id'];
  if (!tripId) { next(); return; }

  try {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
    if (trip?.status === 'CLOSED') { next(Errors.TRIP_IMMUTABLE()); return; }
    next();
  } catch (err) {
    next(err);
  }
}
