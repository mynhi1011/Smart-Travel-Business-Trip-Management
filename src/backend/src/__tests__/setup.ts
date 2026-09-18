/**
 * setup.ts — Global Test Setup for Backend
 *
 * File này được Vitest load trước mỗi test suite (setupFiles trong vitest.config.ts).
 *
 * Trách nhiệm:
 *   1. Set process.env cho test environment (JWT secret, NODE_ENV, DATABASE_URL)
 *   2. Mock requestId type extension (Express augmentation)
 *   3. Export helper functions dùng chung cho tất cả integration tests
 *
 * QUAN TRỌNG:
 *   - Không import Prisma client ở đây — để tránh kết nối DB thật.
 *     Prisma được mock riêng trong từng test file hoặc suite.
 *   - Không import app ở đây — tránh side effects khi load module.
 */

import { beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// ─── 1. Test Environment Variables ───────────────────────────────────────────
//
// Thiết lập trước khi bất kỳ module nào được import.
// Dùng giá trị cố định, an toàn — KHÔNG dùng trong production.
// ─────────────────────────────────────────────────────────────────────────────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-do-not-use-in-prod';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-do-not-use-in-prod';
process.env['DATABASE_URL'] = 'file::memory:?cache=shared';
process.env['PORT'] = '0'; // Port 0 → OS tự assign — tránh conflict
process.env['CORS_ORIGIN'] = 'http://localhost:5173';

// ─── 2. Suppress console output in tests ─────────────────────────────────────
//
// Ngăn requestLogger, errorHandler in ra stdout trong test run.
// Giữ lại console.error để debug nếu test thực sự fail.
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // Giữ console.error để nhìn thấy lỗi thật
  // vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ─── 3. Express requestId augmentation ───────────────────────────────────────
//
// requestId đã được declare trong logger.ts (middleware).
// KHÔNG re-declare ở đây — tránh "must have identical modifiers" TS error.
// Augmentation dùng chung trong toàn bộ project qua declaration merging.
// ─────────────────────────────────────────────────────────────────────────────
// (intentionally empty — augmentation is handled by logger.ts)

// ─── 4. Exported Test Helpers ─────────────────────────────────────────────────

/**
 * generateTestToken — Tạo JWT hợp lệ cho test
 *
 * Dùng JWT_ACCESS_SECRET đã set ở trên (test-only secret).
 * Không bao giờ tái sử dụng hàm này ngoài test environment.
 *
 * @param payload - { sub: userId, role, name }
 * @param expiresIn - default '1h', truyền '-1s' để tạo expired token
 */
export function generateTestToken(
  payload: { sub: string; role: string; name: string },
  expiresIn: string = '1h'
): string {
  const secret = process.env['JWT_ACCESS_SECRET']!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

/**
 * makeAuthHeader — Tạo Authorization header value cho supertest request
 *
 * @example
 *   request(app).post('/api/v1/trips')
 *     .set('Authorization', makeAuthHeader(employeeToken))
 */
export function makeAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Preset tokens cho các role thường dùng trong test
 * Tạo mới mỗi lần gọi — không cache để tránh token hết hạn
 */
export const TEST_USERS = {
  employee: () =>
    generateTestToken({
      sub: 'user-employee-001',
      role: 'EMPLOYEE',
      name: 'Nguyễn Văn Test',
    }),
  manager: () =>
    generateTestToken({
      sub: 'user-manager-001',
      role: 'MANAGER',
      name: 'Trần Thị Manager',
    }),
  travelAdmin: () =>
    generateTestToken({
      sub: 'user-travel-admin-001',
      role: 'TRAVEL_ADMIN',
      name: 'Lê Minh TravelAdmin',
    }),
  finance: () =>
    generateTestToken({
      sub: 'user-finance-001',
      role: 'FINANCE',
      name: 'Phạm Thu Finance',
    }),
  admin: () =>
    generateTestToken({
      sub: 'user-admin-001',
      role: 'ADMIN',
      name: 'Admin System',
    }),
  /**
   * Expired token — dùng để test 401 TOKEN_EXPIRED
   * jwt.sign với expiresIn '0s' tạo token đã hết hạn ngay lập tức
   */
  expired: () =>
    generateTestToken(
      { sub: 'user-expired-001', role: 'EMPLOYEE', name: 'Expired User' },
      '0s' // Hết hạn ngay lập tức
    ),
} as const;

/**
 * VALID_TRIP_PAYLOAD — Payload hợp lệ dùng làm base cho test cases
 *
 * Các test case failure path sẽ spread object này rồi override field cần test.
 * Dùng ngày tương lai xa (2099) để tránh flaky test do date validation.
 */
export const VALID_TRIP_PAYLOAD = {
  origin: 'Hà Nội',
  destination: 'TP. Hồ Chí Minh',
  destinationType: 'TIER1_CITY',
  departureDate: '2099-06-01',
  returnDate: '2099-06-05',
  purpose: 'Tham dự hội nghị khách hàng khu vực phía Nam Q3/2099',
  estimatedBudget: 8_000_000,
  hotelCostPerNight: 800_000,
  hotelNights: 4,
  perDiemBudget: 1_600_000, // 4 ngày × 400k/ngày TIER1_CITY — đúng hạn mức
  transportBudget: 3_200_000,
  otherBudget: 400_000,
} as const;
