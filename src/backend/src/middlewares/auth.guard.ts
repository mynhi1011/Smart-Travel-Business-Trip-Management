/**
 * auth.guard.ts — JWT Authentication Middleware
 *
 * Xác thực JWT Access Token từ Authorization header.
 * Gắn req.user = { id, role, name } sau khi verify thành công.
 *
 * Thứ tự trong middleware chain: sau requestLogger, trước roleGuard
 * Tài liệu tham chiếu: architecture.md §6, API.md §2
 *
 * JWT Payload format (architecture.md §6.1):
 *   { sub: userId, role, name, iat, exp }
 *
 * Error mapping (API.md §3):
 *   - Thiếu/sai format header  → 401 UNAUTHORIZED
 *   - Token hết hạn            → 401 TOKEN_EXPIRED  (client tự refresh)
 *   - Token sai chữ ký/corrupt → 401 INVALID_TOKEN
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Errors } from './error-handler';
import type { JwtPayload } from '../services/auth.service';

// ─── Express Request Extension ────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        name: string;
      };
    }
  }
}

// ─── authGuard ────────────────────────────────────────────────────────────────

/**
 * authGuard — Verify JWT Access Token
 *
 * Bắt buộc apply trên tất cả protected routes.
 * Routes public (login, refresh, health) KHÔNG dùng middleware này.
 */
export function authGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // 1. Extract token từ "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(Errors.UNAUTHORIZED());
    return;
  }

  const token = authHeader.slice(7); // Bỏ "Bearer " prefix
  if (!token) {
    next(Errors.UNAUTHORIZED());
    return;
  }

  // 2. Verify JWT
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) {
    // Lỗi cấu hình server — không expose ra client
    next(new Error('JWT_ACCESS_SECRET không được cấu hình'));
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    // 3. Gắn req.user từ payload
    req.user = {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
    };

    next();
  } catch (err) {
    // 4. Xử lý lỗi JWT theo spec API.md §3
    if (err instanceof jwt.TokenExpiredError) {
      // Token hết hạn → client tự gọi /auth/refresh rồi retry
      next(Errors.TOKEN_EXPIRED());
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      // Sai chữ ký, sai format, bị tamper
      next(Errors.INVALID_TOKEN());
      return;
    }

    // Lỗi không xác định
    next(Errors.UNAUTHORIZED());
  }
}
