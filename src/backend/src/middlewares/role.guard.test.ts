/**
 * role.guard.test.ts — Unit Tests: roleGuard middleware
 *
 * Kiểm thử RBAC role checking trong isolation.
 * roleGuard là factory function — trả về middleware dựa trên allowedRoles.
 *
 * Test matrix:
 *   - Happy: role hợp lệ → next() không error
 *   - Fail: role không được phép → 403 FORBIDDEN
 *   - Fail: req.user chưa được set (authGuard chưa chạy) → 401 UNAUTHORIZED
 *   - Edge: mảng roles rỗng → mọi user đều bị từ chối
 *   - Edge: nhiều roles được phép → test từng role
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { roleGuard, type UserRole } from './role.guard';
import { AppError } from './error-handler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockRequest(user?: { id: string; role: string; name: string }): Request {
  return { user } as unknown as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// roleGuard — Unit Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('roleGuard middleware factory', () => {

  // ── Happy Path: role được phép ────────────────────────────────────────────
  describe('[HAPPY] role nằm trong allowedRoles', () => {

    it('EMPLOYEE được phép → gọi next() không có error', () => {
      const middleware = roleGuard(['EMPLOYEE']);
      const req = createMockRequest({ id: 'u1', role: 'EMPLOYEE', name: 'Test' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(); // không truyền error
    });

    it('MANAGER được phép khi allowedRoles = [MANAGER, TRAVEL_ADMIN]', () => {
      const middleware = roleGuard(['MANAGER', 'TRAVEL_ADMIN']);
      const req = createMockRequest({ id: 'u2', role: 'MANAGER', name: 'Manager' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });

    it('TRAVEL_ADMIN được phép khi allowedRoles = [MANAGER, TRAVEL_ADMIN]', () => {
      const middleware = roleGuard(['MANAGER', 'TRAVEL_ADMIN']);
      const req = createMockRequest({ id: 'u3', role: 'TRAVEL_ADMIN', name: 'Admin' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });

    it('FINANCE được phép khi allowedRoles = [FINANCE]', () => {
      const middleware = roleGuard(['FINANCE']);
      const req = createMockRequest({ id: 'u4', role: 'FINANCE', name: 'Finance' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });

  });

  // ── Failure Path: role không được phép ───────────────────────────────────
  describe('[AUTH] role không nằm trong allowedRoles → 403 FORBIDDEN', () => {

    it('EMPLOYEE cố truy cập route chỉ dành cho MANAGER → 403 FORBIDDEN', () => {
      const middleware = roleGuard(['MANAGER', 'TRAVEL_ADMIN']);
      const req = createMockRequest({ id: 'u5', role: 'EMPLOYEE', name: 'Employee' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

    it('EMPLOYEE cố gọi route close (FINANCE only) → 403 FORBIDDEN', () => {
      const middleware = roleGuard(['FINANCE']);
      const req = createMockRequest({ id: 'u6', role: 'EMPLOYEE', name: 'Employee' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

    it('MANAGER cố tạo trip (EMPLOYEE only) → 403 FORBIDDEN', () => {
      const middleware = roleGuard(['EMPLOYEE']);
      const req = createMockRequest({ id: 'u7', role: 'MANAGER', name: 'Manager' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });

    it('FINANCE không approve được (MANAGER/TRAVEL_ADMIN only) → 403 FORBIDDEN', () => {
      const middleware = roleGuard(['MANAGER', 'TRAVEL_ADMIN']);
      const req = createMockRequest({ id: 'u8', role: 'FINANCE', name: 'Finance' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

  });

  // ── Failure Path: req.user chưa được set ─────────────────────────────────
  describe('[AUTH] req.user chưa set (authGuard chưa chạy) → 401 UNAUTHORIZED', () => {

    it('req.user = undefined → 401 UNAUTHORIZED', () => {
      const middleware = roleGuard(['EMPLOYEE']);
      const req = createMockRequest(undefined); // không có user
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');
    });

  });

  // ── Edge Case: allowedRoles rỗng ──────────────────────────────────────────
  describe('[EDGE] allowedRoles = [] — không ai được phép', () => {

    it('allowedRoles rỗng → mọi role đều bị 403 FORBIDDEN', () => {
      const roles: UserRole[] = [];
      const middleware = roleGuard(roles);
      const req = createMockRequest({ id: 'u9', role: 'ADMIN', name: 'Admin' });
      const next = createMockNext();

      middleware(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });

  });

  // ── Permission Matrix: bám theo trips.routes.ts ───────────────────────────
  describe('[MATRIX] permission matrix theo trips.routes.ts', () => {

    // router.post('/', authGuard, roleGuard(['EMPLOYEE']), createTrip)
    it('chỉ EMPLOYEE được tạo trip (POST /trips)', () => {
      const allowedForCreate: UserRole[] = ['EMPLOYEE'];
      const notAllowed: UserRole[] = ['MANAGER', 'TRAVEL_ADMIN', 'FINANCE', 'ADMIN'];

      for (const role of notAllowed) {
        const middleware = roleGuard(allowedForCreate);
        const req = createMockRequest({ id: 'u', role, name: 'User' });
        const next = createMockNext();
        middleware(req, createMockResponse(), next);
        const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(err.statusCode, `Role ${role} should be 403`).toBe(403);
      }
    });

    // router.post('/:id/approve', authGuard, roleGuard(['MANAGER', 'TRAVEL_ADMIN']), approveTrip)
    it('chỉ MANAGER và TRAVEL_ADMIN được approve (POST /trips/:id/approve)', () => {
      const allowedForApprove: UserRole[] = ['MANAGER', 'TRAVEL_ADMIN'];
      const notAllowed: UserRole[] = ['EMPLOYEE', 'FINANCE'];

      for (const role of notAllowed) {
        const middleware = roleGuard(allowedForApprove);
        const req = createMockRequest({ id: 'u', role, name: 'User' });
        const next = createMockNext();
        middleware(req, createMockResponse(), next);
        const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(err.statusCode, `Role ${role} should be 403`).toBe(403);
      }
    });

    // router.post('/:id/close', authGuard, roleGuard(['FINANCE']), closeTrip)
    it('chỉ FINANCE được close trip (POST /trips/:id/close)', () => {
      const allowedForClose: UserRole[] = ['FINANCE'];
      const notAllowed: UserRole[] = ['EMPLOYEE', 'MANAGER', 'TRAVEL_ADMIN'];

      for (const role of notAllowed) {
        const middleware = roleGuard(allowedForClose);
        const req = createMockRequest({ id: 'u', role, name: 'User' });
        const next = createMockNext();
        middleware(req, createMockResponse(), next);
        const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(err.statusCode, `Role ${role} should be 403`).toBe(403);
      }
    });

  });

});
