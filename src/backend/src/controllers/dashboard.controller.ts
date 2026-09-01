/**
 * dashboard.controller.ts — Dashboard Controller
 *
 * Handles: GET /dashboard
 * Trả về data phân quyền theo role (Employee/Manager/Admin/Finance view)
 * TODO: Implement đầy đủ khi xây dựng Dashboard feature
 */

import { Request, Response, NextFunction } from 'express';

export async function getDashboard(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'getDashboard — TODO' });
}
