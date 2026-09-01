/**
 * response.utils.ts — HTTP Response Helpers
 *
 * Standardized response builders bám theo API.md §1 (camelCase, UUID format).
 */

import { Response } from 'express';

/**
 * sendSuccess — Trả về 200/201 với data wrapper chuẩn
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): void {
  res.status(statusCode).json({
    data,
    ...(message ? { message } : {}),
  });
}

/**
 * sendCreated — Trả về 201 Created
 */
export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, 201, message);
}

/**
 * sendPaginated — Trả về paginated list response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
): void {
  res.status(200).json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * sendNoContent — Trả về 204 No Content (delete operations)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
