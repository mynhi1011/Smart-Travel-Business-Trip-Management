/**
 * auth.routes.ts — Authentication Routes
 * POST /api/v1/auth/login
 * POST /api/v1/auth/refresh
 * POST /api/v1/auth/logout
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder — sẽ replace bằng controller thật ở Bước 6
router.post('/login', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Auth login — coming soon' });
});

router.post('/refresh', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Auth refresh — coming soon' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Auth logout — coming soon' });
});

export default router;
