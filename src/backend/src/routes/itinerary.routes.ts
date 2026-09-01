/**
 * itinerary.routes.ts — Itinerary Item CRUD Routes
 * GET    /api/v1/trips/:id/itinerary
 * POST   /api/v1/trips/:id/itinerary
 * PUT    /api/v1/trips/:id/itinerary/:itemId
 * DELETE /api/v1/trips/:id/itinerary/:itemId
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/:id/itinerary', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET itinerary — coming soon' });
});

router.post('/:id/itinerary', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST itinerary — coming soon' });
});

router.put('/:id/itinerary/:itemId', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'PUT itinerary item — coming soon' });
});

router.delete('/:id/itinerary/:itemId', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'DELETE itinerary item — coming soon' });
});

export default router;
