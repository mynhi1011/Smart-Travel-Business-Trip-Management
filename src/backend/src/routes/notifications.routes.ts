/**
 * notifications.routes.ts — SSE Notifications Route
 * GET /api/v1/notifications/stream  (Server-Sent Events)
 * GET /api/v1/notifications         (List notifications)
 * PATCH /api/v1/notifications/:id/read
 *
 * TODO: Implement SSE emitter ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/stream', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'SSE /notifications/stream — coming soon' });
});

router.get('/', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET /notifications — coming soon' });
});

router.patch('/:id/read', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'PATCH notification read — coming soon' });
});

export default router;
