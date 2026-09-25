/**
 * notification.service.ts — Notification Service
 *
 * Lưu notification vào DB và emit SSE event đến client.
 * Tài liệu tham chiếu: architecture.md §5.3 NotificationService
 *
 * TODO: Tích hợp SSE emitter (lib/sse-emitter.ts) khi implement Notifications
 */

import prisma from '../prisma/client';
import type { Prisma } from '@prisma/client';
import type { AfterCommit } from './mutation.service';
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

/** Persist using the mutation tx; deliver SSE only after commit. */
export async function createNotification(
  input: CreateNotificationInput,
  tx?: Prisma.TransactionClient,
  afterCommit?: AfterCommit,
): Promise<void> {
  // 1. Lưu vào DB
  await (tx ?? prisma).notification.create({
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
  const deliver = () => sseEmitter.emit(input.recipientId, {
    type:        input.type,
    referenceId: input.referenceId,
    message:     input.message,
  });
  if (afterCommit) afterCommit(deliver);
  else deliver();
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
