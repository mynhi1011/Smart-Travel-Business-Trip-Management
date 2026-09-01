/**
 * itinerary.controller.ts — Itinerary Item Controller
 *
 * Handles:
 *   GET    /trips/:id/itinerary          — getItinerary
 *   POST   /trips/:id/itinerary          — addItineraryItem
 *   PUT    /trips/:id/itinerary/:itemId  — updateItineraryItem
 *   DELETE /trips/:id/itinerary/:itemId  — deleteItineraryItem
 *
 * TODO: Implement đầy đủ khi xây dựng Itinerary feature
 */

import { Request, Response, NextFunction } from 'express';

export async function getItinerary(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'getItinerary — TODO' });
}

export async function addItineraryItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'addItineraryItem — TODO' });
}

export async function updateItineraryItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'updateItineraryItem — TODO' });
}

export async function deleteItineraryItem(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'deleteItineraryItem — TODO' });
}
