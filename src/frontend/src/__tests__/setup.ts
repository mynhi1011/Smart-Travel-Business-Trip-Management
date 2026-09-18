/**
 * setup.ts — Global Test Setup for Frontend
 *
 * Được Vitest load qua setupFiles trong vitest.config.ts.
 * Trách nhiệm chính: import @testing-library/jest-dom để extend
 * expect() với các DOM matchers như toBeInTheDocument(), toHaveValue(), etc.
 *
 * Sau khi import này, tất cả test files có thể dùng:
 *   expect(element).toBeInTheDocument()
 *   expect(input).toHaveValue('text')
 *   expect(button).toBeDisabled()
 *   expect(element).toHaveTextContent('...')
 *   v.v.
 */

import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── Auto-cleanup sau mỗi test ────────────────────────────────────────────────
// Unmount React tree để tránh memory leak và state leak giữa các test.
// RTL v13+ có auto-cleanup nhưng explicit vẫn tốt hơn để rõ ràng.
afterEach(() => {
  cleanup();
});

// ─── Mock import.meta.env (Vite env vars) ────────────────────────────────────
// jsdom không cung cấp import.meta.env — cần set thủ công.
// services/api.ts dùng VITE_API_BASE_URL — phải mock để test không throw.
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE_URL: 'http://localhost:5000/api/v1',
    MODE: 'test',
    DEV: false,
    PROD: false,
  },
  writable: true,
});

// ─── Mock EventSource (SSE) ───────────────────────────────────────────────────
// jsdom không implement EventSource — component dùng SSE sẽ throw nếu không mock.
// App.tsx dùng EventSource cho real-time notifications.
const MockEventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  onerror: null,
}));
vi.stubGlobal('EventSource', MockEventSource);

// ─── Mock window.matchMedia (Tailwind responsive) ────────────────────────────
// jsdom không implement matchMedia — components dùng responsive hooks sẽ throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── Mock ResizeObserver ──────────────────────────────────────────────────────
// Dùng globalThis thay vì global — tương thích với ESM browser context (jsdom).
// "global" là Node.js-only, không tồn tại trong Vite/ESM environment.
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ─── Suppress console.error cho expected React warnings ──────────────────────
// Một số third-party components in propTypes warnings — ẩn để giữ output sạch.
// Giữ lại console.error thật để catch lỗi thật trong tests.
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const message = String(args[0] ?? '');
  // Bỏ qua React Router warnings trong test environment
  if (
    message.includes('ReactDOM.render is deprecated') ||
    message.includes('Warning: An update to')
  ) {
    return;
  }
  originalError(...args);
};
