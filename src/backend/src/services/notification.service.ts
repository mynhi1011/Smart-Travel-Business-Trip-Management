/**
 * notification.service.ts — Notification Service
 *
 * Lưu notification vào DB và emit SSE event đến client.
 * Tài liệu tham chiếu: architecture.md §5.3 NotificationService
 *
 * TODO: Tích hợp SSE emitter (lib/sse-emitter.ts) khi implement Notifications
 */

import prisma from '../prisma/client';
import * as sseEmitter from '../lib/sse-emitter';

// ─── Notification Types (data-model.md §4) ───────────────────────────────────

export type NotificationType =
  | 'TRIP_APPROVED'
  | 'TRIP_REJECTED'
  | 'PENDING_LEVEL1_APPROVAL'
  | 'PENDING_LEVEL2_APPROVAL'
  | 'EXPENSE_SUBMITTED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'MANAGER_REAPPROVAL_REQUIRED'
  | 'TRIP_CLOSED';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  message: string;
  referenceId?: string;
  referenceType?: 'TRIP' | 'EXPENSE';
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * createNotification — Lưu notification vào DB và emit SSE
 * TODO: Implement SSE emit sau khi có lib/sse-emitter.ts
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  // 1. Lưu vào DB
  await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      type: input.type,
      message: input.message,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
      isRead: false,
    },
  });

  // 2. Emit SSE event
  sseEmitter.emit(input.recipientId, {
    type:        input.type,
    referenceId: input.referenceId,
    message:     input.message,
  });
}

/**
 * getUnreadCount — Lấy số thông báo chưa đọc của một user
 */
export async function getUnreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, isRead: false },
  });
}

/**
 * markAsRead — Đánh dấu notification đã đọc
 */
export async function markAsRead(
  notificationId: string,
  recipientId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId },
    data: { isRead: true, readAt: new Date() },
  });
}
