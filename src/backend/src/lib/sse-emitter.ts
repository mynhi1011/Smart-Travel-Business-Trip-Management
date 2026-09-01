/**
 * sse-emitter.ts — Server-Sent Events Emitter
 *
 * Quản lý SSE connections và emit events đến client theo userId.
 * Đơn giản hơn WebSocket, đủ dùng cho push notification một chiều (ADR-07).
 *
 * SSE Payload format (architecture.md §5.3 NotificationService):
 *   { type: 'TRIP_STATUS_CHANGED', tripId, newStatus, message }
 *
 * Sử dụng:
 *   // Đăng ký connection: GET /api/v1/notifications/stream
 *   sseEmitter.addClient(userId, res);
 *
 *   // Emit từ service:
 *   sseEmitter.emit(userId, { type: 'TRIP_APPROVED', referenceId: tripId, message: '...' });
 */

import { Response } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SSEPayload {
  type: string;
  referenceId?: string;
  message: string;
  timestamp?: string;
}

// ─── SSE Client Manager ───────────────────────────────────────────────────────

// Map userId → Set<Response> (1 user có thể có nhiều browser tab)
const clients = new Map<string, Set<Response>>();

/**
 * addClient — Đăng ký SSE connection mới cho một user
 * Set headers SSE và gửi initial event
 */
export function addClient(userId: string, res: Response): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Tắt nginx buffering
  res.flushHeaders();

  // Gửi initial connected event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE connection established' })}\n\n`);

  // Thêm client vào map
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)?.add(res);

  // Dọn dẹp khi client disconnect
  res.on('close', () => {
    removeClient(userId, res);
  });
}

/**
 * removeClient — Xóa SSE connection khi client đóng kết nối
 */
export function removeClient(userId: string, res: Response): void {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
}

/**
 * emit — Gửi SSE event đến tất cả connections của một user
 */
export function emit(userId: string, payload: SSEPayload): void {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const data = JSON.stringify({
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });

  const deadClients: Response[] = [];

  userClients.forEach((res) => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      // Connection đã chết
      deadClients.push(res);
    }
  });

  // Dọn dẹp dead connections
  deadClients.forEach((res) => removeClient(userId, res));
}

/**
 * broadcast — Gửi SSE event đến nhiều users cùng lúc
 */
export function broadcast(userIds: string[], payload: SSEPayload): void {
  userIds.forEach((userId) => emit(userId, payload));
}

/**
 * getActiveConnectionCount — Đếm số SSE connections đang active (debug/monitoring)
 */
export function getActiveConnectionCount(): number {
  let total = 0;
  clients.forEach((set) => { total += set.size; });
  return total;
}
