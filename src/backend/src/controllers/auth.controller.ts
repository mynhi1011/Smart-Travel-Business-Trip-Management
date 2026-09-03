/**
 * auth.controller.ts — Authentication Controller
 *
 * Thin wrapper — delegate toàn bộ business logic sang auth.service.ts.
 *
 * Handles:
 *   POST   /api/v1/auth/login    — đăng nhập, cấp JWT + httpOnly cookie
 *   POST   /api/v1/auth/refresh  — cấp access token mới từ refresh token cookie
 *   DELETE /api/v1/auth/logout   — revoke refresh token, clear cookie
 *   GET    /api/v1/auth/me       — lấy thông tin user hiện tại
 *
 * Tài liệu tham chiếu: API.md §4, architecture.md §6
 *
 * Cookie spec (API.md §2.2):
 *   - httpOnly: true — không thể đọc từ JS
 *   - sameSite: 'strict' — chống CSRF
 *   - secure: true trong production
 *   - maxAge: 7 ngày (ms)
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { Errors } from '../middlewares/error-handler';

// ─── Cookie Config ────────────────────────────────────────────────────────────

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
  });
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự'),
  password: z
    .string({ required_error: 'Password là bắt buộc' })
    .min(8, 'Password tối thiểu 8 ký tự')
    .max(128, 'Password tối đa 128 ký tự'),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * login — POST /api/v1/auth/login (Public)
 *
 * Response 200:
 *   Body: { accessToken, tokenType, expiresIn, user }
 *   Cookie: refreshToken (httpOnly, SameSite=Strict)
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate input
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(Errors.VALIDATION_ERROR(parsed.error.flatten() as Record<string, unknown>));
      return;
    }

    const { email, password } = parsed.data;
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? undefined;

    // Gọi service
    const result = await authService.login(email, password, ipAddress);

    // Set httpOnly cookie cho refresh token
    setRefreshCookie(res, result.rawRefreshToken);

    // Trả response — KHÔNG include rawRefreshToken trong body
    res.status(200).json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * refresh — POST /api/v1/auth/refresh (Public — dùng cookie)
 *
 * Response 200: { accessToken, tokenType, expiresIn }
 */
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Đọc refresh token từ httpOnly cookie
    const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
    if (!rawRefreshToken) {
      next(Errors.UNAUTHORIZED());
      return;
    }

    const result = await authService.refreshAccessToken(rawRefreshToken);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * logout — DELETE /api/v1/auth/logout (Protected)
 *
 * Response 204: No Content
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;

    if (rawRefreshToken) {
      // Revoke refresh token trong DB
      await authService.logout(rawRefreshToken, req.user?.id);
    }

    // Clear cookie dù token có tồn tại hay không (idempotent)
    clearRefreshCookie(res);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * me — GET /api/v1/auth/me (Protected — ALL roles)
 *
 * Response 200: User object đầy đủ
 */
export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      next(Errors.UNAUTHORIZED());
      return;
    }

    const user = await authService.getMe(req.user.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}
