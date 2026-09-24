/**
 * expense.service.test.ts — Unit Tests: Expense Service
 *
 * expense.service.ts có 2 loại function:
 *   1. Pure functions: calculateVariance, validateExpenseSubmit → không mock
 *   2. Prisma-backed: createExpense, addExpenseItem, submitExpense, ... → mock Prisma
 *
 * Business Rules:
 *   BR-TR-05 — Variance thresholds: ≤0% OK, 0-10% cần justification, >10% cần Manager
 *   BR-TR-06 — Immutable: expense SUBMITTED/APPROVED không thể edit
 *   Permission: chỉ owner (employeeId) được tạo/edit expense
 *
 * Test IDs: E-01 … E-39
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma & dependencies ───────────────────────────────────────────────
vi.mock('../../src/backend/src/prisma/client', () => ({
  default: {
    trip: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    expenseItem: {
      create:    vi.fn(),
      findFirst: vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      expense:     { update: vi.fn() },
      trip:        { update: vi.fn() },
      user:        { findMany: vi.fn().mockResolvedValue([]) },
    })),
  },
}));

vi.mock('../../src/backend/src/services/audit.service', () => ({
  logAudit:     vi.fn().mockResolvedValue(undefined),
  AuditActions: {
    EXPENSE_SUBMITTED:  'EXPENSE_SUBMITTED',
    EXPENSE_APPROVED:   'EXPENSE_APPROVED',
    EXPENSE_REJECTED:   'EXPENSE_REJECTED',
    MANAGER_REAPPROVED: 'MANAGER_REAPPROVED',
    TRIP_CREATED:       'TRIP_CREATED',
    TRIP_SUBMITTED:     'TRIP_SUBMITTED',
    MANAGER_APPROVED:   'MANAGER_APPROVED',
    MANAGER_REJECTED:   'MANAGER_REJECTED',
    ADMIN_APPROVED:     'ADMIN_APPROVED',
    ADMIN_REJECTED:     'ADMIN_REJECTED',
    TRIP_CLOSED:        'TRIP_CLOSED',
    EXPENSE_CREATED:    'EXPENSE_CREATED',
    USER_LOGIN:         'USER_LOGIN',
    USER_LOGOUT:        'USER_LOGOUT',
    TOKEN_REFRESHED:    'TOKEN_REFRESHED',
  },
}));

vi.mock('../../src/backend/src/services/notification.service', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import sau mock ──────────────────────────────────────────────────────────
import {
  calculateVariance,
  validateExpenseSubmit,
  createExpense,
  addExpenseItem,
  submitExpense,
  approveExpense,
  rejectExpense,
  reapproveExpense,
  VARIANCE_JUSTIFICATION_THRESHOLD,
  type VarianceResult,
} from '../../src/backend/src/services/expense.service';
import { AppError } from '../../src/backend/src/middlewares/error-handler';
import prisma from '../../src/backend/src/prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OWNER_ID    = 'user-emp-001';
const OTHER_USER  = 'user-other-999';
const MANAGER_ID  = 'user-mgr-001';
const TRIP_ID     = 'trip-uuid-001';
const EXPENSE_ID  = 'expense-uuid-001';
const ITEM_ID     = 'item-uuid-001';

function makeTripRecord(overrides: Record<string, unknown> = {}) {
  return {
    id:              TRIP_ID,
    employeeId:      OWNER_ID,
    estimatedBudget: 10_000_000,
    status:          'APPROVED',
    employee:        { managerId: MANAGER_ID },
    ...overrides,
  };
}

function makeExpenseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id:                      EXPENSE_ID,
    tripId:                  TRIP_ID,
    totalActual:             0,
    estimatedBudgetSnapshot: 10_000_000,
    status:                  'DRAFT',
    justification:           null,
    variancePct:             null,
    varianceAmount:          null,
    managerReapprovalRequired: false,
    managerReapproved:       false,
    managerReapproverId:     null,
    managerReapprovedAt:     null,
    submittedAt:             null,
    approvedAt:              null,
    items:                   [],
    trip:                    { employeeId: OWNER_ID },
    ...overrides,
  };
}

function makeItemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id:          ITEM_ID,
    expenseId:   EXPENSE_ID,
    expenseDate: new Date('2099-06-01'),
    category:    'MEAL',
    amount:      500_000,
    description: 'Ăn trưa với khách hàng',
    receiptUrl:  null,
    createdAt:   new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// calculateVariance — Pure Function Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateVariance — BR-TR-05', () => {

  // E-01
  it('[E-01] actual < budget → variancePct âm, không cần justification/reapproval', () => {
    const result = calculateVariance(8_000_000, 10_000_000);

    expect(result.variancePct).toBe(-20);
    expect(result.varianceAmount).toBe(-2_000_000);
    expect(result.requiresJustification).toBe(false);
    expect(result.requiresManagerReapproval).toBe(false);
    expect(result.totalActual).toBe(8_000_000);
    expect(result.estimatedBudget).toBe(10_000_000);
  });

  // E-02
  it('[E-02] actual = budget → variancePct = 0, không cần bất kỳ action nào (boundary)', () => {
    const result = calculateVariance(10_000_000, 10_000_000);

    expect(result.variancePct).toBe(0);
    expect(result.requiresJustification).toBe(false);
    expect(result.requiresManagerReapproval).toBe(false);
  });

  // E-03
  it('[E-03] variance 0 < pct ≤ 10% → requiresJustification=true, requiresManagerReapproval=false', () => {
    // 10.5M / 10M = +5% variance
    const result = calculateVariance(10_500_000, 10_000_000);

    expect(result.variancePct).toBe(5);
    expect(result.requiresJustification).toBe(true);
    expect(result.requiresManagerReapproval).toBe(false);
  });

  // E-04
  it('[E-04] variance đúng 10% → requiresJustification=true (boundary, ≤ threshold)', () => {
    // 11M / 10M = +10% variance
    const result = calculateVariance(11_000_000, 10_000_000);

    expect(result.variancePct).toBe(10);
    expect(result.requiresJustification).toBe(true);
    expect(result.requiresManagerReapproval).toBe(false);
  });

  // E-05
  it('[E-05] variance > 10% → requiresManagerReapproval=true, requiresJustification=false', () => {
    // 11.1M / 10M = +11% variance
    const result = calculateVariance(11_100_000, 10_000_000);

    expect(result.variancePct).toBeGreaterThan(10);
    expect(result.requiresManagerReapproval).toBe(true);
    expect(result.requiresJustification).toBe(false);
  });

  // E-06
  it('[E-06] estimatedBudget = 0 → throw Error (không thể chia cho 0)', () => {
    expect(() => calculateVariance(5_000_000, 0)).toThrow('estimatedBudget phải > 0');
  });

  // E-07
  it('[E-07] estimatedBudget < 0 → throw Error', () => {
    expect(() => calculateVariance(5_000_000, -1)).toThrow();
  });

  // E-08
  it('[E-08] variancePct được round về 2 decimal places', () => {
    // 10_333_333 / 10_000_000 - 1 = 3.33333...% → round 3.33
    const result = calculateVariance(10_333_333, 10_000_000);

    const decimals = result.variancePct.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it('[E-08b] VARIANCE_JUSTIFICATION_THRESHOLD = 10', () => {
    expect(VARIANCE_JUSTIFICATION_THRESHOLD).toBe(10);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// validateExpenseSubmit — Pure Function Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('validateExpenseSubmit', () => {

  function makeVariance(overrides: Partial<VarianceResult> = {}): VarianceResult {
    return {
      totalActual:              10_000_000,
      estimatedBudget:          10_000_000,
      variancePct:              0,
      varianceAmount:           0,
      requiresJustification:    false,
      requiresManagerReapproval: false,
      ...overrides,
    };
  }

  // E-09
  it('[E-09] happy path — variance ≤ 0%, không cần gì → valid=true', () => {
    const result = validateExpenseSubmit(makeVariance(), null);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // E-10
  it('[E-10] requiresJustification + có justification → valid=true', () => {
    const variance = makeVariance({ requiresJustification: true });
    const result   = validateExpenseSubmit(variance, 'Chi phí phát sinh do thay đổi kế hoạch');

    expect(result.valid).toBe(true);
  });

  // E-11
  it('[E-11] requiresJustification + justification = null → valid=false, error chứa %', () => {
    const variance = makeVariance({ variancePct: 5, requiresJustification: true });
    const result   = validateExpenseSubmit(variance, null);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5\.0%/);
    expect(result.error).toMatch(/giải trình/i);
  });

  // E-12
  it('[E-12] requiresJustification + justification chỉ có spaces → valid=false', () => {
    const variance = makeVariance({ variancePct: 5, requiresJustification: true });
    const result   = validateExpenseSubmit(variance, '   ');

    expect(result.valid).toBe(false);
  });

  // E-13
  it('[E-13] requiresManagerReapproval → valid=false, error chứa ">10%"', () => {
    const variance = makeVariance({ variancePct: 15, requiresManagerReapproval: true });
    const result   = validateExpenseSubmit(variance, null);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/15\.0%/);
    expect(result.error).toMatch(/Manager/i);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// createExpense — Prisma-backed
// ══════════════════════════════════════════════════════════════════════════════

describe('createExpense', () => {

  // E-14
  it('[E-14] happy path — trip APPROVED, owner → expense DRAFT được tạo', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.expense.create).mockResolvedValue(makeExpenseRecord() as never);

    const result = await createExpense(TRIP_ID, OWNER_ID);

    expect(prisma.expense.create).toHaveBeenCalledOnce();
    expect(result.status).toBe('DRAFT');
    expect(result.totalActual).toBe(0);
  });

  // E-15
  it('[E-15] trip ONGOING cũng được tạo expense', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(
      makeTripRecord({ status: 'ONGOING' }) as never
    );
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.expense.create).mockResolvedValue(makeExpenseRecord() as never);

    await createExpense(TRIP_ID, OWNER_ID);

    expect(prisma.expense.create).toHaveBeenCalledOnce();
  });

  // E-16
  it('[E-16] trip không tồn tại → TRIP_NOT_FOUND (404)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(null);

    const err = await createExpense('nonexistent', OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(404);
    expect((err as AppError).errorCode).toBe('TRIP_NOT_FOUND');
  });

  // E-17
  it('[E-17] user không phải owner → FORBIDDEN (403)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);

    const err = await createExpense(TRIP_ID, OTHER_USER).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect((err as AppError).errorCode).toBe('FORBIDDEN');
  });

  // E-18
  it('[E-18] trip status DRAFT (chưa approve) → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(
      makeTripRecord({ status: 'DRAFT' }) as never
    );

    const err = await createExpense(TRIP_ID, OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

  // E-19
  it('[E-19] expense đã tồn tại → INVALID_STATUS_TRANSITION (EXPENSE_EXISTS)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeExpenseRecord() as never);

    const err = await createExpense(TRIP_ID, OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
    expect((err as AppError).errorCode).toBe('INVALID_STATUS_TRANSITION');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// addExpenseItem — Prisma-backed
// ══════════════════════════════════════════════════════════════════════════════

describe('addExpenseItem', () => {

  const VALID_ITEM = {
    expenseDate: '2099-06-01',
    category:    'MEAL',
    amount:      500_000,
    description: 'Ăn trưa với khách hàng',
  };

  // E-20
  it('[E-20] happy path — item hợp lệ, expense DRAFT → tạo thành công', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeExpenseRecord() as never);
    vi.mocked(prisma.expenseItem.create).mockResolvedValue(makeItemRecord() as never);
    vi.mocked(prisma.expenseItem.aggregate).mockResolvedValue({
      _sum: { amount: 500_000 },
    } as never);
    vi.mocked(prisma.expense.update).mockResolvedValue(makeExpenseRecord() as never);

    const result = await addExpenseItem(TRIP_ID, OWNER_ID, VALID_ITEM);

    expect(prisma.expenseItem.create).toHaveBeenCalledOnce();
    expect(result.category).toBe('MEAL');
  });

  // E-21
  it('[E-21] category không hợp lệ → VALIDATION_ERROR (400)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeExpenseRecord() as never);

    const err = await addExpenseItem(TRIP_ID, OWNER_ID, {
      ...VALID_ITEM,
      category: 'INVALID_CATEGORY',
    }).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-22
  it('[E-22] amount = 0 → VALIDATION_ERROR (400)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeExpenseRecord() as never);

    const err = await addExpenseItem(TRIP_ID, OWNER_ID, {
      ...VALID_ITEM,
      amount: 0,
    }).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-23
  it('[E-23] expense status SUBMITTED → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'SUBMITTED' }) as never
    );

    const err = await addExpenseItem(TRIP_ID, OWNER_ID, VALID_ITEM).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

  // E-24
  it('[E-24] expense status REJECTED → được phép thêm item (state REJECTED cho phép)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'REJECTED' }) as never
    );
    vi.mocked(prisma.expenseItem.create).mockResolvedValue(makeItemRecord() as never);
    vi.mocked(prisma.expenseItem.aggregate).mockResolvedValue({
      _sum: { amount: 500_000 },
    } as never);
    vi.mocked(prisma.expense.update).mockResolvedValue(makeExpenseRecord() as never);

    await addExpenseItem(TRIP_ID, OWNER_ID, VALID_ITEM);

    expect(prisma.expenseItem.create).toHaveBeenCalledOnce();
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// submitExpense — BR-TR-05
// ══════════════════════════════════════════════════════════════════════════════

describe('submitExpense — BR-TR-05', () => {

  // E-25
  it('[E-25] happy path — DRAFT, có items, variance ≤ 0% → SUBMITTED', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({
        totalActual: 8_000_000,  // < 10M → variance âm → không cần justification
        items: [makeItemRecord()],
      }) as never
    );

    // $transaction mock cần trả về expense updated
    const updatedExpense = makeExpenseRecord({ status: 'SUBMITTED' });
    vi.mocked(prisma.$transaction).mockImplementation((((fn: (tx: unknown) => unknown) => {
      const mockTx = {
        expense: { update: vi.fn().mockResolvedValue(updatedExpense) },
        trip:    { update: vi.fn().mockResolvedValue({}) },
        user:    { findMany: vi.fn().mockResolvedValue([]) },
      };
      return fn(mockTx) as Promise<unknown>;
    }) as unknown) as never);

    const result = await submitExpense(TRIP_ID, OWNER_ID);
    expect(result).toBeDefined();
  });

  // E-26
  it('[E-26] expense không có items → VALIDATION_ERROR (400)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ items: [] }) as never
    );

    const err = await submitExpense(TRIP_ID, OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-27: variance 0-10%, thiếu justification → VALIDATION_ERROR
  it('[E-27] variance 0-10% nhưng thiếu justification → VALIDATION_ERROR (BR-TR-05)', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({
        totalActual:             10_500_000, // +5% variance
        estimatedBudgetSnapshot: 10_000_000,
        justification:           null,       // không có justification
        items: [makeItemRecord()],
      }) as never
    );

    const err = await submitExpense(TRIP_ID, OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-28: expense không ở DRAFT
  it('[E-28] expense không ở DRAFT (đã SUBMITTED) → INVALID_STATUS_TRANSITION', async () => {
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(makeTripRecord() as never);
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'SUBMITTED', items: [makeItemRecord()] }) as never
    );

    const err = await submitExpense(TRIP_ID, OWNER_ID).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// rejectExpense
// ══════════════════════════════════════════════════════════════════════════════

describe('rejectExpense', () => {

  // E-29
  it('[E-29] happy path — comment hợp lệ, expense SUBMITTED', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'SUBMITTED' }) as never
    );

    const updatedExpense = makeExpenseRecord({ status: 'REJECTED' });
    vi.mocked(prisma.$transaction).mockImplementation((((fn: (tx: unknown) => unknown) => {
      return fn({
        expense: { update: vi.fn().mockResolvedValue(updatedExpense) },
        trip:    { update: vi.fn().mockResolvedValue({}) },
      }) as Promise<unknown>;
    }) as unknown) as never);

    const result = await rejectExpense(TRIP_ID, OTHER_USER, 'Chi phí không hợp lệ');
    expect(result).toBeDefined();
  });

  // E-30
  it('[E-30] comment rỗng → VALIDATION_ERROR (400)', async () => {
    const err = await rejectExpense(TRIP_ID, OTHER_USER, '').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-31
  it('[E-31] expense status DRAFT (không phải SUBMITTED) → INVALID_STATUS_TRANSITION', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'DRAFT' }) as never
    );

    const err = await rejectExpense(TRIP_ID, OTHER_USER, 'Lý do từ chối').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// approveExpense
// ══════════════════════════════════════════════════════════════════════════════

describe('approveExpense', () => {

  // E-32
  it('[E-32] happy path — expense SUBMITTED, không cần reapproval → APPROVED', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'SUBMITTED', managerReapprovalRequired: false }) as never
    );

    const updatedExpense = makeExpenseRecord({ status: 'APPROVED' });
    vi.mocked(prisma.$transaction).mockImplementation((((fn: (tx: unknown) => unknown) => {
      return fn({
        expense: { update: vi.fn().mockResolvedValue(updatedExpense) },
        trip:    { update: vi.fn().mockResolvedValue({}) },
      }) as Promise<unknown>;
    }) as unknown) as never);

    const result = await approveExpense(TRIP_ID, OTHER_USER);
    expect(result).toBeDefined();
  });

  // E-33: cần reapproval nhưng chưa reapprove
  it('[E-33] managerReapprovalRequired=true nhưng chưa reapprove → VALIDATION_ERROR (BR-TR-05)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({
        status:                    'SUBMITTED',
        managerReapprovalRequired: true,
        managerReapproved:         false,
      }) as never
    );

    const err = await approveExpense(TRIP_ID, OTHER_USER).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-34
  it('[E-34] expense không SUBMITTED → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeExpenseRecord({ status: 'DRAFT' }) as never
    );

    const err = await approveExpense(TRIP_ID, OTHER_USER).catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// reapproveExpense
// ══════════════════════════════════════════════════════════════════════════════

describe('reapproveExpense', () => {

  function makeReapproveExpense(overrides: Record<string, unknown> = {}) {
    return makeExpenseRecord({
      status:                    'SUBMITTED',
      managerReapprovalRequired: true,
      trip: {
        employeeId: OWNER_ID,
        employee:   { managerId: MANAGER_ID },
      },
      ...overrides,
    });
  }

  // E-35
  it('[E-35] happy path APPROVED — manager đúng người', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeReapproveExpense() as never);
    vi.mocked(prisma.expense.update).mockResolvedValue(
      makeExpenseRecord({ managerReapproved: true }) as never
    );

    const result = await reapproveExpense(TRIP_ID, MANAGER_ID, 'APPROVED');
    expect(prisma.expense.update).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
  });

  // E-36
  it('[E-36] managerReapprovalRequired=false → FORBIDDEN (không cần reapprove)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeReapproveExpense({ managerReapprovalRequired: false }) as never
    );

    const err = await reapproveExpense(TRIP_ID, MANAGER_ID, 'APPROVED').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect((err as AppError).errorCode).toBe('FORBIDDEN');
  });

  // E-37
  it('[E-37] user không phải manager của employee → FORBIDDEN (permission)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeReapproveExpense() as never);

    const err = await reapproveExpense(TRIP_ID, OTHER_USER, 'APPROVED').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect((err as AppError).errorCode).toBe('FORBIDDEN');
  });

  // E-38
  it('[E-38] action=REJECTED nhưng không có comment → VALIDATION_ERROR (400)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(makeReapproveExpense() as never);

    const err = await reapproveExpense(TRIP_ID, MANAGER_ID, 'REJECTED', '').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).errorCode).toBe('VALIDATION_ERROR');
  });

  // E-39
  it('[E-39] expense không SUBMITTED → INVALID_STATUS_TRANSITION (409)', async () => {
    vi.mocked(prisma.expense.findUnique).mockResolvedValue(
      makeReapproveExpense({ status: 'DRAFT' }) as never
    );

    const err = await reapproveExpense(TRIP_ID, MANAGER_ID, 'APPROVED').catch(e => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(409);
  });

});
