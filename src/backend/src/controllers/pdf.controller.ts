/**
 * pdf.controller.ts — PDF Export Controller
 *
 * Handles: GET /trips/:id/export-pdf
 * Chỉ cho phép khi trip.status IN (APPROVED, CLOSED)
 * TODO: Implement PDFService ở lib/pdf-generator.ts
 */

import { Request, Response, NextFunction } from 'express';

export async function exportTripPdf(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'exportTripPdf — TODO' });
}
