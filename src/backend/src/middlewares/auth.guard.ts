/**
 * auth.guard.ts — JWT Authentication Middleware
 *
 * Xác thực JWT Access Token từ Authorization header.
 * Gắn req.user = { id, role, name } sau khi verify thành công.
 *
 * Thứ tự trong middleware chain: sau requestLogger, trước roleGuard
 * Tài liệu tham chiếu: architecture.md §6, API.md §2
 *
 * TODO: Implement JWT verify logic khi xây dựng Auth feature
 */

import { Request, Response, NextFunction } from 'express';
import { Errors } from './error-handler';

// Extend Express Request để thêm user payload
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

/**
 * authGuard — Verify JWT Access Token
 * Reject với 401 nếu token không hợp lệ hoặc đã hết hạn.
 *
 * JWT Payload format (architecture.md §6.1):
 *   { sub: userId, role, name, iat, exp }
 */
export function authGuard(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // TODO: Implement JWT verification
  // 1. Extract token từ "Authorization: Bearer <token>"
  // 2. Verify bằng jsonwebtoken với JWT_ACCESS_SECRET
  // 3. Gắn req.user = { id: payload.sub, role: payload.role, name: payload.name }
  // 4. Xử lý TokenExpiredError → throw Errors.TOKEN_EXPIRED()
  //    JsonWebTokenError → throw Errors.INVALID_TOKEN()

  // Placeholder — sẽ replace khi implement Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(Errors.UNAUTHORIZED());
    return;
  }

  // Stub: chỉ pass qua để server boot được — sẽ implement đầy đủ ở Auth feature
  // ⚠️ KHÔNG dùng stub này trong production
  next(Errors.UNAUTHORIZED());
}
