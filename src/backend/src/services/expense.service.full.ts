/**
 * expense.service.full.ts — Full Expense Service
 * API.md §8-§9 | BR-TR-05 (variance) | BR-TR-06 (immutable)
 *
 * NOTE: File này THAY THẾ logic stub trong expense.service.ts (utils).
 * Import từ file này thay vì expense.service.ts ở utils/.
 */

import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';
import { logAudit, AuditActions } from './audit.service';
import { createNotification } from './notification.service';
import { calculateVariance } from './expense.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpenseItemInput {
  expenseDate: string;
  category:    string;
  amount:      number;
  description: string;
  receiptUrl?: string;
}

const EXPENSE_CATEGORIES = ['ACCOMMODATION', 'TRANSPORT', 'MEAL', 'PER_DIEM', 'OTHER'];

// ─── Helper: recalc totalActual ───────────────────────────────────────────────
async function recalcTotal(expenseId: string) {
  const agg = await prisma.expenseItem.aggregate({ where: { expenseId }, _sum: { amount: true } });
  await prisma.expense.update({
    where: { id: expenseId },
    data: { totalActual: agg._sum.amount ?? 0 },
  });
}

// ─── Helper: assert owner ─────────────────────────────────────────────────────
async function assertExpenseOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { employeeId: true, estimatedBudget: true, status: true, employee: { select: { managerId: true } } },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
  return trip;
}

// ─── getExpense ───────────────────────────────────────────────────────────────
export async function getExpense(tripId: string, userId: string, userRole: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { employeeId: true, employee: { select: { managerId: true } } },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();

  const canRead = userRole === 'FINANCE' || userRole === 'ADMIN' ||
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
  const trip = await assertExpenseOwner(tripId, userId);

  if (!['APPROVED', 'ONGOING'].includes(trip.status))
    throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'APPROVED|ONGOING required');

  const existing = await prisma.expense.findUnique({ where: { tripId } });
  if (existing) throw Errors.INVALID_STATUS_TRANSITION('EXPENSE_EXISTS', 'already created');

  return prisma.expense.create({
    data: {
      tripId,
      totalActual:             0,
      estimatedBudgetSnapshot: trip.estimatedBudget,
      status:                  'DRAFT',
    },
  });
}

// ─── updateExpense (justification only) ──────────────────────────────────────
export async function updateExpense(tripId: string, userId: string, justification: string) {
  await assertExpenseOwner(tripId, userId);
  const expense = await prisma.expense.findUnique({ where: { tripId } });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (expense.status !== 'DRAFT') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT');

  return prisma.expense.update({ where: { tripId }, data: { justification } });
}

// ─── addExpenseItem ───────────────────────────────────────────────────────────
export async function addExpenseItem(tripId: string, userId: string, data: ExpenseItemInput) {
  await assertExpenseOwner(tripId, userId);
  const expense = await prisma.expense.findUnique({ where: { tripId } });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (!['DRAFT', 'REJECTED'].includes(expense.status))
    throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

  if (!EXPENSE_CATEGORIES.includes(data.category))
    throw Errors.VALIDATION_ERROR({ fieldErrors: { category: ['Invalid category'] }, formErrors: [] });
  if (!data.amount || data.amount <= 0)
    throw Errors.VALIDATION_ERROR({ fieldErrors: { amount: ['Amount must be > 0'] }, formErrors: [] });

  const item = await prisma.expenseItem.create({
    data: {
      expenseId:   expense.id,
      expenseDate: new Date(data.expenseDate + 'T00:00:00.000Z'),
      category:    data.category,
      amount:      data.amount,
      description: data.description.trim(),
      receiptUrl:  data.receiptUrl ?? null,
    },
  });
  await recalcTotal(expense.id);
  return item;
}

// ─── updateExpenseItem ────────────────────────────────────────────────────────
export async function updateExpenseItem(
  tripId: string, itemId: string, userId: string, data: Partial<ExpenseItemInput>
) {
  await assertExpenseOwner(tripId, userId);
  const expense = await prisma.expense.findUnique({ where: { tripId } });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (!['DRAFT', 'REJECTED'].includes(expense.status))
    throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

  const item = await prisma.expenseItem.findFirst({ where: { id: itemId, expenseId: expense.id } });
  if (!item) throw Errors.NOT_FOUND('expense item');

  const updated = await prisma.expenseItem.update({
    where: { id: itemId },
    data: {
      ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate + 'T00:00:00.000Z') }),
      ...(data.category    !== undefined && { category:    data.category }),
      ...(data.amount      !== undefined && { amount:      data.amount }),
      ...(data.description !== undefined && { description: data.description.trim() }),
      ...(data.receiptUrl  !== undefined && { receiptUrl:  data.receiptUrl }),
    },
  });
  await recalcTotal(expense.id);
  return updated;
}

// ─── deleteExpenseItem ────────────────────────────────────────────────────────
export async function deleteExpenseItem(tripId: string, itemId: string, userId: string) {
  await assertExpenseOwner(tripId, userId);
  const expense = await prisma.expense.findUnique({ where: { tripId } });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (!['DRAFT', 'REJECTED'].includes(expense.status))
    throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT|REJECTED');

  const item = await prisma.expenseItem.findFirst({ where: { id: itemId, expenseId: expense.id } });
  if (!item) throw Errors.NOT_FOUND('expense item');

  await prisma.expenseItem.delete({ where: { id: itemId } });
  await recalcTotal(expense.id);
}

// ─── submitExpense (BR-TR-05) ─────────────────────────────────────────────────
export async function submitExpense(tripId: string, userId: string, ipAddress?: string) {
  const trip = await assertExpenseOwner(tripId, userId);

  const expense = await prisma.expense.findUnique({
    where: { tripId },
    include: { items: true },
  });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (expense.status !== 'DRAFT') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'DRAFT');
  if (expense.items.length === 0)
    throw Errors.VALIDATION_ERROR({ fieldErrors: { items: ['At least 1 expense item required'] }, formErrors: [] });

  // Calculate variance (BR-TR-05)
  const variance = calculateVariance(expense.totalActual, expense.estimatedBudgetSnapshot);

  // Soft: 0 < variance <= 10% → justification required
  if (variance.requiresJustification && !expense.justification?.trim())
    throw Errors.VALIDATION_ERROR({ fieldErrors: { justification: ['Justification required when variance 0-10%'] }, formErrors: [] });

  const managerReapprovalRequired = variance.requiresManagerReapproval;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { tripId },
      data: {
        status:                   'SUBMITTED',
        variancePct:              variance.variancePct,
        varianceAmount:           variance.varianceAmount,
        managerReapprovalRequired,
        submittedAt:              new Date(),
      },
    });

    await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_SUBMITTED' } });

    await logAudit({ userId, entityType: 'EXPENSE', entityId: expense.id,
      action: AuditActions.EXPENSE_SUBMITTED, previousState: 'DRAFT', newState: 'SUBMITTED',
      metadata: { variancePct: variance.variancePct, managerReapprovalRequired },
      ipAddress: ipAddress ?? null });

    // Notify Finance
    const financeUsers = await tx.user.findMany({ where: { role: 'FINANCE', isActive: true }, select: { id: true } });
    for (const f of financeUsers) {
      await createNotification({ recipientId: f.id, type: 'EXPENSE_SUBMITTED',
        message: 'Co bao cao chi phi moi can xem xet.', referenceId: expense.id, referenceType: 'EXPENSE' });
    }

    // Notify Manager if reapproval needed
    if (managerReapprovalRequired && trip.employee.managerId) {
      await createNotification({ recipientId: trip.employee.managerId, type: 'MANAGER_REAPPROVAL_REQUIRED',
        message: `Chi phi vuot du toan > 10%. Can phe duyet bo sung.`, referenceId: expense.id, referenceType: 'EXPENSE' });
    }

    return updated;
  });
}

// ─── approveExpense ───────────────────────────────────────────────────────────
export async function approveExpense(tripId: string, userId: string, comment?: string, ipAddress?: string) {
  const expense = await prisma.expense.findUnique({
    where: { tripId },
    include: { trip: { select: { employeeId: true } } },
  });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (expense.status !== 'SUBMITTED') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED');
  if (expense.managerReapprovalRequired && !expense.managerReapproved)
    throw Errors.VALIDATION_ERROR({ fieldErrors: {}, formErrors: ['Manager reapproval required before Finance can approve'] });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { tripId },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_APPROVED' } });

    await logAudit({ userId, entityType: 'EXPENSE', entityId: expense.id,
      action: AuditActions.EXPENSE_APPROVED, previousState: 'SUBMITTED', newState: 'APPROVED',
      metadata: { comment }, ipAddress: ipAddress ?? null });

    await createNotification({ recipientId: expense.trip.employeeId, type: 'EXPENSE_APPROVED',
      message: 'Bao cao chi phi cua ban da duoc Finance phe duyet.', referenceId: expense.id, referenceType: 'EXPENSE' });

    return { ...updated, tripStatus: 'EXPENSE_APPROVED' };
  });
}

// ─── rejectExpense ────────────────────────────────────────────────────────────
export async function rejectExpense(tripId: string, userId: string, comment: string, ipAddress?: string) {
  if (!comment?.trim()) throw Errors.VALIDATION_ERROR({ fieldErrors: { comment: ['Comment required'] }, formErrors: [] });

  const expense = await prisma.expense.findUnique({
    where: { tripId },
    include: { trip: { select: { employeeId: true } } },
  });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (expense.status !== 'SUBMITTED') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({ where: { tripId }, data: { status: 'REJECTED' } });
    await tx.trip.update({ where: { id: tripId }, data: { status: 'EXPENSE_REJECTED' } });

    await logAudit({ userId, entityType: 'EXPENSE', entityId: expense.id,
      action: AuditActions.EXPENSE_REJECTED, previousState: 'SUBMITTED', newState: 'REJECTED',
      metadata: { comment }, ipAddress: ipAddress ?? null });

    await createNotification({ recipientId: expense.trip.employeeId, type: 'EXPENSE_REJECTED',
      message: `Bao cao chi phi bi tu choi. Ly do: ${comment.trim()}`, referenceId: expense.id, referenceType: 'EXPENSE' });

    return updated;
  });
}

// ─── reapproveExpense ─────────────────────────────────────────────────────────
export async function reapproveExpense(
  tripId: string, userId: string, action: 'APPROVED' | 'REJECTED', comment?: string, ipAddress?: string
) {
  const expense = await prisma.expense.findUnique({
    where: { tripId },
    include: { trip: { select: { employeeId: true, employee: { select: { managerId: true } } } } },
  });
  if (!expense) throw Errors.NOT_FOUND('expense');
  if (expense.status !== 'SUBMITTED') throw Errors.INVALID_STATUS_TRANSITION(expense.status, 'SUBMITTED');
  if (!expense.managerReapprovalRequired) throw Errors.FORBIDDEN();

  // Verify manager is the trip employee's manager
  if (expense.trip.employee.managerId !== userId) throw Errors.FORBIDDEN();

  if (action === 'REJECTED' && !comment?.trim())
    throw Errors.VALIDATION_ERROR({ fieldErrors: { comment: ['Comment required when rejecting'] }, formErrors: [] });

  await logAudit({ userId, entityType: 'EXPENSE', entityId: expense.id,
    action: AuditActions.MANAGER_REAPPROVED, previousState: 'SUBMITTED', newState: 'SUBMITTED',
    metadata: { action, comment }, ipAddress: ipAddress ?? null });

  return prisma.expense.update({
    where: { tripId },
    data: {
      managerReapproved:   action === 'APPROVED',
      managerReapproverId: userId,
      managerReapprovedAt: new Date(),
    },
  });
}
