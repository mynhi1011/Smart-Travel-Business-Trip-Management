/**
 * vitest.config.ts — Frontend Test Configuration
 *
 * Kế thừa toàn bộ cấu hình từ vite.config.ts (plugins: react, etc.)
 * để test chạy trong cùng môi trường build với production.
 *
 * Environment: jsdom — giả lập DOM browser cho React component tests
 * Setup: src/__tests__/setup.ts — import @testing-library/jest-dom matchers
 *
 * Sử dụng mergeConfig để KHÔNG duplicate plugin @vitejs/plugin-react:
 *   vite.config.ts có plugin react() → vitest.config merge lại → 1 instance duy nhất
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // jsdom: simulate browser DOM cho React Testing Library
      environment: 'jsdom',

      // Setup file: import @testing-library/jest-dom extend-matchers
      setupFiles: ['./src/__tests__/setup.ts'],

      // Glob: tất cả *.test.tsx và *.test.ts trong src/
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/**', 'dist/**'],

      // Globals: true — dùng describe/it/expect không cần import
      globals: true,

      // Timeout cho mỗi test
      testTimeout: 10000,

      // Reporter: verbose để thấy từng it() trong CI log
      reporter: ['verbose'],

      // Coverage
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/index.css',
          'src/**/__tests__/**',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.d.ts',
        ],
        thresholds: {
          statements: 60,
          branches:   55,
          functions:  60,
          lines:      60,
        },
      },
    },
  })
);
