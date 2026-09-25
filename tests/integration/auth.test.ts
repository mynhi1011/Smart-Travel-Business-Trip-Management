/**
 * auth.test.ts — Integration/API Tests: Authentication + RBAC
 *
 * Task 5 — TASK 5 — INTEGRATION/API TEST AUTH + RBAC
 *
 * Mục tiêu:
 *   Chứng minh Backend THỰC SỰ enforce Authentication và Authorization
 *   thông qua HTTP request → middleware → controller pipeline.
 *   KHÔNG mock authGuard / roleGuard — guards chạy thật.
 *
 * Test categories:
 *   [LOGIN]  — POST /api/v1/auth/login: credential validation, token issuance
 *   [401]    — Unauthenticated / invalid token requests
 *   [403]    — Authenticated but wrong role (RBAC enforcement)
 *   [RBAC]   — Per-role permission matrix across multiple endpoints
 *   [ME]     — GET /api/v1/auth/me: protected profile endpoint
 *   [REFRESH]— POST /api/v1/auth/refresh: token refresh flow
 *   [LOGOUT] — DELETE /api/v1/auth/logout: session termination
 *   [ACTIONS]— Protected business actions (approve, close, expense approve)
 *
 * Architecture notes:
 *   - JWT HS256, 15m access token (architecture.md §6.1)
 *   - Roles: EMPLOYEE | MANAGER | TRAVEL_ADMIN | FINANCE | ADMIN
 *   - 401 sources: missing token, TOKEN_EXPIRED, INVALID_TOKEN (auth.guard.ts)
 *   - 403 source: wrong role → FORBIDDEN (role.guard.ts)
 *   - Prisma: mocked — không cần DB thật
 *   - Services: mocked ở layer phù hợp — authGuard/roleGuard KHÔNG mock
 *
 * Pattern: Supertest in-process (không start HTTP server)
 *   request(createApp()).post('/api/v1/...').set('Authorization', ...).send(...)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── App ──────────────────────────────────────────────────────────────────────
// Import app factory — supertest gọi in-process, không cần server.listen()
import { createApp } from '../../src/backend/src/app';

// ─── Test Helpers ─────────────────────────────────────────────────────────────
import {
  TEST_USERS,
  generateTestToken,
  makeAuthHeader,
  VALID_TRIP_PAYLOAD,
} from '../../src/backend/src/__tests__/setup';

// ══════════════════════════════════════════════════════════════════════════════
// MOCK LAYER — Prisma + Services
// authGuard và roleGuard KHÔNG được mock — đây là integration test
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Mock Prisma — không cần DB thật.
 * vi.mock() tự động hoisted lên đầu file bởi Vitest.
 *
 * QUAN TRỌNG: authGuard đọc JWT_ACCESS_SECRET từ process.env (đã set trong setup.ts),
 * KHÔNG query DB — nên authGuard hoạt động hoàn toàn độc lập với mock Prisma.
 * roleGuard cũng không query DB — chỉ đọc req.user từ authGuard.
 */
vi.mock('../../src/backend/src/prisma/client', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    trip: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    expense: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    expenseItem: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    notification: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    approvalRecord: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (fn: unknown) => {
      if (typeof fn === 'function') {
        return fn({
          trip: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          auditLog: { create: vi.fn() },
          notification: { create: vi.fn() },
          user: { count: vi.fn().mockResolvedValue(0) },
          expense: { count: vi.fn().mockResolvedValue(0) },
        });
      }
      // Array form: $transaction([p1, p2, ...])
      return Promise.all(fn as Promise<unknown>[]);
    }),
  },
}));

// Mock auth.service — kiểm soát login/getMe/logout output
vi.mock('../../src/backend/src/services/auth.service', () => ({
  login: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

// Mock trip.service — tất cả action endpoints
vi.mock('../../src/backend/src/services/trip.service', () => ({
  createTrip: vi.fn(),
  getAllTrips: vi.fn(),
  getTripById: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  submitTrip: vi.fn(),
  approveTrip: vi.fn(),
  rejectTrip: vi.fn(),
  closeTrip: vi.fn(),
  VALID_TRANSITIONS: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['MANAGER_REVIEWING', 'REJECTED'],
    CLOSED: [],
  },
}));

// Mock expense.service
vi.mock('../../src/backend/src/services/expense.service', () => ({
  getExpense: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  addExpenseItem: vi.fn(),
  updateExpenseItem: vi.fn(),
  deleteExpenseItem: vi.fn(),
  submitExpense: vi.fn(),
  approveExpense: vi.fn(),
  rejectExpense: vi.fn(),
  reapproveExpense: vi.fn(),
}));

// Mock ai.service — generateItineraryDraft
vi.mock('../../src/backend/src/services/ai.service', () => ({
  generateItineraryDraft: vi.fn(),
}));

// Mock notification.service
vi.mock('../../src/backend/src/services/notification.service', () => ({
  listNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllRead: vi.fn(),
}));

// Mock itinerary.service
vi.mock('../../src/backend/src/services/itinerary.service', () => ({
  getItinerary: vi.fn(),
  addItineraryItem: vi.fn(),
  updateItineraryItem: vi.fn(),
  deleteItineraryItem: vi.fn(),
}));

// Mock pdf.controller dependency (pdfkit may need canvas)
vi.mock('../../src/backend/src/services/audit.service', () => ({
  logAudit: vi.fn(),
  AuditActions: {
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    TOKEN_REFRESHED: 'TOKEN_REFRESHED',
    TRIP_CREATED: 'TRIP_CREATED',
    TRIP_APPROVED: 'TRIP_APPROVED',
    TRIP_CLOSED: 'TRIP_CLOSED',
  },
}));

// ─── Import service mocks để configure per-test ───────────────────────────────
import * as authService from '../../src/backend/src/services/auth.service';
import * as tripService from '../../src/backend/src/services/trip.service';
import * as expenseService from '../../src/backend/src/services/expense.service';

// ══════════════════════════════════════════════════════════════════════════════
// TEST DATA
// ══════════════════════════════════════════════════════════════════════════════

/** Mock user object trả về từ authService.login */
const MOCK_AUTH_USER = {
  id: 'user-employee-001',
  name: 'Nguyễn Văn Test',
  email: 'employee@test.com',
  role: 'EMPLOYEE',
  jobGrade: 'STAFF',
  department: 'Engineering',
  managerId: 'user-manager-001',
};

/** Mock user object trả về từ authService.getMe */
const MOCK_ME_RESPONSE = {
  ...MOCK_AUTH_USER,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

/** Mock trip object */
const MOCK_TRIP = {
  id: 'trip-uuid-001',
  tripCode: 'TR-2099-0001',
  employeeId: 'user-employee-001',
  origin: 'Hà Nội',
  destination: 'TP. Hồ Chí Minh',
  destinationType: 'TIER1_CITY',
  departureDate: new Date('2099-06-01T00:00:00.000Z'),
  returnDate: new Date('2099-06-05T00:00:00.000Z'),
  tripDays: 4,
  purpose: 'Tham dự hội nghị khách hàng',
  estimatedBudget: 8_000_000,
  hotelCostPerNight: 800_000,
  hotelNights: 4,
  perDiemBudget: 1_600_000,
  transportBudget: 3_200_000,
  otherBudget: 400_000,
  status: 'DRAFT',
  isUrgent: false,
  urgencyReason: null,
  requiresLevel2: false,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
};

/** Mock expense object */
const MOCK_EXPENSE = {
  id: 'expense-001',
  tripId: 'trip-uuid-001',
  employeeId: 'user-employee-001',
  status: 'PENDING_FINANCE',
  totalAmount: 5_000_000,
  items: [],
};

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — AUTHENTICATION: LOGIN / SESSION / TOKEN
// ══════════════════════════════════════════════════════════════════════════════

describe('[LOGIN] POST /api/v1/auth/login — Authentication', () => {

  // ── LOGIN-01: Happy Path ───────────────────────────────────────────────────
  it('[LOGIN-01] 200 — đăng nhập thành công trả về accessToken + user + cookie', async () => {
    // Arrange: service trả về kết quả login thành công
    const mockRawRefreshToken = 'mock-raw-refresh-token-128hex';
    vi.mocked(authService.login).mockResolvedValueOnce({
      accessToken: generateTestToken({
        sub: MOCK_AUTH_USER.id,
        role: MOCK_AUTH_USER.role,
        name: MOCK_AUTH_USER.name,
      }),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: MOCK_AUTH_USER,
      rawRefreshToken: mockRawRefreshToken,
    });

    // Act
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@test.com', password: 'Password123!' });

    // Assert: HTTP 200
    expect(res.status).toBe(200);

    // Assert: response body structure (API.md §4)
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('tokenType', 'Bearer');
    expect(res.body).toHaveProperty('expiresIn', 900);
    expect(res.body).toHaveProperty('user');

    // Assert: accessToken là JWT hợp lệ — decode để verify format
    const decoded = jwt.decode(res.body.accessToken) as Record<string, unknown>;
    expect(decoded).toHaveProperty('sub', MOCK_AUTH_USER.id);
    expect(decoded).toHaveProperty('role', 'EMPLOYEE');

    // Assert: user object trả về đúng dữ liệu
    expect(res.body.user).toMatchObject({
      id: MOCK_AUTH_USER.id,
      name: MOCK_AUTH_USER.name,
      email: MOCK_AUTH_USER.email,
      role: 'EMPLOYEE',
    });

    // Assert: rawRefreshToken KHÔNG có trong response body (security)
    expect(res.body).not.toHaveProperty('rawRefreshToken');

    // Assert: httpOnly cookie được set
    const setCookieHeader = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    expect(setCookieHeader).toBeDefined();
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join('; ')
      : String(setCookieHeader);
    expect(cookieStr).toMatch(/refreshToken/);
    expect(cookieStr).toMatch(/HttpOnly/i);

    // Assert: authService.login được gọi với đúng credentials
    expect(authService.login).toHaveBeenCalledWith(
      'employee@test.com',
      'Password123!',
      expect.anything() // ipAddress
    );
  });

  // ── LOGIN-02: Sai password ─────────────────────────────────────────────────
  it('[LOGIN-02] 401 INVALID_CREDENTIALS — sai password', async () => {
    const { AppError } = await import('../../src/backend/src/middlewares/error-handler');
    vi.mocked(authService.login).mockRejectedValueOnce(
      new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.')
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@test.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toMatch(/mật khẩu/i);
  });

  // ── LOGIN-03: Email không tồn tại ─────────────────────────────────────────
  it('[LOGIN-03] 401 INVALID_CREDENTIALS — email không tồn tại', async () => {
    const { AppError } = await import('../../src/backend/src/middlewares/error-handler');
    vi.mocked(authService.login).mockRejectedValueOnce(
      new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.')
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');

    // Assert: không phân biệt email không tồn tại vs sai password (timing attack prevention)
    // Cả hai đều trả về cùng error message
  });

  // ── LOGIN-04: Thiếu email ──────────────────────────────────────────────────
  it('[LOGIN-04] 400 VALIDATION_ERROR — thiếu email (required field)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'Password123!' }); // Không có email

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');

    // Assert: authService.login KHÔNG được gọi khi validation fail
    expect(authService.login).not.toHaveBeenCalled();
  });

  // ── LOGIN-05: Thiếu password ───────────────────────────────────────────────
  it('[LOGIN-05] 400 VALIDATION_ERROR — thiếu password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@test.com' }); // Không có password

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(authService.login).not.toHaveBeenCalled();
  });

  // ── LOGIN-06: Email không đúng format ─────────────────────────────────────
  it('[LOGIN-06] 400 VALIDATION_ERROR — email không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(authService.login).not.toHaveBeenCalled();
  });

  // ── LOGIN-07: Password quá ngắn ───────────────────────────────────────────
  it('[LOGIN-07] 400 VALIDATION_ERROR — password dưới 8 ký tự', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'employee@test.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(authService.login).not.toHaveBeenCalled();
  });

  // ── LOGIN-08: Empty body ───────────────────────────────────────────────────
  it('[LOGIN-08] 400 VALIDATION_ERROR — body rỗng', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — 401 UNAUTHORIZED
// Chứng minh: Backend từ chối request khi token thiếu hoặc không hợp lệ
// ══════════════════════════════════════════════════════════════════════════════

describe('[401] Unauthenticated Requests — authGuard enforcement', () => {

  // ── 401-01: Không có token ─────────────────────────────────────────────────
  it('[401-01] GET /api/v1/auth/me — không có Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me');
    // Không set Authorization header

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    // Assert: authService.getMe KHÔNG được gọi — backend reject trước khi đến controller
    expect(authService.getMe).not.toHaveBeenCalled();
  });

  // ── 401-02: Không có token trên trip endpoint ──────────────────────────────
  it('[401-02] GET /api/v1/trips — không có token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/v1/trips');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // ── 401-03: Không có token trên protected action ───────────────────────────
  it('[401-03] POST /api/v1/trips/:id/approve — không có token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/approve')
      .send({ comment: 'Duyệt' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    // Assert: tripService.approveTrip KHÔNG được gọi
    expect(tripService.approveTrip).not.toHaveBeenCalled();
  });

  // ── 401-04: Authorization header sai format (thiếu "Bearer " prefix) ───────
  it('[401-04] POST /api/v1/trips — header thiếu "Bearer " prefix → 401 UNAUTHORIZED', async () => {
    const token = TEST_USERS.employee();
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', token) // Sai: không có "Bearer " prefix
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── 401-05: Authorization header chỉ có "Bearer " không có token ──────────
  it('[401-05] POST /api/v1/trips — "Bearer " prefix nhưng không có token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', 'Bearer ') // Chỉ prefix, không có token
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // ── 401-06: Token hết hạn → TOKEN_EXPIRED ─────────────────────────────────
  it('[401-06] POST /api/v1/trips — token hết hạn → 401 TOKEN_EXPIRED', async () => {
    // Tạo token với expiresIn '0s' → expired ngay lập tức
    const expiredToken = TEST_USERS.expired();

    // Đợi để đảm bảo token đã hết hạn
    await new Promise(r => setTimeout(r, 20));

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
    // Assert: expired token KHÔNG cho phép qua authGuard
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── 401-07: Token bị tamper (sai chữ ký) → INVALID_TOKEN ─────────────────
  it('[401-07] POST /api/v1/trips — token bị tamper → 401 INVALID_TOKEN', async () => {
    const validToken = TEST_USERS.employee();
    const parts = validToken.split('.');
    // Thay signature bằng chuỗi không hợp lệ — giả lập token bị chỉnh sửa
    const tamperedToken = `${parts[0]}.${parts[1]}.TAMPERED_SIGNATURE_xyz123`;

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── 401-08: Token hoàn toàn random (không phải JWT format) ────────────────
  it('[401-08] GET /api/v1/trips — random string giả làm token → 401', async () => {
    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', 'Bearer notajwtatall');

    expect(res.status).toBe(401);
    // INVALID_TOKEN hoặc UNAUTHORIZED — cả hai đều là 401
    expect([401]).toContain(res.status);
  });

  // ── 401-09: Dashboard không có token ──────────────────────────────────────
  it('[401-09] GET /api/v1/dashboard — không có token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // ── 401-10: Logout không có token ─────────────────────────────────────────
  it('[401-10] DELETE /api/v1/auth/logout — không có token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — 403 FORBIDDEN (RBAC)
// Chứng minh: Backend từ chối request khi role không có quyền
// Token hợp lệ + user hợp lệ + SAI ROLE = 403
// ══════════════════════════════════════════════════════════════════════════════

describe('[403] Role-based Access Control — roleGuard enforcement', () => {

  // ─── POST /api/v1/trips — chỉ EMPLOYEE ─────────────────────────────────────

  it('[403-01] POST /api/v1/trips — MANAGER cố tạo trip (EMPLOYEE only) → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    // Backend reject — service không được gọi
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  it('[403-02] POST /api/v1/trips — TRAVEL_ADMIN cố tạo trip → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.travelAdmin()))
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  it('[403-03] POST /api/v1/trips — FINANCE cố tạo trip → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/trips/:id/approve — chỉ MANAGER + TRAVEL_ADMIN ───────────

  it('[403-04] POST /trips/:id/approve — EMPLOYEE cố approve (MANAGER only) → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send({ comment: 'Duyệt nha' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.approveTrip).not.toHaveBeenCalled();
  });

  it('[403-05] POST /trips/:id/approve — FINANCE cố approve → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send({ comment: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.approveTrip).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/trips/:id/reject — chỉ MANAGER + TRAVEL_ADMIN ────────────

  it('[403-06] POST /trips/:id/reject — EMPLOYEE cố reject → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/reject')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send({ comment: 'Từ chối' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.rejectTrip).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/trips/:id/close — chỉ FINANCE ────────────────────────────

  it('[403-07] POST /trips/:id/close — EMPLOYEE cố close trip (FINANCE only) → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/close')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.closeTrip).not.toHaveBeenCalled();
  });

  it('[403-08] POST /trips/:id/close — MANAGER cố close trip → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/close')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.closeTrip).not.toHaveBeenCalled();
  });

  it('[403-09] POST /trips/:id/close — TRAVEL_ADMIN cố close trip → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/close')
      .set('Authorization', makeAuthHeader(TEST_USERS.travelAdmin()))
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.closeTrip).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/trips/:id/expense/approve — chỉ FINANCE ──────────────────

  it('[403-10] POST /trips/:id/expense/approve — EMPLOYEE cố approve expense (FINANCE only) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send({ comment: 'Duyệt chi phí' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.approveExpense).not.toHaveBeenCalled();
  });

  it('[403-11] POST /trips/:id/expense/approve — MANAGER cố approve expense → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send({ comment: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.approveExpense).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/trips/:id/expense — chỉ EMPLOYEE ─────────────────────────

  it('[403-12] POST /trips/:id/expense — FINANCE cố tạo expense (EMPLOYEE only) → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send({ totalAmount: 1_000_000 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.createExpense).not.toHaveBeenCalled();
  });

  // ─── POST /api/v1/ai/generate-itinerary — chỉ EMPLOYEE ─────────────────────

  it('[403-13] POST /api/v1/ai/generate-itinerary — MANAGER cố generate AI (EMPLOYEE only) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/ai/generate-itinerary')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send({ tripId: 'trip-001' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  // ─── POST /api/v1/trips/:id/expense/reapprove — chỉ MANAGER ────────────────

  it('[403-14] POST /trips/:id/expense/reapprove — EMPLOYEE cố reapprove (MANAGER only) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense/reapprove')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send({ comment: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.reapproveExpense).not.toHaveBeenCalled();
  });

  it('[403-15] POST /trips/:id/expense/reapprove — FINANCE cố reapprove → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense/reapprove')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send({ comment: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.reapproveExpense).not.toHaveBeenCalled();
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — VALID TOKEN + ALLOWED ROLE (Success Cases)
// Chứng minh: token hợp lệ + đúng role → Backend cho phép
// ══════════════════════════════════════════════════════════════════════════════

describe('[RBAC-SUCCESS] Valid token + Allowed role — Backend permits request', () => {

  // ─── EMPLOYEE tạo trip ──────────────────────────────────────────────────────
  it('[RBAC-S01] EMPLOYEE tạo trip — 201 (đúng role)', async () => {
    vi.mocked(tripService.createTrip).mockResolvedValueOnce({
      trip: MOCK_TRIP,
      warnings: [],
    });

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('tripCode');
    // Assert: service được gọi — Backend cho phép request đi đến controller
    expect(tripService.createTrip).toHaveBeenCalledOnce();
  });

  // ─── MANAGER approve trip ───────────────────────────────────────────────────
  it('[RBAC-S02] MANAGER approve trip — 200 (đúng role)', async () => {
    vi.mocked(tripService.approveTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'APPROVED',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send({ comment: 'Đồng ý' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(tripService.approveTrip).toHaveBeenCalledOnce();
  });

  // ─── TRAVEL_ADMIN approve trip ──────────────────────────────────────────────
  it('[RBAC-S03] TRAVEL_ADMIN approve trip — 200 (đúng role)', async () => {
    vi.mocked(tripService.approveTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'APPROVED',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.travelAdmin()))
      .send({ comment: 'Travel Admin đồng ý' });

    expect(res.status).toBe(200);
    expect(tripService.approveTrip).toHaveBeenCalledOnce();
  });

  // ─── FINANCE close trip ─────────────────────────────────────────────────────
  it('[RBAC-S04] FINANCE close trip — 200 (đúng role)', async () => {
    vi.mocked(tripService.closeTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'CLOSED',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/close')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    // Assert: service được gọi — FINANCE có quyền close
    expect(tripService.closeTrip).toHaveBeenCalledOnce();
  });

  // ─── FINANCE approve expense ────────────────────────────────────────────────
  it('[RBAC-S05] FINANCE approve expense — 200 (đúng role)', async () => {
    vi.mocked(expenseService.approveExpense).mockResolvedValueOnce({
      ...MOCK_EXPENSE,
      status: 'APPROVED',
    } as never);

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/expense/approve')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
      .send({ comment: 'Finance đồng ý chi phí' });

    expect(res.status).toBe(200);
    expect(expenseService.approveExpense).toHaveBeenCalledOnce();
  });

  // ─── ALL roles được đọc trip list ──────────────────────────────────────────
  it('[RBAC-S06] GET /trips — MANAGER xem list trip — 200 (authGuard only, no roleGuard)', async () => {
    vi.mocked(tripService.getAllTrips).mockResolvedValueOnce({
      trips: [MOCK_TRIP],
      total: 1,
    });

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('[RBAC-S07] GET /trips — FINANCE xem list trip — 200', async () => {
    vi.mocked(tripService.getAllTrips).mockResolvedValueOnce({
      trips: [],
      total: 0,
    });

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()));

    expect(res.status).toBe(200);
  });

  // ─── MANAGER reject trip ────────────────────────────────────────────────────
  it('[RBAC-S08] MANAGER reject trip — 200 (đúng role)', async () => {
    vi.mocked(tripService.rejectTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'REJECTED',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/reject')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send({ comment: 'Không phù hợp' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(tripService.rejectTrip).toHaveBeenCalledOnce();
  });

  // ─── MANAGER reapprove expense ──────────────────────────────────────────────
  it('[RBAC-S09] MANAGER reapprove expense — 200 (đúng role)', async () => {
    vi.mocked(expenseService.reapproveExpense).mockResolvedValueOnce({
      ...MOCK_EXPENSE,
      status: 'APPROVED',
    } as never);

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/expense/reapprove')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
      .send({ comment: 'Manager đồng ý duyệt lại' });

    expect(res.status).toBe(200);
    expect(expenseService.reapproveExpense).toHaveBeenCalledOnce();
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — PROTECTED ENDPOINTS: GET /auth/me + Dashboard
// ══════════════════════════════════════════════════════════════════════════════

describe('[PROTECTED] GET /api/v1/auth/me — Session validation', () => {

  // ── ME-01: Token hợp lệ → trả về user data ────────────────────────────────
  it('[ME-01] 200 — valid EMPLOYEE token → trả về user profile', async () => {
    vi.mocked(authService.getMe).mockResolvedValueOnce(MOCK_ME_RESPONSE);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: MOCK_AUTH_USER.id,
      name: MOCK_AUTH_USER.name,
      email: MOCK_AUTH_USER.email,
      role: 'EMPLOYEE',
    });
    // Assert: getMe được gọi với đúng userId từ token payload
    expect(authService.getMe).toHaveBeenCalledWith('user-employee-001');
  });

  // ── ME-02: Token hợp lệ → MANAGER cũng được ──────────────────────────────
  it('[ME-02] 200 — valid MANAGER token → trả về manager profile', async () => {
    const mockManagerResponse = {
      ...MOCK_ME_RESPONSE,
      id: 'user-manager-001',
      name: 'Trần Thị Manager',
      email: 'manager@test.com',
      role: 'MANAGER',
    };
    vi.mocked(authService.getMe).mockResolvedValueOnce(mockManagerResponse);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()));

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('MANAGER');
    expect(authService.getMe).toHaveBeenCalledWith('user-manager-001');
  });

  // ── ME-03: Không có token → 401 ───────────────────────────────────────────
  it('[ME-03] 401 — không có token → UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(authService.getMe).not.toHaveBeenCalled();
  });

  // ── ME-04: Token hết hạn → 401 TOKEN_EXPIRED ─────────────────────────────
  it('[ME-04] 401 TOKEN_EXPIRED — expired token → không lấy được profile', async () => {
    const expiredToken = TEST_USERS.expired();
    await new Promise(r => setTimeout(r, 20));

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
    expect(authService.getMe).not.toHaveBeenCalled();
  });

});

describe('[PROTECTED] GET /api/v1/dashboard — Multi-role access', () => {

  // ── DASH-01: EMPLOYEE xem dashboard ──────────────────────────────────────
  it('[DASH-01] 200 — EMPLOYEE xem dashboard thành công', async () => {
    // Dashboard controller dùng Prisma trực tiếp (đã mock với default values)
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()));

    expect(res.status).toBe(200);
    // Assert: response chứa role field
    expect(res.body).toHaveProperty('role', 'EMPLOYEE');
  });

  // ── DASH-02: MANAGER xem dashboard ───────────────────────────────────────
  it('[DASH-02] 200 — MANAGER xem dashboard (authGuard only, no roleGuard)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', makeAuthHeader(TEST_USERS.manager()));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('role', 'MANAGER');
  });

  // ── DASH-03: FINANCE xem dashboard ───────────────────────────────────────
  it('[DASH-03] 200 — FINANCE xem dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', makeAuthHeader(TEST_USERS.finance()));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('role', 'FINANCE');
  });

  // ── DASH-04: Không có token → 401 ────────────────────────────────────────
  it('[DASH-04] 401 — không có token → UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — TOKEN REFRESH + LOGOUT
// ══════════════════════════════════════════════════════════════════════════════

describe('[REFRESH] POST /api/v1/auth/refresh — Token renewal', () => {

  // ── REFRESH-01: Refresh thành công với httpOnly cookie ────────────────────
  it('[REFRESH-01] 200 — refresh token hợp lệ → cấp accessToken mới', async () => {
    const newToken = generateTestToken({
      sub: MOCK_AUTH_USER.id,
      role: MOCK_AUTH_USER.role,
      name: MOCK_AUTH_USER.name,
    });
    vi.mocked(authService.refreshAccessToken).mockResolvedValueOnce({
      accessToken: newToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=valid-refresh-token-hash');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
  });

  // ── REFRESH-02: Không có cookie → 401 ────────────────────────────────────
  it('[REFRESH-02] 401 UNAUTHORIZED — không có refreshToken cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh');
    // Không set Cookie header

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(authService.refreshAccessToken).not.toHaveBeenCalled();
  });

  // ── REFRESH-03: Refresh token đã bị revoke / không hợp lệ ────────────────
  it('[REFRESH-03] 401 UNAUTHORIZED — refresh token đã bị revoke', async () => {
    const { AppError } = await import('../../src/backend/src/middlewares/error-handler');
    vi.mocked(authService.refreshAccessToken).mockRejectedValueOnce(
      new AppError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.')
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=revoked-or-expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

});

describe('[LOGOUT] DELETE /api/v1/auth/logout — Session termination', () => {

  // ── LOGOUT-01: Logout thành công ──────────────────────────────────────────
  it('[LOGOUT-01] 204 — logout với valid token → session terminated', async () => {
    vi.mocked(authService.logout).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', makeAuthHeader(TEST_USERS.employee()))
      .set('Cookie', 'refreshToken=some-refresh-token');

    expect(res.status).toBe(204);
    // 204 No Content — không có body
  });

  // ── LOGOUT-02: Logout không có token → 401 ───────────────────────────────
  it('[LOGOUT-02] 401 UNAUTHORIZED — logout không có Authorization header', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    // Assert: authService.logout KHÔNG được gọi — rejected trước khi đến controller
    expect(authService.logout).not.toHaveBeenCalled();
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — COMPLETE RBAC MATRIX
// Tổng hợp kiểm tra matrix đầy đủ theo trips.routes.ts
// Đây là bằng chứng tổng thể Backend enforce RBAC
// ══════════════════════════════════════════════════════════════════════════════

describe('[RBAC-MATRIX] Full role/permission matrix — Backend enforcement evidence', () => {

  /**
   * Matrix Test: POST /api/v1/trips
   * Allowed: EMPLOYEE
   * Forbidden: MANAGER, TRAVEL_ADMIN, FINANCE, ADMIN
   */
  describe('POST /api/v1/trips — EMPLOYEE only', () => {
    const forbiddenRoles = [
      { name: 'MANAGER', token: () => TEST_USERS.manager() },
      { name: 'TRAVEL_ADMIN', token: () => TEST_USERS.travelAdmin() },
      { name: 'FINANCE', token: () => TEST_USERS.finance() },
      { name: 'ADMIN', token: () => TEST_USERS.admin() },
    ];

    for (const { name, token } of forbiddenRoles) {
      it(`[MATRIX] ${name} → 403 FORBIDDEN (POST /trips)`, async () => {
        const res = await request(app)
          .post('/api/v1/trips')
          .set('Authorization', makeAuthHeader(token()))
          .send(VALID_TRIP_PAYLOAD);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
        expect(tripService.createTrip).not.toHaveBeenCalled();
      });
    }
  });

  /**
   * Matrix Test: POST /api/v1/trips/:id/approve
   * Allowed: MANAGER, TRAVEL_ADMIN
   * Forbidden: EMPLOYEE, FINANCE, ADMIN
   */
  describe('POST /api/v1/trips/:id/approve — MANAGER, TRAVEL_ADMIN only', () => {
    const forbiddenRoles = [
      { name: 'EMPLOYEE', token: () => TEST_USERS.employee() },
      { name: 'FINANCE', token: () => TEST_USERS.finance() },
      { name: 'ADMIN', token: () => TEST_USERS.admin() },
    ];

    for (const { name, token } of forbiddenRoles) {
      it(`[MATRIX] ${name} → 403 FORBIDDEN (POST /trips/:id/approve)`, async () => {
        const res = await request(app)
          .post('/api/v1/trips/trip-001/approve')
          .set('Authorization', makeAuthHeader(token()))
          .send({ comment: 'Test' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
        expect(tripService.approveTrip).not.toHaveBeenCalled();
      });
    }

    it('[MATRIX] MANAGER → 200 (POST /trips/:id/approve)', async () => {
      vi.mocked(tripService.approveTrip).mockResolvedValueOnce({
        ...MOCK_TRIP,
        status: 'APPROVED',
      });

      const res = await request(app)
        .post('/api/v1/trips/trip-uuid-001/approve')
        .set('Authorization', makeAuthHeader(TEST_USERS.manager()))
        .send({ comment: 'OK' });

      expect(res.status).toBe(200);
    });

    it('[MATRIX] TRAVEL_ADMIN → 200 (POST /trips/:id/approve)', async () => {
      vi.mocked(tripService.approveTrip).mockResolvedValueOnce({
        ...MOCK_TRIP,
        status: 'APPROVED',
      });

      const res = await request(app)
        .post('/api/v1/trips/trip-uuid-001/approve')
        .set('Authorization', makeAuthHeader(TEST_USERS.travelAdmin()))
        .send({ comment: 'OK' });

      expect(res.status).toBe(200);
    });
  });

  /**
   * Matrix Test: POST /api/v1/trips/:id/close
   * Allowed: FINANCE
   * Forbidden: EMPLOYEE, MANAGER, TRAVEL_ADMIN, ADMIN
   */
  describe('POST /api/v1/trips/:id/close — FINANCE only', () => {
    const forbiddenRoles = [
      { name: 'EMPLOYEE', token: () => TEST_USERS.employee() },
      { name: 'MANAGER', token: () => TEST_USERS.manager() },
      { name: 'TRAVEL_ADMIN', token: () => TEST_USERS.travelAdmin() },
      { name: 'ADMIN', token: () => TEST_USERS.admin() },
    ];

    for (const { name, token } of forbiddenRoles) {
      it(`[MATRIX] ${name} → 403 FORBIDDEN (POST /trips/:id/close)`, async () => {
        const res = await request(app)
          .post('/api/v1/trips/trip-001/close')
          .set('Authorization', makeAuthHeader(token()))
          .send();

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
        expect(tripService.closeTrip).not.toHaveBeenCalled();
      });
    }

    it('[MATRIX] FINANCE → 200 (POST /trips/:id/close)', async () => {
      vi.mocked(tripService.closeTrip).mockResolvedValueOnce({
        ...MOCK_TRIP,
        status: 'CLOSED',
      });

      const res = await request(app)
        .post('/api/v1/trips/trip-uuid-001/close')
        .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
        .send();

      expect(res.status).toBe(200);
    });
  });

  /**
   * Matrix Test: POST /api/v1/trips/:id/expense/approve
   * Allowed: FINANCE
   * Forbidden: EMPLOYEE, MANAGER, TRAVEL_ADMIN
   */
  describe('POST /api/v1/trips/:id/expense/approve — FINANCE only', () => {
    const forbiddenRoles = [
      { name: 'EMPLOYEE', token: () => TEST_USERS.employee() },
      { name: 'MANAGER', token: () => TEST_USERS.manager() },
      { name: 'TRAVEL_ADMIN', token: () => TEST_USERS.travelAdmin() },
    ];

    for (const { name, token } of forbiddenRoles) {
      it(`[MATRIX] ${name} → 403 FORBIDDEN (POST /trips/:id/expense/approve)`, async () => {
        const res = await request(app)
          .post('/api/v1/trips/trip-001/expense/approve')
          .set('Authorization', makeAuthHeader(token()))
          .send({ comment: 'Test' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FORBIDDEN');
        expect(expenseService.approveExpense).not.toHaveBeenCalled();
      });
    }

    it('[MATRIX] FINANCE → 200 (POST /trips/:id/expense/approve)', async () => {
      vi.mocked(expenseService.approveExpense).mockResolvedValueOnce({
        ...MOCK_EXPENSE,
        status: 'APPROVED',
      } as never);

      const res = await request(app)
        .post('/api/v1/trips/trip-uuid-001/expense/approve')
        .set('Authorization', makeAuthHeader(TEST_USERS.finance()))
        .send({ comment: 'Duyệt' });

      expect(res.status).toBe(200);
    });
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — BACKEND ENFORCEMENT EVIDENCE
// Chứng minh rõ ràng: Frontend ẩn button KHÔNG đủ — Backend phải enforce
// ══════════════════════════════════════════════════════════════════════════════

describe('[ENFORCEMENT] Backend permission enforcement — không phụ thuộc UI', () => {

  /**
   * SCENARIO: EMPLOYEE biết URL của approve endpoint, gọi trực tiếp.
   * Frontend có thể ẩn nút "Duyệt" với EMPLOYEE — nhưng Backend phải block.
   *
   * Đây là test chứng minh: dù KHÔNG có UI, dù gọi thẳng API,
   * Backend vẫn enforce RBAC và trả 403.
   */
  it('[ENF-01] EMPLOYEE gọi trực tiếp approve endpoint (bypassing UI) → 403 FORBIDDEN', async () => {
    // Arrange: EMPLOYEE có valid JWT token — đã authenticated
    const employeeToken = TEST_USERS.employee();

    // Act: Gửi HTTP request trực tiếp đến approve endpoint — không qua UI
    const res = await request(app)
      .post('/api/v1/trips/any-trip-id/approve')
      .set('Authorization', `Bearer ${employeeToken}`)  // Token hợp lệ
      .set('Content-Type', 'application/json')
      .send({ comment: 'Tôi tự approve cho mình' });

    // Assert: Backend nhận request → check auth → check role → từ chối
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toMatch(/không có quyền/i);

    // Assert: tripService.approveTrip KHÔNG được gọi
    // Bằng chứng: Backend block TRƯỚC KHI gọi business logic
    expect(tripService.approveTrip).not.toHaveBeenCalled();
  });

  /**
   * SCENARIO: MANAGER biết URL của closeTrip, thử close mà không có FINANCE role.
   */
  it('[ENF-02] MANAGER gọi trực tiếp close endpoint (FINANCE only) → 403 FORBIDDEN', async () => {
    const managerToken = TEST_USERS.manager();

    const res = await request(app)
      .post('/api/v1/trips/any-trip-id/close')
      .set('Authorization', `Bearer ${managerToken}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.closeTrip).not.toHaveBeenCalled();
  });

  /**
   * SCENARIO: Request hoàn toàn không có token — không có session.
   * Dù có biết URL, không thể truy cập protected resource.
   */
  it('[ENF-03] Anonymous request đến protected endpoint → 401 (không cần UI)', async () => {
    const res = await request(app)
      .get('/api/v1/trips')
      .set('Accept', 'application/json');
    // Không có Authorization header

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  /**
   * SCENARIO: Dù FINANCE không thể tạo trip qua UI,
   * nếu gọi thẳng API → Backend vẫn 403.
   */
  it('[ENF-04] FINANCE gọi POST /trips trực tiếp → 403 (EMPLOYEE only)', async () => {
    const financeToken = TEST_USERS.finance();

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${financeToken}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  /**
   * SCENARIO: EMPLOYEE cố approve expense — FINANCE only endpoint.
   * Backend enforce tại role.guard — không phụ thuộc vào giao diện.
   */
  it('[ENF-05] EMPLOYEE gọi expense/approve trực tiếp → 403 (FINANCE only)', async () => {
    const employeeToken = TEST_USERS.employee();

    const res = await request(app)
      .post('/api/v1/trips/trip-001/expense/approve')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ comment: 'Tự approve expense' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(expenseService.approveExpense).not.toHaveBeenCalled();
  });

});