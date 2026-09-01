/**
 * trip.controller.ts — Trip Request Controller
 *
 * Handles:
 *   GET    /trips              — listTrips
 *   POST   /trips              — createTrip
 *   GET    /trips/:id          — getTripById
 *   PUT    /trips/:id          — updateTrip
 *   DELETE /trips/:id          — deleteTrip
 *   POST   /trips/:id/submit   — submitTrip
 *   POST   /trips/:id/approve  — approveTrip
 *   POST   /trips/:id/reject   — rejectTrip
 *   POST   /trips/:id/close    — closeTrip
 *
 * Thin wrapper — business logic trong TripService + ApprovalRouter
 * TODO: Implement đầy đủ khi xây dựng Trip feature
 */

import { Request, Response, NextFunction } from 'express';

export async function listTrips(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'listTrips — TODO' });
}

export async function createTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'createTrip — TODO' });
}

export async function getTripById(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'getTripById — TODO' });
}

export async function updateTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'updateTrip — TODO' });
}

export async function deleteTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'deleteTrip — TODO' });
}

export async function submitTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'submitTrip — TODO' });
}

export async function approveTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'approveTrip — TODO' });
}

export async function rejectTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'rejectTrip — TODO' });
}

export async function closeTrip(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'closeTrip — TODO' });
}
