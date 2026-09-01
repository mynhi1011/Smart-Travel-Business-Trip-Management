/**
 * dashboard.routes.ts — Dashboard Route
 * GET /api/v1/dashboard
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET /dashboard — coming soon' });
});

export default router;
