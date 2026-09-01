/**
 * audit.service.ts — Audit Logger Service
 *
 * Ghi vào bảng audit_logs mỗi khi có mutation nhạy cảm (NFR-TR-04).
 * Bảng này chỉ có INSERT — không bao giờ UPDATE hay DELETE.
 *
 * Tài liệu tham chiếu: architecture.md §5.3 AuditLogger, data-model.md §3.10
 */

import prisma from '../prisma/client';

// ─── Audit Entity Types (data-model.md §4) ───────────────────────────────────

export type AuditEntityType = 'TRIP' | 'EXPENSE' | 'ITINERARY' | 'USER' | 'AUTH';

// ─── Audit Action Constants ───────────────────────────────────────────────────
// Danh sách action strings — dùng constant thay vì magic string

export const AuditActions = {
  // Trip lifecycle
  TRIP_CREATED: 'TRIP_CREATED',
  TRIP_SUBMITTED: 'TRIP_SUBMITTED',
  MANAGER_APPROVED: 'MANAGER_APPROVED',
  MANAGER_REJECTED: 'MANAGER_REJECTED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  ADMIN_REJECTED: 'ADMIN_REJECTED',
  TRIP_CLOSED: 'TRIP_CLOSED',

  // Expense lifecycle
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_SUBMITTED: 'EXPENSE_SUBMITTED',
  EXPENSE_APPROVED: 'EXPENSE_APPROVED',
  EXPENSE_REJECTED: 'EXPENSE_REJECTED',
  MANAGER_REAPPROVED: 'MANAGER_REAPPROVED',

  // Auth
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogInput {
  userId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

// ─── Audit Logger ─────────────────────────────────────────────────────────────

/**
 * logAudit — INSERT một bản ghi vào audit_logs (không bao giờ UPDATE/DELETE)
 * Fail-safe: lỗi audit không nên làm crash operation chính
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        previousState: input.previousState ?? null,
        newState: input.newState ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Log lỗi nhưng không rethrow — audit fail không được làm crash business operation
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message: 'Audit log write failed',
        error: err instanceof Error ? err.message : String(err),
        input: { ...input, metadata: undefined }, // Tránh log sensitive data
        timestamp: new Date().toISOString(),
      })
    );
  }
}
