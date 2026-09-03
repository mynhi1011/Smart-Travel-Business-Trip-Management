/**
 * auth.routes.ts — Authentication Routes
 *
 * POST   /api/v1/auth/login    — Public — đăng nhập
 * POST   /api/v1/auth/refresh  — Public — làm mới access token (dùng cookie)
 * DELETE /api/v1/auth/logout   — Protected — đăng xuất, revoke refresh token
 * GET    /api/v1/auth/me       — Protected (ALL roles) — lấy thông tin user
 *
 * Tài liệu tham chiếu: API.md §4, architecture.md §6
 */

import { Router } from 'express';
import { login, refresh, logout, me } from '../controllers/auth.controller';
import { authGuard } from '../middlewares/auth.guard';

const router = Router();

// ── Public routes (không cần token) ──────────────────────────────────────────
router.post('/login', login);
router.post('/refresh', refresh);

// ── Protected routes (cần token) ─────────────────────────────────────────────
router.delete('/logout', authGuard, logout);
router.get('/me', authGuard, me);

export default router;
