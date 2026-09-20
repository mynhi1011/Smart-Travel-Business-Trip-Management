/**
 * vitest.config.mts — Backend Test Configuration
 *
 * Dùng extension .mts (ESM TypeScript) vì vitest config cần ESM syntax
 * trong khi backend sử dụng "module": "CommonJS" trong tsconfig.json.
 * .mts được Vitest load natively dưới dạng ES Module.
 *
 * Environment: node — backend không cần DOM
 * Pool: forks — mỗi test file chạy trong process riêng, ngăn state leak
 * Setup: src/__tests__/setup.ts — set ENV vars trước mỗi suite
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Chạy trong Node environment — không cần browser/DOM
    environment: 'node',

    // Mỗi file test chạy trong process riêng biệt
    // Ngăn global state (Prisma singleton, env vars) bị leak giữa suites
    pool: 'forks',

    // Global setup: set process.env cho test environment
    setupFiles: ['./src/__tests__/setup.ts'],

    // Glob: unit tests trong src/ VÀ tests/unit/ (Task 4 output)
    include: [
      'src/**/*.test.ts',
      'src/**/*.api.test.ts',
      '../../tests/unit/**/*.test.ts',
    ],

    // Bỏ qua dist/ và node_modules/
    exclude: ['dist/**', 'node_modules/**'],

    // Timeout cho mỗi test (ms) — API test có thể chậm hơn unit test
    testTimeout: 15000,
    hookTimeout: 10000,

    // Globals: true — dùng describe/it/expect không cần import tường minh
    globals: true,

    // Coverage — chạy bằng: npm run test:coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/controllers/**/*.ts',
        'src/middlewares/**/*.ts',
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/server.ts',
        'src/app.ts',
        'src/prisma/**',
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.api.test.ts',
      ],
      // Ngưỡng tối thiểu — build fail nếu dưới (test-strategy.md §10)
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },

  resolve: {
    alias: {
      // Alias @ → src/ để import ngắn gọn trong test files
      '@': path.resolve(__dirname, './src'),
    },
  },
});
