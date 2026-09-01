/**
 * trips.routes.ts — Trip Request CRUD & Action Routes
 * GET    /api/v1/trips
 * POST   /api/v1/trips
 * GET    /api/v1/trips/:id
 * PUT    /api/v1/trips/:id
 * DELETE /api/v1/trips/:id
 * POST   /api/v1/trips/:id/submit
 * POST   /api/v1/trips/:id/approve
 * POST   /api/v1/trips/:id/reject
 * POST   /api/v1/trips/:id/close
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET /trips — coming soon' });
});

router.post('/', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST /trips — coming soon' });
});

router.get('/:id', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET /trips/:id — coming soon' });
});

router.put('/:id', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'PUT /trips/:id — coming soon' });
});

router.delete('/:id', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'DELETE /trips/:id — coming soon' });
});

router.post('/:id/submit', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST /trips/:id/submit — coming soon' });
});

router.post('/:id/approve', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST /trips/:id/approve — coming soon' });
});

router.post('/:id/reject', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST /trips/:id/reject — coming soon' });
});

router.post('/:id/close', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST /trips/:id/close — coming soon' });
});

export default router;
