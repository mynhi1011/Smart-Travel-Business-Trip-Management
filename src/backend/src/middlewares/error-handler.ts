/**
 * error-handler.ts — Global Error Handler Middleware
 *
 * Bắt tất cả lỗi được throw trong controllers/services và trả về
 * Error Response chuẩn (architecture.md §3 — Cấu trúc Error Response).
 *
 * Format chuẩn:
 * {
 *   "error": "ERROR_CODE",
 *   "message": "Mô tả lỗi human-readable",
 *   "details": {},
 *   "requestId": "req_abc123"
 * }
 */

import { Request, Response, NextFunction } from 'express';

// Custom Error class để carry HTTP status + error code
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Lỗi có thể dự đoán được (không crash server)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Predefined Errors (bám theo API.md §3) ───────────────────────────────────

export const Errors = {
  // 400
  VALIDATION_ERROR: (details?: Record<string, unknown>) =>
    new AppError(400, 'VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ.', details),

  // 401
  UNAUTHORIZED: () =>
    new AppError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.'),
  TOKEN_EXPIRED: () =>
    new AppError(401, 'TOKEN_EXPIRED', 'Access token đã hết hạn. Vui lòng làm mới token.'),
  INVALID_TOKEN: () =>
    new AppError(401, 'INVALID_TOKEN', 'Token không hợp lệ.'),
  INVALID_CREDENTIALS: () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'),

  // 403
  FORBIDDEN: () =>
    new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện hành động này.'),

  // 404
  NOT_FOUND: (resource: string) =>
    new AppError(404, 'NOT_FOUND', `Không tìm thấy ${resource}.`),
  TRIP_NOT_FOUND: () =>
    new AppError(404, 'TRIP_NOT_FOUND', 'Không tìm thấy chuyến đi.'),

  // 409
  TRIP_IMMUTABLE: () =>
    new AppError(409, 'TRIP_IMMUTABLE', 'Chuyến đi đã đóng (CLOSED), không thể chỉnh sửa.'),
  INVALID_STATUS_TRANSITION: (from: string, to: string) =>
    new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển từ trạng thái ${from} sang ${to}.`
    ),

  // 422
  POLICY_VIOLATION: (details?: Record<string, unknown>) =>
    new AppError(422, 'POLICY_VIOLATION', 'Yêu cầu vi phạm chính sách công tác.', details),
  AI_BUDGET_GUARDRAIL_FAILED: () =>
    new AppError(
      422,
      'AI_BUDGET_GUARDRAIL_FAILED',
      'Không thể tạo lịch trình trong ngân sách. Vui lòng điều chỉnh ngân sách.'
    ),
  EXPENSE_VARIANCE_EXCEEDED: (variancePct: number) =>
    new AppError(
      422,
      'EXPENSE_VARIANCE_EXCEEDED',
      `Chi phí thực tế vượt dự toán ${variancePct.toFixed(1)}%, cần Manager phê duyệt bổ sung.`
    ),

  // 500
  INTERNAL_ERROR: () =>
    new AppError(500, 'INTERNAL_SERVER_ERROR', 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'),
} as const;

// ─── Error Handler Middleware ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError && err.isOperational) {
    // Lỗi có thể dự đoán — trả về client, không log stack
    console.warn(
      JSON.stringify({
        level: 'WARN',
        requestId,
        errorCode: err.errorCode,
        message: err.message,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString(),
      })
    );

    res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message,
      details: err.details ?? {},
      requestId,
    });
    return;
  }

  // Lỗi không mong đợi (bug) — log đầy đủ stack, trả về generic 500
  console.error(
    JSON.stringify({
      level: 'ERROR',
      requestId,
      message: 'Unexpected error',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    })
  );

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
    details: {},
    requestId,
  });
}
