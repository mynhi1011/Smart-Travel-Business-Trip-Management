/**
 * expense.service.ts — Expense Service
 * API.md §8-§9 | BR-TR-05 (variance) | BR-TR-06 (immutable)
 *
 * File duy nhất cho toàn bộ expense logic.
 * Trước đây bị tách thành expense.service.ts (helpers) + expense.service.full.ts (CRUD);
 * đã được merge lại để loại bỏ circular dependency và confusion.
 *
 * BR-TR-05 — Variance thresholds:
 *   variance ≤ 0%       → Finance approve bình thường
 *   0 < variance ≤ 10%  → Cần Employee nhập justification
 *   variance > 10%      → Block Finance close; cần Manager re-approve trước
 *
 * Tài liệu tham chiếu: architecture.md §5.3, business-rules.md BR-TR-05, API.md §8-§9
 */

import prisma from '../prisma/client';
import type { Prisma } from '@prisma/client';
import { runMutation, assertMutableTrip } from './mutation.service';
import { Errors } from '../middlewares/error-handler';
import { logAudit, AuditActions } from './audit.service';
import { createNotification } from './notification.service';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & TYPES
// ══════════════════════════════════════════════════════════════════════════════

/** Ngưỡng variance cần giải trình (%) — BR-TR-05 */
export const VARIANCE_JUSTIFICATION_THRESHOLD = 10;

const EXPENSE_CATEGORIES = ['ACCOMMODATION', 'TRANSPORT', 'MEAL', 'PER_DIEM', 'OTHER'];

export interface VarianceResult {
  totalActual: number;
  estimatedBudget: number;
  variancePct: number;                  // Tỷ lệ % = (actual - estimated) / estimated * 100
  varianceAmount: number;               // Số tiền chênh lệch (VNĐ)
  requiresJustification: boolean;       // 0 < variance ≤ 10%
  requiresManagerReapproval: boolean;   // variance > 10%
}

export interface ExpenseItemInput {
  expenseDate: string;
  category:    string;
  amount:      number;
  description: string;
  receiptUrl?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// VARIANCE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * exceedsManagerThreshold — So sánh ngưỡng BR-TR-05 trên giá trị THÔ bằng số nguyên.
 *
 * Chỉ cần Manager duyệt bổ sung khi `actual / budget > 110%`. Quy về số nguyên
 * (đơn vị hundredths) để loại bỏ sai số dấu phẩy động:
 *
 *   actualHundredths * 100 > budgetHundredths * 110   ⇔   actual / budget > 1.10
 *
 * KHÔNG dùng giá trị % đã làm tròn để quyết định.
 * `budget ≤ 0` ⇒ mọi khoản chi > 0 đều tính là vượt ngưỡng (an toàn, không chia cho 0).
 *
 * @param totalActual - Tổng chi phí thực tế (VNĐ)
 * @param estimatedBudget - Dự toán ban đầu (VNĐ)
 */
export function exceedsManagerThreshold(
  totalActual: number,
  estimatedBudget: number
): boolean {
  const actualHundredths = Math.round(totalActual * 100);
  const budgetHundredths = Math.round(estimatedBudget * 100);

  if (budgetHundredths <= 0) return actualHundredths > 0;

  return (
    actualHundredths * 100 > budgetHundredths * (100 + VARIANCE_JUSTIFICATION_THRESHOLD)
  );
}

/**
 * calculateVariance — NGUỒN DUY NHẤT tính variance giữa chi phí thực tế và dự toán
 * (BR-TR-05). Mọi nơi cần variancePct / varianceAmount / requiresManagerReapproval
 * đều phải gọi hàm này.
 *
 * - Quyết định ngưỡng (requiresManagerReapproval) so sánh trên giá trị THÔ bằng số
 *   nguyên — xem `exceedsManagerThreshold`.
 * - `variancePct` chỉ được làm tròn 2 chữ số thập phân để LƯU/HIỂN THỊ.
 *
 * @param totalActual - Tổng chi phí thực tế (VNĐ)
 * @param estimatedBudget - Dự toán ban đầu (VNĐ)
 * @returns VarianceResult với đầy đủ thông tin chênh lệch
 */
export function calculateVariance(
  totalActual: number,
  estimatedBudget: number
): VarianceResult {
  if (estimatedBudget <= 0) {
    throw new Error('estimatedBudget phải > 0 để tính variance');
  }

  const varianceAmount = totalActual - estimatedBudget;
  const variancePctRaw = (varianceAmount / estimatedBudget) * 100;

  // CHỈ làm tròn khi lưu/hiển thị (NUMERIC(6,2) trong PostgreSQL spec) — không dùng để so ngưỡng
  const variancePct = Math.round(variancePctRaw * 100) / 100;

  const requiresManagerReapproval = exceedsManagerThreshold(totalActual, estimatedBudget);

  return {
    totalActual,
    estimatedBudget,
    variancePct,
    varianceAmount,
    // BR-TR-05: vượt dự toán (mọi mức) ⇒ bắt buộc giải trình; >10% thì Manager lo phần bổ sung
    requiresJustification: varianceAmount > 0 && !requiresManagerReapproval,
    requiresManagerReapproval,
  };
}

/**
 * validateExpenseSubmit — Validate hồ sơ trước khi submit (BR-TR-05).
 *
 * Quyết định mới: MỌI mức vượt dự toán (varianceAmount > 0, tính trên giá trị THÔ)
 * đều bắt buộc giải trình. Vượt >10% KHÔNG chặn submit — hồ sơ được chuyển cho
 * Manager duyệt bổ sung (trip = MANAGER_REAPPROVE).
 *
 * @returns { valid: true } | { valid: false, error: string }
 */
export function validateExpenseSubmit(
  variance: VarianceResult,
  justification: string | null
): { valid: boolean; error?: string } {
  // BR-TR-05: chỉ variance dương đến 10% cần giải trình;
  // variance >10% chuyển Manager re-approve và không chặn submit ở đây.
  if (
    variance.varianceAmount > 0 &&
    variance.variancePct <= VARIANCE_JUSTIFICATION_THRESHOLD &&
    !justification?.trim()
  ) {
    return {
      valid: false,
      error: `Chi phí vượt dự toán ${variance.variancePct.toFixed(1)}%. Vui lòng nhập lý do giải trình.`,
    };
  }

  return { valid: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Tính lại totalActual sau khi thêm/sửa/xóa expense item */
async function recalcTotal(expenseId: string, tx: Prisma.TransactionClient) {
  const agg = await tx.expenseItem.aggregate({
    where: { expenseId },
    _sum: { amount: true },
  });
  await tx.expense.update({
    where: { id: expenseId },
    data: { totalActual: agg._sum.amount ?? 0 },
  });
}

/** Assert user là owner của trip, trả về trip record */
async function assertExpenseOwner(tripId: string, userId: string, tx: Prisma.TransactionClient) {
  const trip = await tx.trip.findUnique({
    where: { id: tripId },
    select: {
      employeeId: true,
      estimatedBudget: true,
      status: true,
      employee: { select: { managerId: true } },
    },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
  return trip;
}

// ══════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

// ─── getExpense ───────────────────────────────────────────────────────────────
export async function getExpense(tripId: string, userId: string, userRole: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { employeeId: true, employee: { select: { managerId: true } } },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();

  const canRead =
    userRole === 'FINANCE' ||
    userRole === 'ADMIN' ||
    trip.employeeId === userId ||
    (userRole === 'MANAGER' && trip.employee.managerId === userId);
  if (!canRead) throw Errors.FORBIDDEN();

  const expense = await prisma.expense.findUnique({
    where: { tripId },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });
  if (!expense) throw Errors.NOT_FOUND('expense');
  return expense;
}

// ─── createExpense ────────────────────────────────────────────────────────────
export async function createExpense(tripId: string, userId: string) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const trip = await assertExpenseOwner(tripId, userId, tx);

    if (!['APPROVED', 'ONGOING', 'EXPENSE_DRAFT'].includes(trip.status))
      throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'APPROVED|ONGOING|EXPENSE_DRAFT required');

    const existing = await tx.expense.findUnique({ where: { tripId } });
    if (existing) throw Errors.INVALID_STATUS_TRANSITION('EXPENSE_EXISTS', 'already created');

    const expense = await tx.expense.create({
      data: {
        tripId,
        totalActual:             0,
        estimatedBudgetSnapshot: trip.estimatedBudget,
        status:                  'DRAFT',
      },
    });

    // Bắt đầu kê khai = kết thúc giai đoạn công tác (workflows.md: ONGOING → EXPENSE_DRAFT)
    if (trip.status === 'ONGOING') {
      await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_DRAFT' } });
    }

    return expense;
  });
}

// ─── updateExpense (justification only) ──────────────────────────────────────
export async function updateExpense(tripId: string, userId: string, justification: string) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    await assertExpenseOwner(tripId, userId, tx);
    const expense = await tx.expense.findUnique({ where: { tripId } });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (expense.status !== 'DRAFT') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT');

    return tx.expense.update({ where: { tripId }, data: { justification } });
  });
}

// ─── addExpenseItem ───────────────────────────────────────────────────────────
export async function addExpenseItem(tripId: string, userId: string, data: ExpenseItemInput, requestKey?: string) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    await assertExpenseOwner(tripId, userId, tx);
    const expense = await tx.expense.findUnique({ where: { tripId } });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (!['DRAFT', 'REJECTED'].includes(expense.status))
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

    if (!EXPENSE_CATEGORIES.includes(data.category))
      throw Errors.VALIDATION_ERROR({ fieldErrors: { category: ['Invalid category'] }, formErrors: [] });
    if (!data.amount || data.amount <= 0)
      throw Errors.VALIDATION_ERROR({ fieldErrors: { amount: ['Amount must be > 0'] }, formErrors: [] });

    const item = await tx.expenseItem.create({
      data: {
        expenseId:   expense.id,
        expenseDate: new Date(data.expenseDate + 'T00:00:00.000Z'),
        category:    data.category,
        amount:      data.amount,
        description: data.description.trim(),
        receiptUrl:  data.receiptUrl ?? null,
      },
    });
    await recalcTotal(expense.id, tx);
    return item;
  }, { scope: 'addExpenseItem:' + userId + ':' + tripId, key: requestKey, payload: [tripId, userId, data] });
}

// ─── updateExpenseItem ────────────────────────────────────────────────────────
export async function updateExpenseItem(
  tripId: string,
  itemId: string,
  userId: string,
  data: Partial<ExpenseItemInput>
) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    await assertExpenseOwner(tripId, userId, tx);
    const expense = await tx.expense.findUnique({ where: { tripId } });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (!['DRAFT', 'REJECTED'].includes(expense.status))
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

    const item = await tx.expenseItem.findFirst({
      where: { id: itemId, expenseId: expense.id },
    });
    if (!item) throw Errors.NOT_FOUND('expense item');

    const updated = await tx.expenseItem.update({
      where: { id: itemId },
      data: {
        ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate + 'T00:00:00.000Z') }),
        ...(data.category    !== undefined && { category:    data.category }),
        ...(data.amount      !== undefined && { amount:      data.amount }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.receiptUrl  !== undefined && { receiptUrl:  data.receiptUrl }),
      },
    });
    await recalcTotal(expense.id, tx);
    return updated;
  });
}

// ─── deleteExpenseItem ────────────────────────────────────────────────────────
export async function deleteExpenseItem(tripId: string, itemId: string, userId: string) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    await assertExpenseOwner(tripId, userId, tx);
    const expense = await tx.expense.findUnique({ where: { tripId } });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (!['DRAFT', 'REJECTED'].includes(expense.status))
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

    const item = await tx.expenseItem.findFirst({
      where: { id: itemId, expenseId: expense.id },
    });
    if (!item) throw Errors.NOT_FOUND('expense item');

    await tx.expenseItem.delete({ where: { id: itemId } });
    await recalcTotal(expense.id, tx);
  });
}

// ─── submitExpense (BR-TR-05) ─────────────────────────────────────────────────
export async function submitExpense(tripId: string, userId: string, ipAddress?: string) {
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    const trip = await assertExpenseOwner(tripId, userId, tx);

    const expense = await tx.expense.findUnique({
      where: { tripId },
      include: { items: true },
    });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (expense.status !== 'DRAFT') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT');
    if (expense.items.length === 0)
      throw Errors.VALIDATION_ERROR({
        fieldErrors: { items: ['At least 1 expense item required'] },
        formErrors: [],
      });

    // Tính variance theo BR-TR-05
    const totalActual = expense.items.reduce((sum, item) => sum + item.amount, 0);
    const variance = calculateVariance(totalActual, expense.estimatedBudgetSnapshot);

    // BR-TR-05: MỌI mức vượt dự toán (giá trị thô) đều bắt buộc nhập justification
    // — dùng chung validateExpenseSubmit (một nguồn logic duy nhất)
    const submitCheck = validateExpenseSubmit(variance, expense.justification);
    if (!submitCheck.valid)
      throw Errors.VALIDATION_ERROR({
        fieldErrors: { justification: [submitCheck.error ?? 'Justification required when actual exceeds budget'] },
        formErrors: [],
      });

    const managerReapprovalRequired = variance.requiresManagerReapproval;

    // BR-TR-05 (quyết định mới): vượt >10% trên giá trị THÔ ⇒ submit xong hồ sơ chuyển
    // THẲNG cho Manager (trip = MANAGER_REAPPROVE) — Finance chưa thấy, chưa thao tác được.
    // Ngược lại (≤10%): vào thẳng hàng đợi Finance (trip = EXPENSE_SUBMITTED).
    const nextTripStatus = managerReapprovalRequired ? 'MANAGER_REAPPROVE' : 'EXPENSE_SUBMITTED';

    const updated = await (async () => {
      const exp = await tx.expense.update({
        where: { tripId },
        data: {
          status:                   'SUBMITTED',
          totalActual,
          variancePct:              variance.variancePct,
          varianceAmount:           variance.varianceAmount,
          managerReapprovalRequired,
          submittedAt:              new Date(),
        },
      });

      await tx.trip.update({ where: { id: tripId }, data: { status: nextTripStatus } });

      return exp;
    })();

    await logAudit({
      userId,
      entityType: 'EXPENSE',
      entityId: expense.id,
      action: AuditActions.EXPENSE_SUBMITTED,
      previousState: 'DRAFT',
      newState: 'SUBMITTED',
      metadata: { variancePct: variance.variancePct, managerReapprovalRequired, tripStatus: nextTripStatus },
      ipAddress: ipAddress ?? null,
    }, tx);

    // BR-TR-05: >10% ⇒ CHỈ Manager được thông báo (Finance không thấy hồ sơ ở bước này)
    if (managerReapprovalRequired) {
      if (trip.employee.managerId) {
        await createNotification({
          recipientId: trip.employee.managerId,
          type: 'MANAGER_REAPPROVAL_REQUIRED',
          message: `Chi phi vuot du toan > 10% (${variance.variancePct.toFixed(2)}%). Can phe duyet bo sung.`,
          referenceId: expense.id,
          referenceType: 'EXPENSE',
        }, tx, afterCommit);
      }

      // Thông báo cho nhân viên: hồ sơ ĐÃ CHUYỂN Manager duyệt bổ sung (không phải bị từ chối)
      await createNotification({
        recipientId: trip.employeeId,
        type: 'EXPENSE_SUBMITTED',
        message: 'Bao cao chi phi da duoc nop va chuyen Manager phe duyet bo sung (chi phi vuot du toan > 10%).',
        referenceId: expense.id,
        referenceType: 'EXPENSE',
      }, tx, afterCommit);
    } else {
      // ≤10%: vào hàng đợi Finance như bình thường
      const financeUsers = await tx.user.findMany({
        where: { role: 'FINANCE', isActive: true },
        select: { id: true },
      });
      for (const f of financeUsers) {
        await createNotification({
          recipientId: f.id,
          type: 'EXPENSE_SUBMITTED',
          message: 'Co bao cao chi phi moi can xem xet.',
          referenceId: expense.id,
          referenceType: 'EXPENSE',
        }, tx, afterCommit);
      }
    }

    return updated;
  });
}

// ─── approveExpense ───────────────────────────────────────────────────────────
export async function approveExpense(
  tripId: string,
  userId: string,
  comment?: string,
  ipAddress?: string
) {
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    const expense = await tx.expense.findUnique({
      where: { tripId },
      include: { trip: { select: { employeeId: true, status: true } } },
    });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (expense.status !== 'SUBMITTED')
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED');
    // BR-TR-05: hồ sơ >10% CHỈ được Finance duyệt SAU khi Manager duyệt bổ sung
    // (API.md:661 → 422 EXPENSE_VARIANCE_EXCEEDED). Trip MANAGER_REAPPROVE không thuộc hàng đợi Finance.
    if (
      expense.trip.status === 'MANAGER_REAPPROVE' ||
      (expense.managerReapprovalRequired && !expense.managerReapproved)
    )
      throw Errors.EXPENSE_VARIANCE_EXCEEDED(expense.variancePct ?? 0);

    const updated = await (async () => {
      const exp = await tx.expense.update({
        where: { tripId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_APPROVED' } });
      return exp;
    })();

    await logAudit({
      userId,
      entityType: 'EXPENSE',
      entityId: expense.id,
      action: AuditActions.EXPENSE_APPROVED,
      previousState: 'SUBMITTED',
      newState: 'APPROVED',
      metadata: { comment },
      ipAddress: ipAddress ?? null,
    }, tx);

    await createNotification({
      recipientId: expense.trip.employeeId,
      type: 'EXPENSE_APPROVED',
      message: 'Bao cao chi phi cua ban da duoc Finance phe duyet.',
      referenceId: expense.id,
      referenceType: 'EXPENSE',
    }, tx, afterCommit);

    return { ...updated, tripStatus: 'EXPENSE_APPROVED' };
  });
}

// ─── rejectExpense ────────────────────────────────────────────────────────────
export async function rejectExpense(
  tripId: string,
  userId: string,
  comment: string,
  ipAddress?: string
) {
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    if (!comment?.trim())
      throw Errors.VALIDATION_ERROR({ fieldErrors: { comment: ['Comment required'] }, formErrors: [] });

    const expense = await tx.expense.findUnique({
      where: { tripId },
      include: { trip: { select: { employeeId: true } } },
    });
    if (!expense) throw Errors.NOT_FOUND('expense');
    if (expense.status !== 'SUBMITTED')
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED');

    const updated = await (async () => {
      const exp = await tx.expense.update({
        where: { tripId },
        data: { status: 'REJECTED' },
      });
      // BR-TR-05 (quyết định mới): hồ sơ >10% đã được chuyển THẲNG cho Manager ngay khi submit,
      // nên Finance KHÔNG còn đường tự route sang Manager. Reject của Finance (kể cả hồ sơ vượt
      // ngưỡng đã có Manager duyệt bổ sung) giữ nguyên luồng thường → EXPENSE_REJECTED.
      await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_REJECTED' } });
      return exp;
    })();

    await logAudit({
      userId,
      entityType: 'EXPENSE',
      entityId: expense.id,
      action: AuditActions.EXPENSE_REJECTED,
      previousState: 'SUBMITTED',
      newState: 'REJECTED',
      metadata: { comment },
      ipAddress: ipAddress ?? null,
    }, tx);

    await createNotification({
      recipientId: expense.trip.employeeId,
      type: 'EXPENSE_REJECTED',
      message: `Bao cao chi phi bi tu choi. Ly do: ${comment.trim()}`,
      referenceId: expense.id,
      referenceType: 'EXPENSE',
    }, tx, afterCommit);

    return updated;
  });
}

// ─── reapproveExpense ─────────────────────────────────────────────────────────
export async function reapproveExpense(
  tripId: string,
  userId: string,
  action: 'APPROVED' | 'REJECTED',
  comment?: string,
  ipAddress?: string, requestKey?: string
) {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const expense = await tx.expense.findUnique({
      where: { tripId },
      include: {
        trip: {
          select: {
            employeeId: true,
            status:     true,
            employee:   { select: { managerId: true } },
          },
        },
      },
    });
    if (!expense) throw Errors.NOT_FOUND('expense');
    // REJECTED: Finance từng chuyển "Gửi Manager duyệt bổ sung" (rejectExpense → MANAGER_REAPPROVE)
    if (!['SUBMITTED', 'REJECTED'].includes(expense.status))
      throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED|REJECTED');
    if (!expense.managerReapprovalRequired) throw Errors.FORBIDDEN();

    // Verify: chỉ manager của employee mới được reapprove
    if (expense.trip.employee.managerId !== userId) throw Errors.FORBIDDEN();

    // BR-TR-05 (quyết định mới): duyệt bổ sung chỉ hợp lệ khi hồ sơ ĐANG chờ Manager
    // (trip = MANAGER_REAPPROVE). Chỉ áp dụng cho nhánh APPROVED — nhánh REJECTED giữ nguyên.
    if (action === 'APPROVED' && expense.trip.status !== 'MANAGER_REAPPROVE')
      throw Errors.INVALID_STATUS_TRANSITION(expense.trip.status, 'MANAGER_REAPPROVE');

    if (action === 'REJECTED' && !comment?.trim())
      throw Errors.VALIDATION_ERROR({
        fieldErrors: { comment: ['Comment required when rejecting'] },
        formErrors: [],
      });

    await logAudit({
      userId,
      entityType: 'EXPENSE',
      entityId: expense.id,
      action: AuditActions.MANAGER_REAPPROVED,
      previousState: 'SUBMITTED',
      newState: 'SUBMITTED',
      metadata: { action, comment },
      ipAddress: ipAddress ?? null,
    }, tx);

    if (action === 'APPROVED') {
      // Quay về hàng đợi Finance (architecture.md: MANAGER_REAPPROVE → EXPENSE_SUBMITTED)
      await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_SUBMITTED' } });
    }

    return tx.expense.update({
      where: { tripId },
      data: {
        ...(action === 'APPROVED' && { status: 'SUBMITTED' }),
        managerReapproved:   action === 'APPROVED',
        managerReapproverId: userId,
        managerReapprovedAt: new Date(),
      },
    });
  }, { scope: 'reapproveExpense:' + userId + ':' + tripId, key: requestKey, payload: [tripId, userId, action, comment] });
}
