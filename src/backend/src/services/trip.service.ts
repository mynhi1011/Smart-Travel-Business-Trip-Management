/**
 * trip.service.ts — TripService
 *
 * Quản lý vòng đời Trip Request theo state machine (architecture.md §9).
 * Mọi state transition được bọc trong prisma.$transaction().
 * Sau mỗi transition: gọi logAudit() và createNotification().
 *
 * Thay đổi (D-16):
 *   - createTrip: bỏ hotel/perDiem/transport/other fields
 *   - destinationType: tự suy ra từ destination (resolveDestinationType)
 *   - submitTrip: tính approvalReasons snapshot + lưu vào Trip
 *   - getTripById/getAllTrips: trả approvalReasons + level1Approval
 */

import prisma from '../prisma/client';
import type { Prisma } from '@prisma/client';
import { runMutation, assertMutableTrip } from './mutation.service';
import { logAudit, AuditActions } from './audit.service';
import { createNotification } from './notification.service';
import { countWorkingDays, runPolicyCheck, requiresLevel2FromViolations } from './policy.service';
import { resolveDestinationType, buildApprovalReasons } from './policyRules';
import type { ApprovalReason } from './policyRules';
import { routeApproval } from './approval.service';
import { calculateTripDays } from '../utils/date.utils';
import type { CreateTripInput } from '../utils/validators/trip.validator';
import { Errors } from '../middlewares/error-handler';

// ─── Valid Trip Status Transitions ────────────────────────────────────────────
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:                  ['SUBMITTED'],
  SUBMITTED:              ['MANAGER_REVIEWING', 'REJECTED'],
  MANAGER_REVIEWING:      ['PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'],
  PENDING_ADMIN_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED:               ['ONGOING'],
  ONGOING:                ['EXPENSE_DRAFT'],
  EXPENSE_DRAFT:          ['EXPENSE_SUBMITTED', 'MANAGER_REAPPROVE'],
  EXPENSE_SUBMITTED:      ['EXPENSE_APPROVED', 'EXPENSE_REJECTED'],
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

// ─── Helper: generate human-readable Trip Code ───────────────────────────────
async function generateTripCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = 'TR-' + year + '-';
  // Seed from existing codes on first use; retained counter prevents reuse after deletion.
  await tx.$executeRaw`INSERT OR IGNORE INTO trip_code_sequences (year, value)
    SELECT ${year}, COALESCE(MAX(CAST(SUBSTR(trip_code, 9) AS INTEGER)), 0)
    FROM trips WHERE trip_code LIKE ${prefix + '%'}`;
  await tx.$executeRaw`UPDATE trip_code_sequences SET value = value + 1 WHERE year = ${year}`;
  const rows = await tx.$queryRaw<Array<{ value: number | bigint }>>`SELECT value FROM trip_code_sequences WHERE year = ${year}`;
  return prefix + String(rows[0].value).padStart(4, '0');
}

// ─── Helper: parse approvalReasons JSON safely ────────────────────────────────
function parseApprovalReasons(raw: string | null | undefined): ApprovalReason[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as ApprovalReason[]; }
  catch { return []; }
}

// ─── Helper: format trip for response ────────────────────────────────────────
function formatTrip(trip: Record<string, unknown>, tripDays?: number) {
  const dep  = trip['departureDate'] as Date;
  const ret  = trip['returnDate']    as Date;
  const days = tripDays ?? computeTripDays(dep, ret);

  // Parse approvalReasons JSON string → array
  const approvalReasonsRaw = trip['approvalReasons'] as string | null | undefined;
  const approvalReasonsParsed = parseApprovalReasons(approvalReasonsRaw);

  return {
    ...trip,
    tripDays: days,
    approvalReasons: approvalReasonsParsed,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTripResult {
  trip: {
    id: string; tripCode: string; employeeId: string; origin: string;
    destination: string; destinationType: string;
    departureDate: Date; returnDate: Date; tripDays: number;
    purpose: string; estimatedBudget: number;
    status: string; isUrgent: boolean; urgencyReason: string | null;
    requiresLevel2: boolean; approvalReasons: ApprovalReason[];
    createdAt: Date; updatedAt: Date;
  };
  warnings: never[]; // Không còn soft warnings (D-16)
}

// ─── createTrip ───────────────────────────────────────────────────────────────
export async function createTrip(
  employeeId: string,
  data: CreateTripInput,
  ipAddress?: string, requestKey?: string
): Promise<CreateTripResult> {
  return runMutation(async (tx) => {
    const departureDate = new Date(data.departureDate + 'T00:00:00.000Z');
    const returnDate    = new Date(data.returnDate    + 'T00:00:00.000Z');
    const tripDays = computeTripDays(departureDate, returnDate);

    // destinationType tự suy ra từ destination (D-16: không nhận từ client)
    const destinationType = resolveDestinationType(data.destination);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const workingDaysAhead = countWorkingDays(today, departureDate);
    const isUrgent = workingDaysAhead < 3;

    if (isUrgent) {
      const reason = data.urgencyReason?.trim();
      if (!reason || reason.length < 10) {
        throw Errors.VALIDATION_ERROR({
          fieldErrors: {
            urgencyReason: [`Chuyến đi khẩn cấp: bắt buộc nhập lý do tối thiểu 10 ký tự (còn ${workingDaysAhead} ngày làm việc)`],
          },
          formErrors: [],
        });
      }
    }

    const trip = await tx.trip.create({
      data: {
        tripCode:        await generateTripCode(tx),
        employeeId,
        origin:          data.origin.trim(),
        destination:     data.destination.trim(),
        destinationType,
        departureDate,
        returnDate,
        purpose:         data.purpose.trim(),
        estimatedBudget: data.estimatedBudget,
        status:          'DRAFT',
        isUrgent,
        urgencyReason:   isUrgent ? (data.urgencyReason?.trim() ?? null) : null,
        requiresLevel2:  false,
        approvalReasons: null,
      },
    });

    await logAudit({
      userId: employeeId, entityType: 'TRIP', entityId: trip.id,
      action: AuditActions.TRIP_CREATED, previousState: null, newState: 'DRAFT',
      metadata: { isUrgent, estimatedBudget: data.estimatedBudget, tripDays, destinationType },
      ipAddress: ipAddress ?? null,
    }, tx);

    return {
      trip: { ...trip, tripDays, approvalReasons: [] },
      warnings: [],
    };
  }, { scope: 'trip:create:' + employeeId, key: requestKey, payload: [employeeId, data] });
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

  let where: Record<string, unknown> = {};
  if (userRole === 'EMPLOYEE') {
    where = { employeeId: userId };
  } else if (userRole === 'MANAGER') {
    where = { employee: { managerId: userId } };
  }
  if (filters.status) where['status'] = filters.status;

  const orderBy: Record<string, string> = {};
  const sortField = ['createdAt', 'departureDate', 'estimatedBudget'].includes(filters.sortBy ?? '')
    ? (filters.sortBy as string) : 'createdAt';
  orderBy[sortField] = filters.order === 'asc' ? 'asc' : 'desc';

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where, skip, take: limit, orderBy,
      include: {
        employee: { select: { id: true, name: true, department: true, jobGrade: true } },
        approvalRecords: {
          where: { approvalLevel: 'LEVEL_1', action: 'APPROVED' },
          include: { approver: { select: { id: true, name: true } } },
          take: 1,
          orderBy: { actedAt: 'asc' },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    trips: trips.map(t => {
      const formatted = formatTrip(t as unknown as Record<string, unknown>);
      const l1 = (t.approvalRecords as Array<{ approver: { name: string }; comment: string | null; actedAt: Date }>)[0];
      return {
        ...formatted,
        level1Approval: l1 ? {
          approverName: l1.approver.name,
          approvedAt:   l1.actedAt,
          comment:      l1.comment,
        } : null,
      };
    }),
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
      approvalRecords:   {
        include: { approver: { select: { id: true, name: true, role: true } } },
        orderBy: { actedAt: 'asc' },
      },
      expense:           { include: { items: true } },
      itineraryItems:    { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }] },
    },
  });

  if (!trip) throw Errors.TRIP_NOT_FOUND();

  const emp = trip.employee as { managerId: string | null };
  const canAccess =
    userRole === 'TRAVEL_ADMIN' || userRole === 'FINANCE' || userRole === 'ADMIN' ||
    trip.employeeId === userId ||
    (userRole === 'MANAGER' && emp.managerId === userId);

  if (!canAccess) throw Errors.FORBIDDEN();

  // AuditLog dùng entityType/entityId đa hình, không có Prisma relation trực tiếp với Trip.
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'TRIP', entityId: tripId },
    orderBy: { timestamp: 'asc' },
    select: { id: true, action: true, timestamp: true },
  });

  // Lấy level1Approval từ approval_records
  const l1Record = (trip.approvalRecords as Array<{
    approvalLevel: string; action: string;
    approver: { name: string }; comment: string | null; actedAt: Date;
  }>).find(r => r.approvalLevel === 'LEVEL_1' && r.action === 'APPROVED');

  const formatted = formatTrip(trip as unknown as Record<string, unknown>);

  // Parse violations JSON trong policyCheckResult
  const pcr = trip.policyCheckResult ? {
    ...trip.policyCheckResult,
    violations: JSON.parse((trip.policyCheckResult as { violations: string }).violations ?? '[]'),
  } : null;

  return {
    ...formatted,
    policyCheckResult: pcr,
    level1Approval: l1Record ? {
      approverName: l1Record.approver.name,
      approvedAt:   l1Record.actedAt,
      comment:      l1Record.comment,
    } : null,
    auditLogs,
  };
}

// ─── updateTrip ───────────────────────────────────────────────────────────────
export async function updateTrip(
  tripId: string,
  userId: string,
  data: Partial<CreateTripInput>
): Promise<unknown> {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const trip = await tx.trip.findUnique({ where: { id: tripId } });
    if (!trip)                    throw Errors.TRIP_NOT_FOUND();
    if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
    if (trip.status !== 'DRAFT')    throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'DRAFT (required for edit)');

    // Re-compute isUrgent nếu dates thay đổi
    let isUrgent = trip.isUrgent;
    let destinationType = trip.destinationType;

    if (data.departureDate) {
      const dep   = new Date(data.departureDate + 'T00:00:00.000Z');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      isUrgent = countWorkingDays(today, dep) < 3;
    }

    // Re-compute destinationType nếu destination thay đổi
    if (data.destination) {
      destinationType = resolveDestinationType(data.destination);
    }

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: {
        ...(data.origin        !== undefined && { origin:          data.origin.trim() }),
        ...(data.destination   !== undefined && { destination:     data.destination.trim(), destinationType }),
        ...(data.departureDate !== undefined && { departureDate:   new Date(data.departureDate + 'T00:00:00.000Z') }),
        ...(data.returnDate    !== undefined && { returnDate:      new Date(data.returnDate    + 'T00:00:00.000Z') }),
        ...(data.purpose       !== undefined && { purpose:         data.purpose.trim() }),
        ...(data.estimatedBudget !== undefined && { estimatedBudget: data.estimatedBudget }),
        ...(data.urgencyReason !== undefined && { urgencyReason:   data.urgencyReason }),
        isUrgent,
        // Reset approvalReasons snapshot khi trip ở DRAFT và bị sửa
        approvalReasons: null,
        requiresLevel2:  false,
      },
    });

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── deleteTrip ───────────────────────────────────────────────────────────────
export async function deleteTrip(tripId: string, userId: string): Promise<void> {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const trip = await tx.trip.findUnique({ where: { id: tripId } });
    if (!trip)                    throw Errors.TRIP_NOT_FOUND();
    if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
    if (trip.status !== 'DRAFT')    throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'DELETE (only DRAFT)');

    await tx.trip.delete({ where: { id: tripId } });
  });
}

// ─── startTrip — Employee bắt đầu chuyến đi (APPROVED → ONGOING) ──────────────
export async function startTrip(
  tripId: string,
  userId: string,
  ipAddress?: string
): Promise<unknown> {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const trip = await tx.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw Errors.TRIP_NOT_FOUND();
    if (trip.employeeId !== userId) throw Errors.FORBIDDEN();

    const allowed = VALID_TRANSITIONS[trip.status] ?? [];
    if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();
    if (!allowed.includes('ONGOING'))
      throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'ONGOING');

    const updated = await tx.trip.update({
      where: { id: tripId },
      data:  { status: 'ONGOING' },
    });

    await logAudit({
      userId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_STARTED, previousState: 'APPROVED', newState: 'ONGOING',
      ipAddress: ipAddress ?? null,
    }, tx);

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── endTrip — Employee kết thúc chuyến đi (ONGOING → EXPENSE_DRAFT) ──────────
export async function endTrip(
  tripId: string,
  userId: string,
  ipAddress?: string
): Promise<unknown> {
  return runMutation(async (tx) => {
    await assertMutableTrip(tx, tripId);
    const trip = await tx.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw Errors.TRIP_NOT_FOUND();
    if (trip.employeeId !== userId) throw Errors.FORBIDDEN();
    if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();

    const allowed = VALID_TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes('EXPENSE_DRAFT'))
      throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'EXPENSE_DRAFT');

    const updated = await tx.trip.update({
      where: { id: tripId },
      data:  { status: 'EXPENSE_DRAFT' },
    });

    await logAudit({
      userId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_ENDED, previousState: 'ONGOING', newState: 'EXPENSE_DRAFT',
      ipAddress: ipAddress ?? null,
    }, tx);

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── submitTrip ───────────────────────────────────────────────────────────────
export async function submitTrip(
  tripId: string,
  userId: string,
  ipAddress?: string
): Promise<unknown> {
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    const { updatedTrip, policyResult, approvalReasons, managerId } = await (async () => {
      const trips = await tx.$queryRaw<Array<{
        id: string; status: string; employee_id: string;
        estimated_budget: number;
        departure_date: Date; return_date: Date;
        created_at: Date; destination: string; destination_type: string;
        is_urgent: boolean; urgency_reason: string | null;
      }>>`SELECT * FROM trips WHERE id = ${tripId} LIMIT 1`;

      const trip = trips[0];
      if (!trip)                       throw Errors.TRIP_NOT_FOUND();
      if (trip.employee_id !== userId) throw Errors.FORBIDDEN();
      if (trip.status !== 'DRAFT')     throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'SUBMITTED');

      const emp = await tx.user.findUnique({
        where: { id: userId },
        select: { jobGrade: true, managerId: true },
      });
      const jobGrade  = emp?.jobGrade  ?? 'STAFF';

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const depDate = new Date(trip.departure_date);
      const retDate = new Date(trip.return_date);
      const tripDays = computeTripDays(depDate, retDate);
      const wDays    = countWorkingDays(today, depDate);

      // Chạy PolicyCheck (BR-TR-03/04/08)
      const policyResult = runPolicyCheck({
        jobGrade,
        destination:     trip.destination,
        estimatedBudget: trip.estimated_budget,
        tripDays,
        departureDate:   depDate,
        returnDate:      retDate,
        createdAt:       new Date(trip.created_at),
      });

      // Tính approvalReasons snapshot — CÙNG logic với policyResult
      const approvalReasons = buildApprovalReasons({
        isUrgent:        wDays < 3,
        urgencyReason:   trip.urgency_reason,
        estimatedBudget: trip.estimated_budget,
        startDate:       depDate,
        endDate:         retDate,
        jobGrade,
        destination:     trip.destination,
      });

      const violationsJson = JSON.stringify(policyResult.violations);
      const approvalReasonsJson = JSON.stringify(approvalReasons);

      await tx.policyCheckResult.upsert({
        where:  { tripId },
        create: {
          tripId,
          passed:                 policyResult.passed,
          violations:             violationsJson,
          violationCount:         policyResult.violationCount,
          requiresLevel2Approval: policyResult.requiresLevel2Approval,
        },
        update: {
          passed:                 policyResult.passed,
          violations:             violationsJson,
          violationCount:         policyResult.violationCount,
          requiresLevel2Approval: policyResult.requiresLevel2Approval,
        },
      });

      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          status:          'SUBMITTED',
          isUrgent:        wDays < 3,
          requiresLevel2:  policyResult.requiresLevel2Approval,
          approvalReasons: approvalReasonsJson,
          submittedAt:     new Date(),
        },
        include: { policyCheckResult: true },
      });

      return {
        updatedTrip, policyResult, approvalReasons,
        managerId: emp?.managerId ?? null,
      };
    })();

    await logAudit({
      userId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_SUBMITTED, previousState: 'DRAFT', newState: 'SUBMITTED',
      metadata: {
        policyPassed:    policyResult.passed,
        violationCount:  policyResult.violationCount,
        requiresLevel2:  policyResult.requiresLevel2Approval,
        approvalReasons: approvalReasons.map(r => r.code),
      },
      ipAddress: ipAddress ?? null,
    }, tx);

    if (managerId) {
      await createNotification({
        recipientId:   managerId,
        type:          'PENDING_LEVEL1_APPROVAL',
        message:       'Yêu cầu công tác mới cần phê duyệt cấp 1.',
        referenceId:   tripId,
        referenceType: 'TRIP',
      }, tx, afterCommit);
    }

    // Parse violations string → array trước khi trả về
    const policyCheckResult = updatedTrip.policyCheckResult ? {
      ...updatedTrip.policyCheckResult,
      violations: JSON.parse((updatedTrip.policyCheckResult as { violations: string }).violations ?? '[]'),
    } : null;

    return {
      ...formatTrip(updatedTrip as unknown as Record<string, unknown>),
      policyCheckResult,
      approvalReasons,
      level1Approval: null,
    };
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
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    const { updated, newStatus, auditAction, employeeId } = await (async () => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          policyCheckResult: true,
          employee: { select: { id: true, managerId: true } },
        },
      });
      if (!trip) throw Errors.TRIP_NOT_FOUND();

      if (!['MANAGER', 'TRAVEL_ADMIN'].includes(userRole)) throw Errors.FORBIDDEN();
      if (userRole === 'MANAGER' && trip.employee.managerId !== approverId) throw Errors.FORBIDDEN();
      const isManagerApprove     = userRole === 'MANAGER'      && trip.status === 'SUBMITTED';
      const isTravelAdminApprove = userRole === 'TRAVEL_ADMIN' && trip.status === 'PENDING_ADMIN_APPROVAL';
      if (!isManagerApprove && !isTravelAdminApprove) throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'APPROVE');

      if (isManagerApprove && trip.employee.managerId !== approverId) throw Errors.FORBIDDEN();

      const savedViolations: Array<{ code: string; severity: string }> = trip.policyCheckResult
        ? JSON.parse((trip.policyCheckResult as { violations: string }).violations)
        : [];
      const hasViolations = requiresLevel2FromViolations(savedViolations);
      const routing       = routeApproval({ totalBudget: trip.estimatedBudget, hasViolations });
      const newStatus     = isTravelAdminApprove ? 'APPROVED' : routing.decision;
      const approvalLevel = isManagerApprove ? 'LEVEL_1' : 'LEVEL_2';
      const auditAction   = isManagerApprove ? AuditActions.MANAGER_APPROVED : AuditActions.ADMIN_APPROVED;

      await tx.approvalRecord.create({
        data: {
          tripId, approverId, approvalLevel, action: 'APPROVED',
          comment:              comment ?? null,
          budgetSnapshot:       trip.estimatedBudget,
          hadViolationsSnapshot: hasViolations,
        },
      });

      const updated = await tx.trip.update({
        where: { id: tripId },
        data:  {
          status:     newStatus,
          approvedAt: newStatus === 'APPROVED' ? new Date() : undefined,
        },
      });

      return { updated, newStatus, auditAction, employeeId: trip.employee.id };
    })();

    await logAudit({
      userId: approverId, entityType: 'TRIP', entityId: tripId,
      action: auditAction, previousState: 'SUBMITTED', newState: newStatus,
      ipAddress: ipAddress ?? null,
    }, tx);

    await createNotification({
      recipientId:   employeeId,
      type:          newStatus === 'APPROVED' ? 'TRIP_APPROVED' : 'PENDING_LEVEL2_APPROVAL',
      message:       newStatus === 'APPROVED'
        ? 'Yêu cầu công tác của bạn đã được phê duyệt.'
        : 'Yêu cầu công tác cần phê duyệt cấp 2 (Travel Admin).',
      referenceId:   tripId,
      referenceType: 'TRIP',
    }, tx, afterCommit);

    // Notify tất cả TRAVEL_ADMIN khi trip chuyển sang PENDING_ADMIN_APPROVAL
    if (newStatus === 'PENDING_ADMIN_APPROVAL') {
      const travelAdmins = await tx.user.findMany({
        where:  { role: 'TRAVEL_ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of travelAdmins) {
        await createNotification({
          recipientId:   admin.id,
          type:          'PENDING_LEVEL2_APPROVAL',
          message:       'Có yêu cầu công tác mới cần phê duyệt cấp 2.',
          referenceId:   tripId,
          referenceType: 'TRIP',
        }, tx, afterCommit);
      }
    }

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
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    if (!comment?.trim()) throw Errors.VALIDATION_ERROR({
      fieldErrors: { comment: ['Lý do từ chối là bắt buộc'] }, formErrors: [],
    });

    const { updated, previousStatus, auditAction, employeeId } = await (async () => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { employee: { select: { id: true, managerId: true } } },
      });
      if (!trip) throw Errors.TRIP_NOT_FOUND();

      if (!['MANAGER', 'TRAVEL_ADMIN'].includes(userRole)) throw Errors.FORBIDDEN();
      if (userRole === 'MANAGER' && trip.employee.managerId !== approverId) throw Errors.FORBIDDEN();
      const canReject =
        (userRole === 'MANAGER'      && trip.status === 'SUBMITTED') ||
        (userRole === 'TRAVEL_ADMIN' && trip.status === 'PENDING_ADMIN_APPROVAL');
      if (!canReject) throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'REJECT');

      if (userRole === 'MANAGER' && trip.employee.managerId !== approverId) throw Errors.FORBIDDEN();

      const approvalLevel = userRole === 'MANAGER' ? 'LEVEL_1' : 'LEVEL_2';
      const auditAction   = userRole === 'MANAGER' ? AuditActions.MANAGER_REJECTED : AuditActions.ADMIN_REJECTED;

      await tx.approvalRecord.create({
        data: {
          tripId, approverId, approvalLevel, action: 'REJECTED',
          comment:              comment.trim(),
          budgetSnapshot:       trip.estimatedBudget,
          hadViolationsSnapshot: false,
        },
      });

      const updated = await tx.trip.update({ where: { id: tripId }, data: { status: 'REJECTED' } });

      return { updated, previousStatus: trip.status, auditAction, employeeId: trip.employee.id };
    })();

    await logAudit({
      userId: approverId, entityType: 'TRIP', entityId: tripId,
      action: auditAction, previousState: previousStatus, newState: 'REJECTED',
      ipAddress: ipAddress ?? null,
    }, tx);

    await createNotification({
      recipientId:   employeeId,
      type:          'TRIP_REJECTED',
      message:       `Yêu cầu công tác của bạn bị từ chối. Lý do: ${comment.trim()}`,
      referenceId:   tripId,
      referenceType: 'TRIP',
    }, tx, afterCommit);

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

// ─── closeTrip ────────────────────────────────────────────────────────────────
export async function closeTrip(
  tripId: string,
  financeId: string,
  ipAddress?: string
): Promise<unknown> {
  return runMutation(async (tx, afterCommit) => {
    await assertMutableTrip(tx, tripId);
    const { updated, previousStatus, employeeId } = await (async () => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { expense: true, employee: { select: { id: true } } },
      });
      if (!trip) throw Errors.TRIP_NOT_FOUND();
      if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();

      const expense = trip.expense;
      if (!expense || expense.status !== 'APPROVED')
        throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'CLOSED (expense must be APPROVED)');

      if (expense.managerReapprovalRequired && !expense.managerReapproved)
        throw Errors.EXPENSE_VARIANCE_EXCEEDED(expense.variancePct ?? 0);

      if (trip.status !== 'EXPENSE_APPROVED')
        throw Errors.INVALID_STATUS_TRANSITION(trip.status, 'CLOSED');

      const updated = await tx.trip.update({
        where: { id: tripId, status: 'EXPENSE_APPROVED' },
        data:  { status: 'CLOSED', closedAt: new Date() },
      });

      await tx.expense.update({ where: { id: expense.id }, data: { status: 'CLOSED' } });

      return { updated, previousStatus: trip.status, employeeId: trip.employee.id };
    })();

    await logAudit({
      userId: financeId, entityType: 'TRIP', entityId: tripId,
      action: AuditActions.TRIP_CLOSED, previousState: previousStatus, newState: 'CLOSED',
      ipAddress: ipAddress ?? null,
    }, tx);

    await createNotification({
      recipientId:   employeeId,
      type:          'TRIP_CLOSED',
      message:       'Hồ sơ công tác của bạn đã được đóng. Cảm ơn!',
      referenceId:   tripId,
      referenceType: 'TRIP',
    }, tx, afterCommit);

    return formatTrip(updated as unknown as Record<string, unknown>);
  });
}

export { prisma };
