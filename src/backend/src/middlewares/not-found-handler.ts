/**
 * not-found-handler.ts — 404 Handler
 *
 * Xử lý tất cả route không tồn tại, trả về 404 theo Error Response chuẩn.
 */

import { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'ROUTE_NOT_FOUND',
    message: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
    details: {},
    requestId: req.requestId ?? 'unknown',
  });
}
