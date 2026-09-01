/**
 * immutable.guard.ts — Trip Immutability Guard Middleware
 *
 * Chặn mọi write mutation (POST/PUT/PATCH/DELETE) nếu trip.status === 'CLOSED'.
 * Áp dụng cho tất cả routes write của trips, itinerary, expenses.
 *
 * Business Rule: BR-TR-06 — Closed Trip Immutability
 * Tài liệu tham chiếu: architecture.md §1.2, data-model.md §1
 *
 * Sử dụng:
 *   router.put('/trips/:id', authGuard, roleGuard(['EMPLOYEE']), immutableGuard, updateTrip)
 *
 * TODO: Implement Prisma query khi xây dựng Trip feature
 */

import { Request, Response, NextFunction } from 'express';
// Errors import sẽ dùng khi implement immutableGuard đầy đủ
// import { Errors } from './error-handler';

/**
 * immutableGuard — Kiểm tra trip.status trước khi cho phép write
 *
 * Chỉ block nếu:
 *   1. Request method là write (POST/PUT/PATCH/DELETE)
 *   2. Trip tồn tại và status === 'CLOSED'
 */
export async function immutableGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Chỉ áp dụng cho write methods
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!writeMethods.includes(req.method)) {
    next();
    return;
  }

  const tripId = req.params['id'];
  if (!tripId) {
    next();
    return;
  }

  try {
    // TODO: Query Prisma để lấy trip.status
    // const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { status: true } });
    // if (trip?.status === 'CLOSED') { next(Errors.TRIP_IMMUTABLE()); return; }

    // Placeholder — sẽ implement khi có Auth + Trip service
    next();
  } catch (err) {
    next(err);
  }
}
