/**
 * role.guard.ts — RBAC Role Authorization Middleware
 *
 * Kiểm tra req.user.role có nằm trong danh sách roles được phép không.
 * Phải chạy SAU authGuard (cần req.user đã được set).
 *
 * Tài liệu tham chiếu: architecture.md §6, API.md §2.3 Role Permission Matrix
 *
 * Sử dụng:
 *   router.post('/trips/:id/approve', authGuard, roleGuard(['MANAGER']), approveTrip)
 */

import { Request, Response, NextFunction } from 'express';
import { Errors } from './error-handler';

// Các UserRole hợp lệ theo data-model.md §4
export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'TRAVEL_ADMIN' | 'FINANCE' | 'ADMIN';

/**
 * roleGuard — Factory middleware kiểm tra role
 * @param allowedRoles - Mảng roles được phép truy cập route
 */
export function roleGuard(allowedRoles: UserRole[]) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user) {
      // authGuard chưa chạy hoặc bị bỏ qua
      next(Errors.UNAUTHORIZED());
      return;
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      next(Errors.FORBIDDEN());
      return;
    }

    next();
  };
}
