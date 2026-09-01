/**
 * notification.controller.ts — Notification Controller
 *
 * Handles:
 *   GET   /notifications/stream  — streamNotifications (SSE)
 *   GET   /notifications          — listNotifications
 *   PATCH /notifications/:id/read — markAsRead
 *
 * TODO: Implement SSE emitter ở lib/sse-emitter.ts
 */

import { Request, Response, NextFunction } from 'express';

export async function streamNotifications(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'SSE stream — TODO' });
}

export async function listNotifications(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'listNotifications — TODO' });
}

export async function markAsRead(
  _req: Request, res: Response, _next: NextFunction
): Promise<void> {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'markAsRead — TODO' });
}
