/**
 * auth.guard.test.ts — Unit Tests: authGuard middleware
 *
 * Kiểm thử authGuard trong isolation — không cần Express app, không cần DB.
 * Dùng mock Request/Response/NextFunction để simulate middleware chain.
 *
 * Coverage targets (test-strategy.md §10):
 *   - Tất cả nhánh: missing header, wrong prefix, valid token, expired, tampered
 *   - 100% function coverage cho authGuard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authGuard } from './auth.guard';
import { AppError } from './error-handler';

// ─── Mock jsonwebtoken ─────────────────────────────────────────────────────────
vi.mock('jsonwebtoken');

// ─── Mock Express Request/Response/NextFunction ───────────────────────────────

/**
 * createMockRequest — Tạo mock Express Request
 * Cho phép set bất kỳ property nào cần test
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

/**
 * createMockNext — Tạo mock NextFunction
 * Dùng vi.fn() để assert số lần gọi và arguments
 */
function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Đảm bảo JWT_ACCESS_SECRET luôn set (setup.ts đã set nhưng double-check)
  process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-do-not-use-in-prod';
});

// ══════════════════════════════════════════════════════════════════════════════
// authGuard — Unit Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('authGuard middleware', () => {

  // ── Happy Path: token hợp lệ ────────────────────────────────────────────────
  describe('[HAPPY] token hợp lệ', () => {

    it('gắn req.user từ JWT payload và gọi next() không có error', () => {
      // Arrange: jwt.verify trả về payload hợp lệ
      const mockPayload = {
        sub: 'user-001',
        role: 'EMPLOYEE',
        name: 'Nguyễn Văn Test',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      vi.mocked(jwt.verify).mockReturnValueOnce(mockPayload as never);

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Act
      authGuard(req, res, next);

      // Assert: next() được gọi không có argument (không phải error)
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(); // no args = success

      // Assert: req.user được gắn đúng từ payload
      expect(req.user).toEqual({
        id: 'user-001',
        role: 'EMPLOYEE',
        name: 'Nguyễn Văn Test',
      });
    });

    it('jwt.verify được gọi với đúng token và secret', () => {
      const mockPayload = {
        sub: 'user-002', role: 'MANAGER', name: 'Manager Test',
        iat: 0, exp: 9999999999,
      };
      vi.mocked(jwt.verify).mockReturnValueOnce(mockPayload as never);

      const req = createMockRequest({
        headers: { authorization: 'Bearer my.specific.token' },
      });

      authGuard(req, createMockResponse(), createMockNext());

      expect(jwt.verify).toHaveBeenCalledWith(
        'my.specific.token',
        'test-jwt-access-secret-do-not-use-in-prod'
      );
    });

  });

  // ── Failure Path: Auth header ────────────────────────────────────────────────
  describe('[AUTH] thiếu hoặc sai Authorization header', () => {

    it('401 UNAUTHORIZED — không có Authorization header', () => {
      const req = createMockRequest({ headers: {} });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      // Assert: next() được gọi với AppError 401
      expect(next).toHaveBeenCalledOnce();
      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');

      // Assert: req.user không được set
      expect(req.user).toBeUndefined();
    });

    it('401 UNAUTHORIZED — Authorization header tồn tại nhưng không có "Bearer " prefix', () => {
      const req = createMockRequest({
        headers: { authorization: 'Token some.token.here' }, // sai prefix
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');
    });

    it('401 UNAUTHORIZED — Authorization header là "Bearer " (không có token)', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer ' }, // chỉ prefix, không có token
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

  });

  // ── Failure Path: JWT errors ───────────────────────────────────────────────
  describe('[AUTH] JWT verification errors', () => {

    it('401 TOKEN_EXPIRED — jwt.verify throw TokenExpiredError', () => {
      // Arrange: simulate TokenExpiredError
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        const err = new jwt.TokenExpiredError('jwt expired', new Date());
        throw err;
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer expired.jwt.token' },
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('TOKEN_EXPIRED');
    });

    it('401 INVALID_TOKEN — jwt.verify throw JsonWebTokenError (sai chữ ký)', () => {
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer tampered.jwt.token' },
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('INVALID_TOKEN');
    });

    it('401 UNAUTHORIZED — jwt.verify throw lỗi không xác định', () => {
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new Error('unknown error');
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer some.token' },
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

  });

  // ── Edge case: JWT_ACCESS_SECRET chưa được cấu hình ──────────────────────
  describe('[CONFIG] thiếu JWT_ACCESS_SECRET', () => {

    it('500 — server error khi JWT_ACCESS_SECRET không được set', () => {
      const original = process.env['JWT_ACCESS_SECRET'];
      delete process.env['JWT_ACCESS_SECRET'];

      const req = createMockRequest({
        headers: { authorization: 'Bearer some.token' },
      });
      const next = createMockNext();

      authGuard(req, createMockResponse(), next);

      // Restore
      process.env['JWT_ACCESS_SECRET'] = original;

      // Assert: next() được gọi với Error (không phải AppError có errorCode)
      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
    });

  });

});
