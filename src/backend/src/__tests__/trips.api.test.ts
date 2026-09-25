/**
 * trips.api.test.ts — Integration Tests: POST /api/v1/trips
 *
 * Kiểm thử toàn bộ HTTP request → middleware → controller → response cycle.
 * Dùng Supertest để gửi request in-process (không cần server listen thực).
 *
 * Mock strategy:
 *   - Prisma client bị mock hoàn toàn — không cần DB thật
 *   - JWT được tạo thật (dùng test secret từ setup.ts)
 *   - tripService.createTrip được mock để kiểm soát output
 *
 * Test matrix (bám theo test-strategy.md §7.1):
 *   T-01: [HAPPY]  201 — tạo trip thành công, assert body đầy đủ
 *   T-02: [FAIL]   400 — thiếu destination (required field)
 *   T-03: [FAIL]   400 — returnDate trước departureDate
 *   T-04: [FAIL]   400 — estimatedBudget âm (boundary value)
 *   T-05: [AUTH]   401 — không có Authorization header
 *   T-06: [AUTH]   401 — token hết hạn
 *   T-07: [AUTH]   403 — role MANAGER không được tạo trip (EMPLOYEE only)
 *   T-08: [BIZ]    201 + warnings — budget > 20M (policy warning)
 *   T-09: [BIZ]    409 — submit trip đã CLOSED (invalid state transition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { TEST_USERS, VALID_TRIP_PAYLOAD } from './setup';

// ─── Mock Prisma ───────────────────────────────────────────────────────────────
// Mock toàn bộ Prisma client trước khi app.ts import nó.
// vi.mock() được hoisted lên đầu file tự động bởi Vitest.
vi.mock('../prisma/client', () => ({
  default: {
    trip: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      trip: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      auditLog: { create: vi.fn() },
      notification: { create: vi.fn() },
    })),
  },
}));

// ─── Mock trip.service ─────────────────────────────────────────────────────────
// Mock ở service layer để test controller + middleware layer trong isolation.
// Từng test case sẽ mock return value cụ thể.
vi.mock('../services/trip.service', () => ({
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
import * as tripService from '../services/trip.service';
import type { CreateTripResult } from '../services/trip.service';

/**
 * MOCK_TRIP — Dữ liệu trip mock trả về từ service.
 *
 * Type cast sang CreateTripResult['trip'] để TypeScript chấp nhận.
 * Dùng Date objects cho departureDate/returnDate (đúng với Prisma return type).
 */
const MOCK_TRIP: CreateTripResult['trip'] = {
  id: 'trip-uuid-001',
  tripCode: 'TR-2099-0001',
  employeeId: 'user-employee-001',
  origin: VALID_TRIP_PAYLOAD.origin,
  destination: VALID_TRIP_PAYLOAD.destination,
  destinationType: VALID_TRIP_PAYLOAD.destinationType,
  departureDate: new Date('2099-06-01T00:00:00.000Z'),
  returnDate: new Date('2099-06-05T00:00:00.000Z'),
  tripDays: 4,
  purpose: VALID_TRIP_PAYLOAD.purpose,
  estimatedBudget: VALID_TRIP_PAYLOAD.estimatedBudget,
  hotelCostPerNight: VALID_TRIP_PAYLOAD.hotelCostPerNight,
  hotelNights: VALID_TRIP_PAYLOAD.hotelNights,
  perDiemBudget: VALID_TRIP_PAYLOAD.perDiemBudget,
  transportBudget: VALID_TRIP_PAYLOAD.transportBudget,
  otherBudget: VALID_TRIP_PAYLOAD.otherBudget,
  status: 'DRAFT',
  isUrgent: false,
  urgencyReason: null,
  requiresLevel2: false,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
};

// ─── Setup ────────────────────────────────────────────────────────────────────
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/trips — Tạo chuyến đi
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/trips', () => {

  // ── T-01: Happy Path ────────────────────────────────────────────────────────
  it('[HAPPY] T-01 — 201: tạo trip thành công, trả về tripCode và status DRAFT', async () => {
    // Arrange: service trả về trip hợp lệ, không có warnings
    vi.mocked(tripService.createTrip).mockResolvedValueOnce({
      trip: MOCK_TRIP,
      warnings: [],
    });

    // Act
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send(VALID_TRIP_PAYLOAD);

    // Assert: status code
    expect(res.status).toBe(201);

    // Assert: response body structure — KHÔNG chỉ check status
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      tripCode: expect.stringMatching(/^TR-\d{4}-\d{4}$/),
      status: 'DRAFT',
      employeeId: 'user-employee-001',
      origin: 'Hà Nội',
      destination: 'TP. Hồ Chí Minh',
      estimatedBudget: 8_000_000,
    });

    // Assert: service được gọi đúng 1 lần với đúng employeeId
    expect(tripService.createTrip).toHaveBeenCalledOnce();
    expect(tripService.createTrip).toHaveBeenCalledWith(
      'user-employee-001',
      expect.objectContaining({ destination: 'TP. Hồ Chí Minh' }),
      expect.anything(), // req.ip
      undefined, // Optional Idempotency-Key.
    );
  });

  // ── T-02: Validation — thiếu required field ────────────────────────────────
  it('[FAIL] T-02 — 400: thiếu destination → VALIDATION_ERROR với field details', async () => {
    // Arrange: payload thiếu destination
    const { destination: _omit, ...payloadWithoutDestination } = VALID_TRIP_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send(payloadWithoutDestination);

    // Assert: status 400
    expect(res.status).toBe(400);

    // Assert: error code đúng spec API.md §3
    expect(res.body).toMatchObject({
      error: 'VALIDATION_ERROR',
      message: expect.any(String),
    });

    // Assert: details chứa thông tin field lỗi — client cần để hiển thị inline error
    expect(res.body.details).toBeDefined();

    // Assert: service KHÔNG được gọi khi validation fail
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── T-03: Validation — date range không hợp lệ ────────────────────────────
  it('[FAIL] T-03 — 400: returnDate trước departureDate → VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send({
        ...VALID_TRIP_PAYLOAD,
        departureDate: '2099-06-10',
        returnDate:    '2099-06-05', // returnDate TRƯỚC departureDate
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');

    // Assert: message liên quan đến returnDate — không phải generic error
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).toMatch(/ngày về|returnDate/i);
  });

  // ── T-04: Validation — boundary value (budget âm) ──────────────────────────
  it('[FAIL] T-04 — 400: estimatedBudget âm → VALIDATION_ERROR (boundary value)', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send({
        ...VALID_TRIP_PAYLOAD,
        estimatedBudget: -1, // Boundary: budget không được âm
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  // ── T-04b: Validation — boundary value (budget = 0) ───────────────────────
  it('[FAIL] T-04b — 400: estimatedBudget = 0 → VALIDATION_ERROR (positive required)', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send({
        ...VALID_TRIP_PAYLOAD,
        estimatedBudget: 0, // Boundary: phải > 0
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  // ── T-05: Auth — không có Authorization header ────────────────────────────
  it('[AUTH] T-05 — 401: không có Authorization header → UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      // Không set Authorization header
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');

    // Assert: service không được gọi khi chưa authenticate
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── T-05b: Auth — Authorization header sai format ────────────────────────
  it('[AUTH] T-05b — 401: Authorization header thiếu "Bearer " prefix → UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', TEST_USERS.employee()) // Không có "Bearer " prefix
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // ── T-06: Auth — token hết hạn ────────────────────────────────────────────
  it('[AUTH] T-06 — 401: token hết hạn → TOKEN_EXPIRED', async () => {
    // Dùng TEST_USERS.expired() tạo token với expiresIn '0s'
    // Sau khi jwt.sign, token đã past expiry → jwt.verify throw TokenExpiredError
    const expiredToken = TEST_USERS.expired();

    // Đợi 10ms để chắc chắn token đã expired
    await new Promise(r => setTimeout(r, 10));

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
  });

  // ── T-06b: Auth — token sai chữ ký (tampered) ────────────────────────────
  it('[AUTH] T-06b — 401: token bị tamper (sai chữ ký) → INVALID_TOKEN', async () => {
    // Lấy token hợp lệ rồi thay đổi signature phần cuối
    const validToken = TEST_USERS.employee();
    const parts = validToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature_xyz`;

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // ── T-07: RBAC — role không được phép ────────────────────────────────────
  it('[AUTH] T-07 — 403: role MANAGER gọi POST /trips (EMPLOYEE only) → FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.manager()}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');

    // Assert: service không được gọi khi bị forbidden
    expect(tripService.createTrip).not.toHaveBeenCalled();
  });

  // ── T-07b: RBAC — FINANCE role cũng bị từ chối ───────────────────────────
  it('[AUTH] T-07b — 403: role FINANCE gọi POST /trips (EMPLOYEE only) → FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.finance()}`)
      .send(VALID_TRIP_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  // ── T-08: Business Rule — budget > 20M → policy warning ──────────────────
  it('[BIZ] T-08 — 201 + warnings: budget > 20,000,000 → policy warning OVER_20M', async () => {
    // Arrange: service trả về trip + warnings khi budget vượt ngưỡng.
    // Warning shape dùng PerDiemWarning — cast để test response body trực tiếp.
    vi.mocked(tripService.createTrip).mockResolvedValueOnce({
      trip: { ...MOCK_TRIP, estimatedBudget: 25_000_000 },
      // Cast vì OVER_20M là policy warning từ policy.service, không phải PerDiemWarning.
      // Ở đây ta test behaviour của controller — service có thể trả về bất kỳ warning shape nào.
      warnings: [
        {
          code: 'POLICY_VIOLATION_PER_DIEM_EXCEEDED' as const,
          detail: 'Ngân sách vượt ngưỡng 20,000,000đ — cần phê duyệt Travel Admin',
          maxPerDiem: 20_000_000,
          actual: 25_000_000,
        },
      ],
    });

    const res = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send({ ...VALID_TRIP_PAYLOAD, estimatedBudget: 25_000_000 });

    // Assert: vẫn 201 (không block) nhưng có warnings
    expect(res.status).toBe(201);
    expect(res.body.data.estimatedBudget).toBe(25_000_000);

    // Assert: warnings array phải có ít nhất 1 item — quan trọng cho UI
    expect(res.body.warnings).toBeDefined();
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    // Assert: warning chứa thông tin detail cho user
    expect(res.body.warnings[0]).toHaveProperty('code');
    expect(res.body.warnings[0]).toHaveProperty('detail');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/trips/:id/submit — Submit chuyến đi
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/trips/:id/submit', () => {

  // ── S-01: Happy Path ────────────────────────────────────────────────────────
  it('[HAPPY] S-01 — 200: submit trip DRAFT thành công → status SUBMITTED', async () => {
    vi.mocked(tripService.submitTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'SUBMITTED',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/submit')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  // ── T-09: Business Rule — invalid state transition ─────────────────────────
  it('[BIZ] T-09 — 409: submit trip đã CLOSED → INVALID_STATUS_TRANSITION', async () => {
    // Arrange: service throw lỗi state machine (BR-TR-05)
    const { AppError } = await import('../middlewares/error-handler');
    vi.mocked(tripService.submitTrip).mockRejectedValueOnce(
      new AppError(409, 'INVALID_STATUS_TRANSITION', 'Không thể chuyển từ trạng thái CLOSED sang SUBMITTED.')
    );

    const res = await request(app)
      .post('/api/v1/trips/trip-closed-001/submit')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.message).toMatch(/CLOSED/);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/trips/:id/approve — Phê duyệt chuyến đi
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/trips/:id/approve', () => {

  // ── A-01: Happy Path ────────────────────────────────────────────────────────
  it('[HAPPY] A-01 — 200: MANAGER approve trip SUBMITTED', async () => {
    vi.mocked(tripService.approveTrip).mockResolvedValueOnce({
      ...MOCK_TRIP,
      status: 'MANAGER_REVIEWING',
    });

    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/approve')
      .set('Authorization', `Bearer ${TEST_USERS.manager()}`)
      .send({ comment: 'Đồng ý' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('MANAGER_REVIEWING');
  });

  // ── A-02: RBAC — EMPLOYEE không được approve ──────────────────────────────
  it('[AUTH] A-02 — 403: EMPLOYEE gọi approve (MANAGER/TRAVEL_ADMIN only) → FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/approve')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`)
      .send({ comment: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');

    // Assert: service approve không được gọi
    expect(tripService.approveTrip).not.toHaveBeenCalled();
  });

  // ── A-03: Auth — token không hợp lệ ──────────────────────────────────────
  it('[AUTH] A-03 — 401: gọi approve không có token → UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/trips/trip-uuid-001/approve')
      // Không set Authorization
      .send({ comment: 'Test' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/trips — List trips
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/trips', () => {

  it('[HAPPY] L-01 — 200: EMPLOYEE list trips của mình → paginated response', async () => {
    vi.mocked(tripService.getAllTrips).mockResolvedValueOnce({
      trips: [MOCK_TRIP],
      total: 1,
    });

    const res = await request(app)
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${TEST_USERS.employee()}`);

    expect(res.status).toBe(200);

    // Assert: paginated response structure
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: {
        page: expect.any(Number),
        limit: expect.any(Number),
        total: 1,
        totalPages: expect.any(Number),
      },
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].tripCode).toBe('TR-2099-0001');
  });

  it('[AUTH] L-02 — 401: list trips không có token → UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/trips');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

});
