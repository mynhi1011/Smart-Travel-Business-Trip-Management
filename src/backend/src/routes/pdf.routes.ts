/**
 * pdf.routes.ts — PDF Export Route
 * GET /api/v1/trips/:id/export-pdf
 *
 * TODO: Implement PDFService ở Bước 6
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/:id/export-pdf', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'GET /trips/:id/export-pdf — coming soon' });
});

export default router;
