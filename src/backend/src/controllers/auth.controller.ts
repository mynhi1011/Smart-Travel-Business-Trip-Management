/**
 * auth.controller.ts — Authentication Controller
 *
 * Handles: POST /auth/login, POST /auth/refresh, POST /auth/logout
 * Thin wrapper — business logic nằm trong AuthService
 * TODO: Implement đầy đủ khi xây dựng Auth feature
 */

import { Request, Response, NextFunction } from 'express';

export async function login(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'login controller — TODO' });
}

export async function refresh(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'refresh controller — TODO' });
}

export async function logout(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'logout controller — TODO' });
}
