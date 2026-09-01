/**
 * expenses.routes.ts — Expense Claim Routes
 * GET    /api/v1/trips/:id/expenses
 * POST   /api/v1/trips/:id/expenses
 * POST   /api/v1/trips/:id/expenses/submit
 * POST   /api/v1/trips/:id/expenses/approve
 * POST   /api/v1/trips/:id/expenses/reject
 * POST   /api/v1/trips/:id/expenses/reapprove
 * POST   /api/v1/trips/:id/expenses/items
 * PUT    /api/v1/trips/:id/expenses/items/:itemId
 * DELETE /api/v1/trips/:id/expenses/items/:itemId
 *
 * TODO: Implement controllers ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/:id/expenses', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET expenses — coming soon' });
});

router.post('/:id/expenses', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expenses — coming soon' });
});

router.post('/:id/expenses/submit', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expenses/submit — coming soon' });
});

router.post('/:id/expenses/approve', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expenses/approve — coming soon' });
});

router.post('/:id/expenses/reject', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expenses/reject — coming soon' });
});

router.post('/:id/expenses/reapprove', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expenses/reapprove — coming soon' });
});

router.post('/:id/expenses/items', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'POST expense items — coming soon' });
});

router.put('/:id/expenses/items/:itemId', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'PUT expense item — coming soon' });
});

router.delete('/:id/expenses/items/:itemId', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'DELETE expense item — coming soon' });
});

export default router;
