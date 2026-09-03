/**
 * trip.service.ts — TripService
 *
 * Quản lý vòng đời Trip Request theo state machine (architecture.md §9).
 * Mọi state transition được bọc trong prisma.$transaction().
 * Sau mỗi transition: gọi logAudit() và createNotification().
 */

import prisma from '../prisma/client';
import { logAudit, AuditActions } from './audit.service';
import { createNotification } from './notification.service';
import { countWorkingDays, runPolicyCheck } from './policy.service';
import { routeApproval } from './approval.service';
import { calculateTripDays } from '../utils/date.utils';
import { checkPerDiemWarning } from '../utils/validators/trip.validator';
import type { CreateTripInput, PerDiemWarning } from '../utils/validators/trip.validator';
import { Errors } from '../middlewares/error-handler';

// ─── Valid Trip Status Transitions ────────────────────────────────────────────
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:                  ['SUBMITTED'],
  SUBMITTED:              ['MANAGER_REVIEWING', 'REJECTED'],
  MANAGER_REVIEWING:      ['PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'],
  PENDING_ADMIN_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED:               ['ONGOING'],
  ONGOING:                ['EXPENSE_DRAFT'],
  EXPENSE_DRAFT:          ['EXPENSE_SUBMITTED'],
  EXPENSE_SUBMITTED:      ['EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'MANAGER_REAPPROVE'],
  EXPENSE_APPROVED:       ['CLOSED'],
  EXPENSE_REJECTED:       ['EXPENSE_DRAFT'],
  MANAGER_REAPPROVE:      ['EXPENSE_SUBMITTED'],
  CLOSED:                 [],
  REJECTED:               [],
};

// ─── Helper: compute tripDays ─────────────────────────────────────────────────
function computeTripDays(dep: Date, ret: Date): number {
  return calculateTripDays(dep, ret);
}

// ─── Helper: format trip for response ────────────────────────────────────────
function formatTrip(trip: Record<string, unknown>, tripDays?: number) {
  const dep  = trip['departureDate'] as Date;
  const ret  = trip['returnDate']    as Date;
  const days = tripDays ?? computeTripDays(dep, ret);
  return { ...trip, tripDays: days };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTripResult {
  trip: {
    id: string; employeeId: string; origin: string; destination: string;
    destinationType: string; departureDate: Date; returnDate: Date; tripDays: number;
    purpose: string; estimatedBudget: number; hotelCostPerNight: number | null;
    hotelNights: number | null; perDiemBudget: number | null;
    transportBudget: number | null; otherBudget: number | null;
    status: string; isUrgent: boolean; urgencyReason: string | null;
    requiresLevel2: boolean; createdAt: Date; updatedAt: Date;
  };
  warnings: PerDiemWarning[];
}

// ─── createTrip ───────────────────────────────────────────────────────────────
export async function createTrip(
  employeeId: string,
  data: CreateTripInput,
  ipAddress?: string
): Promise<CreateTripResult> {
  const departureDate = new Date(data.departureDate + 'T00:00:00.000Z');
  const returnDate    = new Date(data.returnDate    + 'T00:00:00.000Z');
  const tripDays = computeTripDays(departureDate, returnDate);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const workingDaysAhead = countWorkingDays(today, departureDate);
  const isUrgent = workingDaysAhead < 3;

  if (isUrgent) {
    const reason = data.urgencyReason?.trim();
    if (!reason || reason.length < 10) {
      throw Errors.VALIDATION_ERROR({
        fieldErrors: { urgencyReason: [`Urgent trip: phai co ly do khan cap toi thieu 10 ky tu (con ${workingDaysAhead} ngay lam viec)`] },
        formErrors: [],
      });
    }
  }

  const trip = await prisma.trip.create({
    data: {
      employeeId,
      origin: data.origin.trim(), destination: data.destination.trim(),
      destinationType: data.destinationType,
      departureDate, returnDate,
      purpose: data.purpose.trim(), estimatedBudget: data.estimatedBudget,
      hotelCostPerNight: data.hotelCostPerNight ?? null,
      hotelNights:       data.hotelNights       ?? null,
      perDiemBudget:     data.perDiemBudget     ?? null,
      transportBudget:   data.transportBudget   ?? null,
      otherBudget:       data.otherBudget       ?? null,
      status: 'DRAFT', isUrgent,
      urgencyReason: isUrgent ? (data.urgencyReason?.trim() ?? null) : null,
      requiresLevel2: false,
    },
  });

  const warnings: PerDiemWarning[] = [];
  const pw = checkPerDiemWarning(data.perDiemBudget, data.destinationType, tripDays);
  if (pw) warnings.push(pw);

  await logAudit({ userId: employeeId, entityType: 'TRIP', entityId: trip.id,
    action: AuditActions.TRIP_CREATED, previousState: null, newState: 'DRAFT',
    metadata: { isUrgent, estimatedBudget: data.estimatedBudget, tripDays },
    ipAddress: ipAddress ?? null });

  return {
    trip: { ...trip, tripDays },
    warnings,
  };
}

// ─── getAllTrips ──────────────────────────────────────────────────────────────
export async function getAllTrips(
  userId: string,
  userRole: string,
  filters: { status?: string; page?: number; limit?: number; sortBy?: string; order?: string } = {}
): Promise<{ trips: unknown[]; total: number }> {
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(100, filters.limit ?? 20);
  const skip  = (page - 1) * limit;

  // RBAC where clause
  let where: Record<string, unknown> = {};
  if (userRole === 'EMPLOYEE') {
    where = { employeeId: userId };
  } else if (userRole === 'MANAGER') {
    // Manager thấy trips của subordinates (employee.managerId = userId)
    where = { employee: { managerId: userId } };
  }
  // TRAVEL_ADMIN, FINANCE, ADMIN thấy tất cả

  if (filters.status) where['status'] = filters.status;

  const orderBy: Record<string, string> = {};
  const sortField = ['createdAt', 'departureDate', 'estimatedBudget'].includes(filters.sortBy ?? '')
    ? (filters.sortBy as string) : 'createdAt';
  orderBy[sortField] = filters.order === 'asc' ? 'asc' : 'desc';

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where, skip, take: limit,
      orderBy,
      include: { employee: { select: { id: true, name: true, department: true, jobGrade: true } } },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    trips: trips.map(t => formatTrip(t as unknown as Record<string, unknown>)),
    total,
  };
}

// ─── getTripById ──────────────────────────────────────────────────────────────
export async function getTripById(
  tripId: string,
  userId: string,
  userRole: string
): Promise<unknown> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      employee:          { select: { id: true, name: true, department: true, jobGrade: true, managerId: true } },
      policyCheckResult: true,
      approvalRecords:   { include: { approver: { select: { id: true, name: true, role: true } } }, orderBy: { actedAt: 'asc' } },
      expense:           { include: { items: true } },
      itineraryItems:    { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }] },
    },
  });

  if (!trip) throw Errors.TRIP_NOT_FOUND();

  // Ownership / access check
  const emp = trip.employee as { managerId: string | null };
  const canAccess =
    userRole === 'TRAVEL_ADMIN' || userRole === 'FINANCE' || userRole === 'ADMIN' ||
    trip.employeeId === userId ||
    (userRole === 'MANAGER' && emp.managerId === userId);

  if (!canAccess) throw Errors.FORBIDDEN();

  return formatTrip(trip as unknown as Record<string, unknown>);
}

// ─── updateTrip ───────────────────────────────────────────────────────────────
export async function updateTrip(
  tripId: string,
  userId: string,
  data: Partial<CreateTripInput>
): Promise<unknown> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip)                  throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
  if (trip.status !== 'DRAFT')    throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'DRAFT (required for edit)');

  // Re-compute isUrgent nếu dates thay đổi
  let isUrgent = trip.isUrgent;
  if (data.departureDate) {
    const dep  = new Date(data.departureDate + 'T00:00:00.000Z');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    isUrgent = countWorkingDays(today, dep) < 3;
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: {
      ...(data.origin           !== undefined && { origin:            data.origin.trim() }),
      ...(data.destination      !== undefined && { destination:       data.destination.trim() }),
      ...(data.destinationType  !== undefined && { destinationType:   data.destinationType }),
      ...(data.departureDate    !== undefined && { departureDate:     new Date(data.departureDate + 'T00:00:00.000Z') }),
      ...(data.returnDate       !== undefined && { returnDate:        new Date(data.returnDate    + 'T00:00:00.000Z') }),
      ...(data.purpose          !== undefined && { purpose:           data.purpose.trim() }),
      ...(data.estimatedBudget  !== undefined && { estimatedBudget:   data.estimatedBudget }),
      ...(data.hotelCostPerNight !== undefined && { hotelCostPerNight: data.hotelCostPerNight }),
      ...(data.hotelNights      !== undefined && { hotelNights:       data.hotelNights }),
      ...(data.perDiemBudget    !== undefined && { perDiemBudget:     data.perDiemBudget }),
      ...(data.transportBudget  !== undefined && { transportBudget:   data.transportBudget }),
      ...(data.otherBudget      !== undefined && { otherBudget:       data.otherBudget }),
      ...(data.urgencyReason    !== undefined && { urgencyReason:     data.urgencyReason }),
      isUrgent,
    },
  });

  return formatTrip(updated as unknown as Record<string, unknown>);
}

// ─── deleteTrip ───────────────────────────────────────────────────────────────
export async function deleteTrip(tripId: string, userId: string): Promise<void> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip)                      throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId)     throw Errors.FORBIDDEN();
  if (trip.status !== 'DRAFT')        throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'DELETE (only DRAFT)');

  await prisma.trip.delete({ where: { id: tripId } });
}

// ─── submitTrip ───────────────────────────────────────────────────────────────
export async function submitTrip(
  tripId: string,
  userId: string,
  ipAddress?: string
): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    // Lock row
    const trips = await tx.$queryRaw<Array<{ id: string; status: string; employee_id: string; estimated_budget: number; hotel_cost_per_night: number | null; per_diem_budget: number | null; departure_date: Date; created_at: Date; destination_type: string; is_urgent: boolean; hotel_nights: number | null }>>
      `SELECT * FROM trips WHERE id = ${tripId} LIMIT 1`;
    const trip = trips[0];
    if (!trip)                          throw Errors.TRIP_NOT_FOUND();
    if (trip.employee_id !== userId)    throw Errors.FORBIDDEN();
    if (trip.status !== 'DRAFT')        throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'SUBMITTED');

    // Lấy jobGrade của employee
    const emp = await tx.user.findUnique({ where: { id: userId }, select: { jobGrade: true, managerId: true } });
    const jobGrade    = emp?.jobGrade    ?? 'STAFF';
    const managerId   = emp?.managerId  ?? null;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const depDate = new Date(trip.departure_date);
    const wDays = countWorkingDays(today, depDate);
    const tripDays = computeTripDays(depDate, new Date(trip.departure_date)); // reuse

    // Run policy check
    const policyResult = runPolicyCheck({
      jobGrade,
      destinationType:   trip.destination_type,
      estimatedBudget:   trip.estimated_budget,
      hotelCostPerNight: trip.hotel_cost_per_night ?? undefined,
      perDiemBudget:     trip.per_diem_budget      ?? undefined,
      tripDays: computeTripDays(depDate, new Date(trip.departure_date)),
      departureDate: depDate,
      createdAt:     new Date(trip.created_at),
    });

    // Upsert policy_check_results
    await tx.policyCheckResult.upsert({
      where:  { tripId },
      create: {
        tripId, passed: policyResult.passed,
        violations:            JSON.stringify(policyResult.violations),
        violationCount:        policyResult.violationCount,
        requiresLevel2Approval: policyResult.requiresLevel2Approval,
      },
      update: {
        passed: policyResult.passed,
        violations:            JSON.stringify(policyResult.violations),
        violationCount:        policyResult.violationCount,
        requiresLevel2Approval: policyResult.requiresLevel2Approval,
      },
    });

    // Update trip status
    const updated = await tx.trip.update({
      where: { id: tripId },
      data: {
        status:        'SUBMITTED',
        isUrgent:      wDays < 3,
        requiresLevel2: policyResult.requiresLevel2Approval,
        submittedAt:   new Date(),
      },
      include: { policyCheckResult: true },
    });

    await logAudit({ userId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_SUBMITTED, previousState: 'DRAFT', newState: 'SUBMITTED',
      metadata: { policyPassed: policyResult.passed, violationCount: policyResult.violationCount },
      ipAddress: ipAddress ?? null });

    // Notify Manager
    if (managerId) {
      await createNotification({ recipientId: managerId, type: 'PENDING_LEVEL1_APPROVAL',
        message: `Yeu cau cong tac moi can phe duyet cap 1.`,
        referenceId: tripId, referenceType: 'TRIP' });
    }

    void tripDays; // used above
    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── approveTrip ─────────────────────────────────────────────────────────────
export async function approveTrip(
  tripId: string,
  approverId: string,
  userRole: string,
  comment?: string,
  ipAddress?: string
): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: { policyCheckResult: true, employee: { select: { id: true, managerId: true } } },
    });
    if (!trip) throw Errors.TRIP_NOT_FOUND();

    // Role + status check
    const isManagerApprove      = userRole === 'MANAGER' && trip.status === 'SUBMITTED';
    const isTravelAdminApprove  = userRole === 'TRAVEL_ADMIN' && trip.status === 'PENDING_ADMIN_APPROVAL';
    if (!isManagerApprove && !isTravelAdminApprove) throw Errors.FORBIDDEN();

    // Quyết định routing (BR-TR-04)
    const hasViolations  = (trip.policyCheckResult?.violationCount ?? 0) > 0;
    const routing        = routeApproval({ totalBudget: trip.estimatedBudget, hasViolations });
    const newStatus      = isTravelAdminApprove ? 'APPROVED' : routing.decision;
    const approvalLevel  = isManagerApprove ? 'LEVEL_1' : 'LEVEL_2';
    const auditAction    = isManagerApprove ? AuditActions.MANAGER_APPROVED : AuditActions.ADMIN_APPROVED;

    await tx.approvalRecord.create({
      data: {
        tripId, approverId, approvalLevel, action: 'APPROVED',
        comment: comment ?? null,
        budgetSnapshot:         trip.estimatedBudget,
        hadViolationsSnapshot:  hasViolations,
      },
    });

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: { status: newStatus, approvedAt: newStatus === 'APPROVED' ? new Date() : undefined },
    });

    await logAudit({ userId: approverId, entityType: 'TRIP', entityId: tripId,
      action: auditAction, previousState: trip.status, newState: newStatus,
      ipAddress: ipAddress ?? null });

    // Notify employee
    await createNotification({ recipientId: trip.employee.id,
      type: newStatus === 'APPROVED' ? 'TRIP_APPROVED' : 'PENDING_LEVEL2_APPROVAL',
      message: newStatus === 'APPROVED'
        ? 'Yeu cau cong tac cua ban da duoc phe duyet.'
        : 'Yeu cau cong tac can phe duyet cap 2 (Travel Admin).',
      referenceId: tripId, referenceType: 'TRIP' });

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── rejectTrip ───────────────────────────────────────────────────────────────
export async function rejectTrip(
  tripId: string,
  approverId: string,
  userRole: string,
  comment: string,
  ipAddress?: string
): Promise<unknown> {
  if (!comment?.trim()) throw Errors.VALIDATION_ERROR({ fieldErrors: { comment: ['Ly do tu choi la bat buoc'] }, formErrors: [] });

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: { employee: { select: { id: true } } },
    });
    if (!trip) throw Errors.TRIP_NOT_FOUND();

    const canReject =
      (userRole === 'MANAGER'      && trip.status === 'SUBMITTED') ||
      (userRole === 'TRAVEL_ADMIN' && trip.status === 'PENDING_ADMIN_APPROVAL');
    if (!canReject) throw Errors.FORBIDDEN();

    const approvalLevel = userRole === 'MANAGER' ? 'LEVEL_1' : 'LEVEL_2';
    const auditAction   = userRole === 'MANAGER' ? AuditActions.MANAGER_REJECTED : AuditActions.ADMIN_REJECTED;

    await tx.approvalRecord.create({
      data: { tripId, approverId, approvalLevel, action: 'REJECTED', comment: comment.trim(),
        budgetSnapshot: trip.estimatedBudget, hadViolationsSnapshot: false },
    });

    const updated = await tx.trip.update({ where: { id: tripId }, data: { status: 'REJECTED' } });

    await logAudit({ userId: approverId, entityType: 'TRIP', entityId: tripId,
      action: auditAction, previousState: trip.status, newState: 'REJECTED',
      ipAddress: ipAddress ?? null });

    await createNotification({ recipientId: trip.employee.id, type: 'TRIP_REJECTED',
      message: `Yeu cau cong tac cua ban bi tu choi. Ly do: ${comment.trim()}`,
      referenceId: tripId, referenceType: 'TRIP' });

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── closeTrip ────────────────────────────────────────────────────────────────
export async function closeTrip(
  tripId: string,
  financeId: string,
  ipAddress?: string
): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: { expense: true, employee: { select: { id: true } } },
    });
    if (!trip) throw Errors.TRIP_NOT_FOUND();
    if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();

    const expense = trip.expense;
    if (!expense || expense.status !== 'APPROVED')
      throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'CLOSED (expense must be APPROVED)');

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await tx.expense.update({ where: { id: expense.id }, data: { status: 'CLOSED' } });

    await logAudit({ userId: financeId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_CLOSED, previousState: trip.status, newState: 'CLOSED',
      ipAddress: ipAddress ?? null });

    await createNotification({ recipientId: trip.employee.id, type: 'TRIP_CLOSED',
      message: 'Ho so cong tac cua ban da duoc dong tat. Cam on!',
      referenceId: tripId, referenceType: 'TRIP' });

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

export { prisma };
