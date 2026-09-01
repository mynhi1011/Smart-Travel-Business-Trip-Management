/**
 * logger.ts — Structured JSON Request Logger
 *
 * Ghi log mọi HTTP request theo chuẩn JSON (architecture.md §7 — Structured Logging).
 * Log format: { level, method, path, statusCode, durationMs, ip, userId, requestId, timestamp }
 *
 * Nguyên tắc: KHÔNG log request body (tránh leak dữ liệu nhạy cảm như password, token).
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type để thêm requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Gắn requestId vào mỗi request để trace log
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Ghi log khi response kết thúc (có status code và duration)
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const userId = (req as Request & { user?: { id: string } }).user?.id ?? null;

    const logEntry = {
      level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip ?? req.socket.remoteAddress,
      userId,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
