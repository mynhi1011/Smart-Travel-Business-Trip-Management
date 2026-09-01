/**
 * ai.routes.ts — AI Itinerary Generation Route
 * POST /api/v1/ai/generate-itinerary
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.post('/generate-itinerary', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'AI generate-itinerary — coming soon' });
});

export default router;
