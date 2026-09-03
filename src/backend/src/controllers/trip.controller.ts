/**
 * trip.controller.ts — Trip Request Controller (thin wrapper)
 */

import { Request, Response, NextFunction } from 'express';
import { createTripSchema } from '../utils/validators/trip.validator';
import * as tripService from '../services/trip.service';
import { Errors } from '../middlewares/error-handler';
import { sendCreated, sendSuccess, sendNoContent, sendPaginated } from '../utils/response.utils';

// ─── createTrip ───────────────────────────────────────────────────────────────
export async function createTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) { next(Errors.UNAUTHORIZED()); return; }
    const parsed = createTripSchema.safeParse(req.body);
    if (!parsed.success) { next(Errors.VALIDATION_ERROR(parsed.error.flatten() as Record<string, unknown>)); return; }
    const result = await tripService.createTrip(req.user.id, parsed.data, req.ip ?? undefined);
    if (result.warnings.length > 0) {
      res.status(201).json({ data: result.trip, warnings: result.warnings });
    } else {
      sendCreated(res, result.trip);
    }
  } catch (err) { next(err); }
}

// ─── listTrips ────────────────────────────────────────────────────────────────
export async function listTrips(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const page   = parseInt(req.query['page']   as string) || 1;
    const limit  = parseInt(req.query['limit']  as string) || 20;
    const status = req.query['status']   as string | undefined;
    const sortBy = req.query['sortBy']   as string | undefined;
    const order  = req.query['order']    as string | undefined;
    const { trips, total } = await tripService.getAllTrips(req.user.id, req.user.role, { status, page, limit, sortBy, order });
    sendPaginated(res, trips, total, page, limit);
  } catch (err) { next(err); }
}

// ─── getTripById ──────────────────────────────────────────────────────────────
export async function getTripById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const trip = await tripService.getTripById(req.params['id'] ?? '', req.user.id, req.user.role);
    sendSuccess(res, trip);
  } catch (err) { next(err); }
}

// ─── updateTrip ───────────────────────────────────────────────────────────────
export async function updateTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    // Tái dùng inner object schema (không superRefine) để partial hoạt động
    const { origin, destination, destinationType, departureDate, returnDate,
            purpose, estimatedBudget, hotelCostPerNight, hotelNights,
            perDiemBudget, transportBudget, otherBudget, urgencyReason } = req.body as Record<string, unknown>;
    const partial = { origin, destination, destinationType, departureDate, returnDate,
                      purpose, estimatedBudget, hotelCostPerNight, hotelNights,
                      perDiemBudget, transportBudget, otherBudget, urgencyReason };
    // Strip undefined
    const data = Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined));
    const trip = await tripService.updateTrip(req.params['id'] ?? '', req.user.id, data as Parameters<typeof tripService.updateTrip>[2]);
    sendSuccess(res, trip);
  } catch (err) { next(err); }
}

// ─── deleteTrip ───────────────────────────────────────────────────────────────
export async function deleteTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    await tripService.deleteTrip(req.params['id'] ?? '', req.user.id);
    sendNoContent(res);
  } catch (err) { next(err); }
}

// ─── submitTrip ───────────────────────────────────────────────────────────────
export async function submitTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const result = await tripService.submitTrip(req.params['id'] ?? '', req.user.id, req.ip ?? undefined);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

// ─── approveTrip ─────────────────────────────────────────────────────────────
export async function approveTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const comment = req.body?.comment as string | undefined;
    const result = await tripService.approveTrip(req.params['id'] ?? '', req.user.id, req.user.role, comment, req.ip ?? undefined);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

// ─── rejectTrip ───────────────────────────────────────────────────────────────
export async function rejectTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const comment = req.body?.comment as string;
    const result = await tripService.rejectTrip(req.params['id'] ?? '', req.user.id, req.user.role, comment, req.ip ?? undefined);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

// ─── closeTrip ────────────────────────────────────────────────────────────────
export async function closeTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const result = await tripService.closeTrip(req.params['id'] ?? '', req.user.id, req.ip ?? undefined);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
