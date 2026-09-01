/**
 * client.ts — Prisma Client Singleton
 *
 * Đảm bảo chỉ có một PrismaClient instance trong toàn bộ ứng dụng.
 * Trong development (với tsx watch / hot-reload), tránh tạo nhiều connection pool.
 *
 * Pattern: global singleton — https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client';

// Khai báo global để giữ instance qua hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
