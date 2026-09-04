/**
 * ai.validator.ts — Zod Validation Schema cho POST /api/v1/ai/generate-itinerary
 *
 * Bám đúng:
 *   - API.md §10 — validation rules từng field
 *   - ai-feature-spec.md §2 — Input contract
 *   - US-02 — E-04 (days > tripDays), E-05 (budget ≤ 0)
 *
 * Input Guardrail (TSK-202):
 *   - .strict() → chặn field lạ client tự thêm vào (chống prompt/field injection)
 *   - destination 1–200, preferences ≤ 500, days 1–30, budget integer > 0
 *
 * Cross-field (days ≤ trip.tripDays) kiểm tra ở service layer (cần DB).
 */

import { z } from 'zod';

export const generateItinerarySchema = z
  .object({
    tripId: z
      .string({ required_error: 'tripId là bắt buộc' })
      .uuid('tripId phải là UUID hợp lệ'),

    destination: z
      .string({ required_error: 'Điểm đến là bắt buộc' })
      .trim()
      .min(1, 'Điểm đến không được để trống')
      .max(200, 'Điểm đến tối đa 200 ký tự'),

    days: z
      .number({
        required_error: 'Số ngày là bắt buộc',
        invalid_type_error: 'Số ngày phải là số',
      })
      .int('Số ngày phải là số nguyên')
      .min(1, 'Số ngày tối thiểu 1')
      .max(30, 'Số ngày tối đa 30'),

    budget: z
      .number({
        required_error: 'Ngân sách là bắt buộc',
        invalid_type_error: 'Ngân sách phải là số',
      })
      .int('Ngân sách phải là số nguyên (VNĐ)')
      .positive('Ngân sách phải lớn hơn 0'),

    preferences: z
      .string({ invalid_type_error: 'Preferences phải là chuỗi' })
      .trim()
      .max(500, 'Preferences tối đa 500 ký tự')
      .optional(),
  })
  .strict();

export type GenerateItineraryRequest = z.infer<typeof generateItinerarySchema>;
