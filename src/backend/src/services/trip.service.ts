/**
 * trip.service.ts — TripService
 *
 * Quản lý vòng đời Trip Request theo state machine (architecture.md §9).
 * Mọi state transition được bọc trong prisma.$transaction().
 * Sau mỗi transition: gọi AuditLogger.log() và NotificationService.emit().
 *
 * State Machine (trip_status):
 *   DRAFT → SUBMITTED → MANAGER_REVIEWING → PENDING_ADMIN_APPROVAL
 *   → APPROVED → ONGOING → EXPENSE_DRAFT → EXPENSE_SUBMITTED
 *   → EXPENSE_APPROVED → CLOSED
 *   (+ REJECTED ở bất kỳ approval step nào)
 *
 * TODO: Implement từng method khi xây dựng Trip feature
 */

import prisma from '../prisma/client';

// ─── Valid Trip Status Transitions (BR-TR-04, State Machine §9) ───────────────
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['MANAGER_REVIEWING', 'REJECTED'],
  MANAGER_REVIEWING: ['PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'],
  PENDING_ADMIN_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['ONGOING'],
  ONGOING: ['EXPENSE_DRAFT'],
  EXPENSE_DRAFT: ['EXPENSE_SUBMITTED'],
  EXPENSE_SUBMITTED: ['EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'MANAGER_REAPPROVE'],
  EXPENSE_APPROVED: ['CLOSED'],
  EXPENSE_REJECTED: ['EXPENSE_DRAFT'],
  MANAGER_REAPPROVE: ['EXPENSE_SUBMITTED'],
  CLOSED: [],   // Immutable — BR-TR-06
  REJECTED: [], // Terminal state
};

// ─── Trip Service Interface ───────────────────────────────────────────────────

/**
 * getAllTrips — Lấy danh sách trips theo role (EMPLOYEE chỉ thấy của mình)
 * TODO: Implement với RBAC filter
 */
export async function getAllTrips(
  userId: string,
  userRole: string,
  filters?: { status?: string; page?: number; limit?: number }
): Promise<unknown[]> {
  void userId; void userRole; void filters;
  // TODO: Query prisma.trip.findMany() với where clause theo role
  return [];
}

/**
 * getTripById — Lấy chi tiết 1 trip
 * TODO: Implement với ownership check
 */
export async function getTripById(
  tripId: string,
  userId: string,
  userRole: string
): Promise<unknown | null> {
  void tripId; void userId; void userRole;
  // TODO: prisma.trip.findUnique({ where: { id: tripId }, include: { ... } })
  return null;
}

/**
 * createTrip — Tạo Trip Request mới (status = DRAFT)
 * Tự động tính trip_days = returnDate - departureDate + 1
 * TODO: Implement với validation theo data-model.md §3.3
 */
export async function createTrip(
  employeeId: string,
  data: Record<string, unknown>
): Promise<unknown> {
  void employeeId; void data;
  // TODO: prisma.trip.create({ data: { employeeId, ...data, status: 'DRAFT' } })
  return null;
}

/**
 * submitTrip — Chuyển DRAFT → SUBMITTED
 * Trigger PolicyCheckEngine trước khi submit
 * TODO: Implement với PolicyCheckEngine integration
 */
export async function submitTrip(
  tripId: string,
  userId: string
): Promise<unknown> {
  void tripId; void userId;
  // TODO: prisma.$transaction() — SELECT FOR UPDATE → validate → INSERT policy_check_result → UPDATE status
  return null;
}

/**
 * approveTrip — Manager approve (SUBMITTED → APPROVED hoặc PENDING_ADMIN_APPROVAL)
 * ApprovalRouter quyết định 1 cấp hay 2 cấp theo BR-TR-04
 * TODO: Implement với ApprovalRouter
 */
export async function approveTrip(
  tripId: string,
  approverId: string,
  comment?: string
): Promise<unknown> {
  void tripId; void approverId; void comment;
  return null;
}

/**
 * rejectTrip — Manager/TravelAdmin reject
 * TODO: Implement với audit log
 */
export async function rejectTrip(
  tripId: string,
  approverId: string,
  comment: string
): Promise<unknown> {
  void tripId; void approverId; void comment;
  return null;
}

/**
 * closeTrip — Finance close (EXPENSE_APPROVED → CLOSED)
 * BR-TR-06: Sau khi CLOSED, trip là immutable
 * TODO: Implement
 */
export async function closeTrip(
  tripId: string,
  financeId: string
): Promise<unknown> {
  void tripId; void financeId;
  return null;
}

// Export prisma for service use (avoid circular imports)
export { prisma };
