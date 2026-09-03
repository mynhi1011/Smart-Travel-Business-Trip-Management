import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import * as sseEmitter from '../lib/sse-emitter';
import { Errors } from '../middlewares/error-handler';
import { sendSuccess } from '../utils/response.utils';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../services/auth.service';

// ─── GET /notifications ───────────────────────────────────────────────────────
export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const page    = parseInt(req.query['page']   as string) || 1;
    const limit   = Math.min(100, parseInt(req.query['limit'] as string) || 20);
    const isRead  = req.query['isRead'] === 'false' ? false : req.query['isRead'] === 'true' ? true : undefined;
    const skip    = (page - 1) * limit;

    const where: Record<string, unknown> = { recipientId: req.user.id };
    if (isRead !== undefined) where['isRead'] = isRead;

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientId: req.user.id, isRead: false } }),
    ]);

    res.status(200).json({
      data: items,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /notifications/:id/read ───────────────────────────────────────────
export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const notif = await prisma.notification.findFirst({
      where: { id: req.params['notificationId'] ?? '', recipientId: req.user.id },
    });
    if (!notif) { next(Errors.NOT_FOUND('notification')); return; }

    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: { isRead: true, readAt: new Date() },
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
}

// ─── PATCH /notifications/read-all ───────────────────────────────────────────
export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const result = await prisma.notification.updateMany({
      where: { recipientId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    sendSuccess(res, { updatedCount: result.count });
  } catch (err) { next(err); }
}

// ─── GET /notifications/stream (SSE) ─────────────────────────────────────────
// EventSource không support Authorization header → token via query param
export async function streamNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verify token from ?token=<accessToken>
    const token  = req.query['token'] as string | undefined;
    if (!token) { res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token required' }); return; }

    const secret = process.env['JWT_ACCESS_SECRET'];
    if (!secret) { next(new Error('JWT_ACCESS_SECRET not configured')); return; }

    let userId: string;
    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token invalid or expired' });
      return;
    }

    // Register SSE client
    sseEmitter.addClient(userId, res);

    // Send ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      } catch {
        clearInterval(pingInterval);
      }
    }, 30_000);

    req.on('close', () => clearInterval(pingInterval));
  } catch (err) { next(err); }
}
