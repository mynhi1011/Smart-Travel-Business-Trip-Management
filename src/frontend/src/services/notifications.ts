/**
 * notifications.ts — Notification API Service (Frontend)
 *
 * Gọi các endpoint:
 *   GET    /notifications           — danh sách phân trang, hỗ trợ filter isRead
 *   PATCH  /notifications/read-all  — đánh dấu tất cả đã đọc
 *   PATCH  /notifications/:id/read  — đánh dấu một notification đã đọc
 *   GET    /notifications/stream    — SSE stream (auth via ?token= query param)
 *
 * Tài liệu: notifications.routes.ts, notification.controller.ts
 */

import { apiRequest } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackendNotification {
  id: string;
  recipientId: string;
  type: string;
  message: string;
  referenceId: string | null;
  referenceType: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

interface ListNotificationsResponse {
  data: BackendNotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MarkAllReadResponse {
  data: { updatedCount: number };
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<ListNotificationsResponse> {
  const query = new URLSearchParams();
  if (params.page)   query.set('page',   String(params.page));
  if (params.limit)  query.set('limit',  String(params.limit));
  if (params.isRead !== undefined) query.set('isRead', String(params.isRead));

  const qs = query.toString();
  return apiRequest<ListNotificationsResponse>(`/notifications${qs ? `?${qs}` : ''}`);
}

export async function markNotificationRead(notificationId: string): Promise<BackendNotification> {
  const response = await apiRequest<{ data: BackendNotification }>(
    `/notifications/${notificationId}/read`,
    { method: 'PATCH' }
  );
  return response.data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await apiRequest<MarkAllReadResponse>(
    '/notifications/read-all',
    { method: 'PATCH' }
  );
  return response.data.updatedCount;
}
