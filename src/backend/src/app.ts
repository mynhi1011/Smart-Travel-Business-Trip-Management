/**
 * app.ts — Express Application Factory
 *
 * Tạo và cấu hình Express app instance.
 * Tách khỏi server.ts để dễ unit test (import app mà không khởi động HTTP server).
 *
 * Middleware chain (theo thứ tự - architecture.md §5.2):
 *   requestLogger → express.json → cors → helmet → cookie-parser → rateLimiter
 *   → routes (auth public) → authGuard → roleGuard → immutableGuard → controllers
 */

import express, { Application, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { requestLogger } from './middlewares/logger';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found-handler';

// ─── Route Imports (placeholder — sẽ implement ở Bước 6) ────────────────────
import authRouter from './routes/auth.routes';
import tripsRouter from './routes/trips.routes';
import itineraryRouter from './routes/itinerary.routes';
import expensesRouter from './routes/expenses.routes';
import aiRouter from './routes/ai.routes';
import dashboardRouter from './routes/dashboard.routes';
import notificationsRouter from './routes/notifications.routes';
import pdfRouter from './routes/pdf.routes';

// ─── App Factory ─────────────────────────────────────────────────────────────

export function createApp(): Application {
  const app = express();

  // ── 1. Security Headers (helmet trước tất cả) ──────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // cho phép frontend khác origin
      contentSecurityPolicy: false, // tắt CSP cho API server (không serve HTML)
    })
  );

  // ── 2. CORS ────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173').split(',');
  // Luôn cho phép same-origin (full-local mode: frontend served từ Express)
  const port = process.env['PORT'] ?? '5000';
  const sameOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  const allAllowedOrigins = [...new Set([...allowedOrigins, ...sameOrigins])];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Cho phép request không có origin (mobile client, curl, Postman)
        if (!origin || allAllowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked: ${origin}`));
        }
      },
      credentials: true, // Cần thiết cho httpOnly cookie (Refresh Token - architecture.md §6)
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── 3. Body Parsers ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser()); // Parse httpOnly refreshToken cookie

  // ── 4. Request Logger (structured JSON - architecture.md §7) ───────────────
  app.use(requestLogger);

  // ── 5. Global Rate Limiter (NFR-TR-06 — bảo vệ brute force) ───────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 200,                  // max 200 req / window / IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.',
    },
  });
  app.use(globalLimiter);

  // ── 6. Auth Rate Limiter (strict hơn cho login endpoint) ──────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // max 20 lần thử đăng nhập / 15 phút
    message: {
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau.',
    },
  });

  // ── 7. Health Check (public — không cần auth) ──────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'smart-travel-backend',
      version: process.env['npm_package_version'] ?? '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'] ?? 'development',
    });
  });

  // ── 8. API Routes (/api/v1/*) ──────────────────────────────────────────────
  // Auth routes — public (với authLimiter riêng)
  app.use('/api/v1/auth', authLimiter, authRouter);

  // Protected routes — authGuard được apply bên trong từng router
  app.use('/api/v1/trips', tripsRouter);
  app.use('/api/v1/trips', itineraryRouter);   // /api/v1/trips/:id/itinerary
  app.use('/api/v1/trips', expensesRouter);    // /api/v1/trips/:id/expense
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/trips', pdfRouter);         // /api/v1/trips/:id/export-pdf

  // ── 9. Frontend SPA (full-local: http://localhost:5000) ───────────────────
  // API routes luôn được đăng ký trước static middleware để không bị SPA fallback.
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  const frontendIndex = path.join(frontendDist, 'index.html');
  if (existsSync(frontendIndex)) {
    app.use(express.static(frontendDist));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') {
        next();
        return;
      }
      res.sendFile(frontendIndex, (err) => {
        if (err) next(err);
      });
    });
  }

  // ── 10. 404 Handler ────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── 11. Global Error Handler (phải là middleware cuối cùng) ────────────────
  app.use(errorHandler);

  return app;
}
