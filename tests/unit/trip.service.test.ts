/**
 * trip.service.test.ts — Unit Tests: Trip Service
 *
 * trip.service.ts dùng Prisma + audit + notification — tất cả đều bị mock.
 * $transaction được mock để execute callback đồng bộ trong test.
 *
 * Business Logic được test:
 *   - createTrip: DRAFT, isUrgent, urgencyReason, perDiem warning
 *   - updateTrip: owner check, status check, NOT_FOUND
 *   - deleteTrip: owner check, status check, NOT_FOUND
 *   - submitTrip: DRAFT → SUBMITTED, policy check, NOT_FOUND, FORBIDDEN
 *   - approveTrip: RBAC, ownership (BUG-01), routing (BR-TR-04)
 *   - rejectTrip:  RBAC, ownership (BUG-02), comment validation
 *   - closeTrip:   expense status check, TRIP_IMMUTABLE
 *   - VALID_TRANSITIONS: state machine export
 *
 * Test IDs: T-01 … T-35
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
// vi.mock phải khai báo trước import service (hoisted tự động)
vi.mock('../../src/backend/src/prisma/client', () => ({
  default: {
    trip: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
      count:      vi.fn(),
      findMany:   vi.fn(),
    },
    user:              { findUnique: vi.fn() },
    policyCheckResult: { upsert: vi.fn() },
    approvalRecord:    { create: vi.fn() },
    expense:           { findUnique: vi.fn(), update: vi.fn() },
    auditLog:          { create: vi.fn() },
    notification:      { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      // Execute callback với mock tx có cùng shape
      return fn({
        trip:              { findUnique: vi.fn(), update: vi.fn() },
        user:              { findUnique: vi.fn() },
        policyCheckResult: { upsert: vi.fn() },
        approvalRecord:    { create: vi.fn() },
        expense:           { update: vi.fn() },
        $queryRaw:         vi.fn(),
      });
    }),
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../../src/backend/src/services/audit.service', () => ({
  logAudit:     vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    TRIP_CREATED:     'TRIP_CREATED',
    TRIP_SUBMITTED:   'TRIP_SUBMITTED',
    MANAGER_APPROVED: 'MANAGER_APPROVED',
    MANAGER_REJECTED: 'MANAGER_REJECTED',
    ADMIN_APPROVED:   'ADMIN_APPROVED',
    ADMIN_REJECTED:   'ADMIN_REJECTED',
    TRIP_CLOSED:      'TRIP_CLOSED',
    EXPENSE_SUBMITTED: 'EXPENSE_SUBMITTED',
    EXPENSE_APPROVED:  'EXPENSE_APPROVED',
    EXPENSE_REJECTED:  'EXPENSE_REJECTED',
    MANAGER_REAPPROVED: 'MANAGER_REAPPROVED',
    USER_LOGIN:        'USER_LOGIN',
    USER_LOGOUT:       'USER_LOGOUT',
    TOKEN_REFRESHED:   'TOKEN_REFRESHED',
  },
}));

vi.mock('../../src/backend/src/services/notification.service', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import service sau khi mock ──────────────────────────────────────────────
import {
  createTrip,
  updateTrip,
  deleteTrip,
  VALID_TRANSITIONS,
} from '../../src/backend/src/services/trip.service';
import { AppError } from '../../src/backend/src/middlewares/error-handler';
import { logAudit } from '../../src/backend/src/services/audit.service';
import prisma from '../../src/backend/src/prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPLOYEE_ID = 'user-emp-001';
const OTHER_USER  = 'user-other-999';
const TRIP_ID     = 'trip-uuid-001';

/** Base trip record từ DB */
function makeTripRecord(overrides: Record<string, unknown> = {}) {
  return {
    id:               TRIP_ID,
    tripCode:         'TR-2099-0001',
    employeeId:       EMPLOYEE_ID,
    origin:           'Hà Nội',
    destination:      'TP. Hồ Chí Minh',
    destinationType:  'TIER1_CITY',
    departureDate:    new Date('2099-06-01T00:00:00.000Z'),
    returnDate:       new Date('2099-06-05T00:00:00.000Z'),
    purpose:          'Hội nghị khách hàng phía Nam',
    estimatedBudget:  8_000_000,
    hotelCostPerNight: null,
    hotelNights:       null,
    perDiemBudget:     null,
    transportBudget:   null,
    otherBudget:       null,
    status:            'DRAFT',
    isUrgent:          false,
    urgencyReason:     null,
    requiresLevel2:    false,
    createdAt:         new Date('2026-09-01T00:00:00.000Z'),
    updatedAt:         new Date('2026-09-01T00:00:00.000Z'),
    submittedAt:       null,
    approvedAt:        null,
    closedAt:          null,
    employee:          { id: EMPLOYEE_ID, managerId: 'manager-001' },
    policyCheckResult: null,
    ...overrides,
  };
}

/** Base createTrip input */
const VALID_INPUT = {
  origin:          'Hà Nội',
  destination:     'TP. Hồ Chí Minh',
  destinationType: 'TIER1_CITY' as const,
  departureDate:   '2099-06-01',
  returnDate:      '2099-06-05',
  purpose:         'Hội nghị khách hàng phía Nam',
  estimatedBudget: 8_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// T-01: VALID_TRANSITIONS
// ══════════════════════════════════════════════════════════════════════════════

describe('VALID_TRANSITIONS — state machine', () => {

  // T-01
  it('[T-01] DRAFT chỉ được chuyển sang SUBMITTED', () => {
    expect(VALID_TRANSITIONS['DRAFT']).toEqual(['SUBMITTED']);
  });

  it('[T-01b] CLOSED không có transition hợp lệ (terminal state)', () => {
    expect(VALID_TRANSITIONS['CLOSED']).toEqual([]);
  });

  it('[T-01c] REJECTED không có transition hợp lệ (terminal state)', () => {
    expect(VALID_TRANSITIONS['REJECTED']).toEqual([]);
  });

  it('[T-01d] SUBMITTED có thể → MANAGER_REVIEWING hoặc REJECTED', () => {
    expect(VALID_TRANSITIONS['SUBMITTED']).toContain('MANAGER_REVIEWING');
    expect(VALID_TRANSITIONS['SUBMITTED']).toContain('REJECTED');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// createTrip
// ══════════════════════════════════════════════════════════════════════════════

describe('createTrip', () => {

  // T-02: Happy path
  it('[T-02] happy path — trip bình thường, không khẩn cấp, warnings=[]', async () => {
    const mockTrip = makeTripRecord();
    vi.mocked(prisma.trip.count).mockResolvedValue(0);
    vi.mocked(prisma.trip.create).mockResolvedValue(mockTrip as never);

    const result = await createTrip(EMPLOYEE_ID, VALID_INPUT);

    expect(result.trip.status).toBe('DRAFT');
    expect(result.trip.employeeId).toBe(EMPLOYEE_ID);
    expect(result.warnings).toHaveLength(0);
  });

  // T-03: perDiem warning
  it('[T-03] perDiem vượt hạn mức → warnings không rỗng', async () => {
    const mockTrip = makeTripRecord({ perDiemBudget: 5_000_000 });
    vi.mocked(prisma.trip.count).mockResolvedValue(0);
    vi.mocked(prisma.trip.create).mockResolvedValue(mockTrip as never);

    // 4 ngày × 400k TIER1_CITY = 1.6M max; gửi 5M → warning
    const result = await createTrip(EMPLOYEE_ID, {
      ...VALID_INPUT,
      perDiemBudget: 5_000_000,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe('POLICY_VIOLATION_PER_DIEM_EXCEEDED');
  });

  // T-04: isUrgent = true, có urgencyReason hợp lệ
  it('[T-04] chuyến khẩn cấp với urgencyReason đủ 10 ký tự → tạo thành công', async () => {
    // Ngày khởi hành = ngày mai → workingDays < 3
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
    const dayAfter    = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dayAfterStr = dayAfter.toISOString().split('T')[0]!;

    const mockTrip = makeTripRecord({ isUrgent: true, departureDate: tomorrow });
    vi.mocked(prisma.trip.count).mockResolvedValue(0);
    vi.mocked(prisma.trip.create).mockResolvedValue(mockTrip as never);

    const result = await createTrip(EMPLOYEE_ID, {
      ...VALID_INPUT,
      departureDate:  tomorrowStr,
      returnDate:     dayAfterStr,
      urgencyReason: 'Khẩn cấp vì khách hàng yêu cầu gấp',
    });

    expect(result.trip.isUrgent).toBe(true);
  });

  // T-05: isUrgent, urgencyReason rỗng → VALIDATION_ERROR
  it('[T-05] chuyến khẩn cấp không có urgencyReason → VALIDATION_ERROR', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
    const dayAfter    = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dayAfterStr = dayAfter.toISOString().split('T')[0]!;

    vi.mocked(prisma.trip.count).mockResolvedValue(0);

    await expect(
      createTrip(EMPLOYEE_ID, {
        ...VALID_INPUT,
        departureDate: tomorrowStr,
        returnDate:    dayAfterStr,
        // urgencyReason: không truyền
      })
    ).rejects.toThrow(AppError);

    const call = createTrip(EMPLOYEE_ID, {
      ...VALID_INPUT,
      departureDate: tomorrowStr,
      returnDate:    dayAfterStr,
    }).catch(e => e);
    const err = await call;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // T-06: urgencyReason quá ngắn (< 10 ký tự)
  it('[T-06] urgencyReason < 10 ký tự → VALIDATION_ERROR', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
    const dayAfter    = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dayAfterStr = dayAfter.toISOString().split('T')[0]!;

    vi.mocked(prisma.trip.count).mockResolvedValue(0);

    const err = await createTrip(EMPLOYEE_ID, {
      ...VALID_INPUT,
      departureDate:  tomorrowStr,
      returnDate:     dayAfterStr,
      urgencyReason: 'Ngắn',  // < 10 ký tự
    }).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
  });

  // T-07: prisma.trip.create được gọi đúng 1 lần
  it('[T-07] prisma.trip.create được gọi đúng 1 lần với input hợp lệ', async () => {
    vi.mocked(prisma.trip.count).mockResolvedValue(0);
    vi.mocked(prisma.trip.create).mockResolvedValue(makeTripRecord() as never);

    await createTrip(EMPLOYEE_ID, VALID_INPUT);

    expect(prisma.trip.create).toHaveBeenCalledOnce();
  });

  // T-08: logAudit được gọi với TRIP_CREATED
  it('[T-08] logAudit được gọi với action TRIP_CREATED sau createTrip', async () => {
    vi.mocked(prisma.trip.count).mockResolvedValue(0);
    vi.mocked(prisma.trip.create).mockResolvedValue(makeTripRecord() as never);

    await createTrip(EMPLOYEE_ID, VALID_INPUT);

    expect(logAudit).toHaveBeenCalledOnce();
    expect(vi.mocked(logAudit).mock.calls[0]?.[0]?.action).toBe('TRIP_CREATED');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// updateTrip
// ══════════════════════════════════════════════════════════════════════════════

describe('updateTrip', () => {

  // T-09: Happy path
  it('[T-09] happy path — owner update DRAFT trip', async () => {
    const mockTrip    = makeTripRecord();
    const updatedTrip = makeTripRecord({ destination: 'Đà Nẵng' });
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(mockTrip as never);
    vi.mocked(prisma.trip.update).mockResolvedValue(updatedTrip as never);

    const result = await updateTrip(TRIP_ID, EMPLOYEE_ID, { destination: 'Đà Nẵng' });

    expect(prisma.trip.update).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
  });

  // T-10: Trip không tồn tại
  it('[T-10] trip không tồn tại → TRIP_NOT_FOUND (404)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const err = await updateTrip('nonexistent', EMPLOYEE_ID, {}).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(404);
    expect((err as AppError).errorCode).toBe('TRIP_NOT_FOUND');
  });

  // T-11: User không phải owner
  it('[T-11] user không phải owner → FORBIDDEN (403)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);

    const err = await updateTrip(TRIP_ID, OTHER_USER, {}).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect((err as AppError).errorCode).toBe('FORBIDDEN');
  });

  // T-12: Trip không ở DRAFT
  it('[T-12] trip status SUBMITTED → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(
      makeTripRecord({ status: 'SUBMITTED' }) as never
    );

    const err = await updateTrip(TRIP_ID, EMPLOYEE_ID, {}).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
    expect((err as AppError).errorCode).toBe('INVALID_STATUS_TRANSITION');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// deleteTrip
// ══════════════════════════════════════════════════════════════════════════════

describe('deleteTrip', () => {

  // T-13: Happy path
  it('[T-13] happy path — owner xóa DRAFT trip', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.trip.delete).mockResolvedValue(makeTripRecord() as never);

    await deleteTrip(TRIP_ID, EMPLOYEE_ID);

    expect(prisma.trip.delete).toHaveBeenCalledOnce();
    expect(prisma.trip.delete).toHaveBeenCalledWith({ where: { id: TRIP_ID } });
  });

  // T-14: Trip không tồn tại
  it('[T-14] trip không tồn tại → TRIP_NOT_FOUND (404)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const err = await deleteTrip('nonexistent', EMPLOYEE_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(404);
    expect((err as AppError).errorCode).toBe('TRIP_NOT_FOUND');
  });

  // T-15: User không phải owner
  it('[T-15] user không phải owner → FORBIDDEN (403)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);

    const err = await deleteTrip(TRIP_ID, OTHER_USER).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  // T-16: Trip không phải DRAFT
  it('[T-16] trip status SUBMITTED → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(
      makeTripRecord({ status: 'SUBMITTED' }) as never
    );

    const err = await deleteTrip(TRIP_ID, EMPLOYEE_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
    expect((err as AppError).errorCode).toBe('INVALID_STATUS_TRANSITION');
  });

  it('[T-16b] trip status CLOSED → INVALID_STATUS_TRANSITION', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(
      makeTripRecord({ status: 'CLOSED' }) as never
    );

    const err = await deleteTrip(TRIP_ID, EMPLOYEE_ID).catch(e => e);

    expect((err as AppError).statusCode).toBe(409);
  });

});
