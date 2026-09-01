/**
 * server.ts — HTTP Server Entry Point
 *
 * Khởi động Express HTTP server.
 * Load .env → validate env vars → tạo app → listen.
 *
 * Chạy: npm run dev  (tsx watch src/server.ts)
 *        npm start   (node dist/server.js)
 */

import 'dotenv/config';
import { createApp } from './app';

// ─── Environment Validation ───────────────────────────────────────────────────

function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      JSON.stringify({
        level: 'FATAL',
        message: 'Missing required environment variables',
        missing,
        timestamp: new Date().toISOString(),
      })
    );
    process.exit(1);
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  validateEnv();

  const app = createApp();
  const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
  const HOST = process.env['HOST'] ?? 'localhost';

  const server = app.listen(PORT, HOST, () => {
    console.log(
      JSON.stringify({
        level: 'INFO',
        message: 'Server started',
        host: HOST,
        port: PORT,
        environment: process.env['NODE_ENV'] ?? 'development',
        timestamp: new Date().toISOString(),
      })
    );
  });

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    console.log(
      JSON.stringify({
        level: 'INFO',
        message: `Received ${signal}. Shutting down gracefully...`,
        timestamp: new Date().toISOString(),
      })
    );

    server.close(() => {
      console.log(
        JSON.stringify({
          level: 'INFO',
          message: 'HTTP server closed',
          timestamp: new Date().toISOString(),
        })
      );
      process.exit(0);
    });

    // Force exit sau 10s nếu connections chưa đóng hết
    setTimeout(() => {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          message: 'Forced shutdown after timeout',
          timestamp: new Date().toISOString(),
        })
      );
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ── Unhandled Error Safety Nets ─────────────────────────────────────────────
  process.on('uncaughtException', (err: Error) => {
    console.error(
      JSON.stringify({
        level: 'FATAL',
        message: 'Uncaught Exception',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      })
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error(
      JSON.stringify({
        level: 'FATAL',
        message: 'Unhandled Promise Rejection',
        reason: String(reason),
        timestamp: new Date().toISOString(),
      })
    );
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
