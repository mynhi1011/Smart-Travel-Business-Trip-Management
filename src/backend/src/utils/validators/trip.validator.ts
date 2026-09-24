/**
 * trip.validator.ts — Zod Validation Schema cho Trip Request
 *
 * Bám đúng:
 *   - API.md §5 POST /trips — validation rules từng field
 *   - US-01 — validation matrix, hard vs soft validation
 *   - data-model.md §3.3 — constraints DB
 *   - BR-TR-08 (D-16): KHÔNG còn ô nhập hotel/perDiem từ client
 *
 * Hard validation (trả 400 nếu vi phạm):
 *   - origin/destination: required, 1–200 chars
 *   - departureDate: required, >= today (không phải quá khứ) — TC-D01
 *   - returnDate: required, >= departureDate — TC-D02
 *   - purpose: required, 10–1000 chars
 *   - estimatedBudget: required, integer > 0 — TC-P08
 *   - urgencyReason: bắt buộc khi workingDays < 3 (kiểm tra cả ở schema và service)
 *
 * Fields ĐÃ XÓA (D-16): hotelCostPerNight, hotelNights, perDiemBudget,
 *   transportBudget, otherBudget — không nhận từ client nữa.
 *
 * Server-computed fields — bị STRIP nếu client gửi lên:
 *   tripDays, isUrgent, requiresLevel2, status, employeeId, destinationType
 *
 * destinationType: được server tự suy ra từ destination bằng resolveDestinationType()
 *   (policyRules.ts). Client KHÔNG cần và KHÔNG được gửi trường này nữa.
 */

import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateOnly(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnly(s: string): Date | null {
  const d = new Date(s + 'T00:00:00.000Z');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * countWorkingDaysLocal — đếm ngày làm việc (bỏ T7, CN)
 * Dùng nội bộ trong validator — không import policy.service để tránh circular dep.
 */
function countWorkingDaysLocal(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

/**
 * createTripSchema — Zod schema cho POST /api/v1/trips request body
 *
 * Lưu ý: destinationType KHÔNG còn là field nhận từ client.
 * Server tự tính từ destination bằng resolveDestinationType().
 */
export const createTripSchema = z
  .object({
    // ── Required fields ───────────────────────────────────────────────────────
    origin: z
      .string({ required_error: 'Điểm xuất phát là bắt buộc' })
      .trim()
      .min(1, 'Điểm xuất phát không được để trống')
      .max(200, 'Điểm xuất phát tối đa 200 ký tự'),

    destination: z
      .string({ required_error: 'Điểm đến là bắt buộc' })
      .trim()
      .min(1, 'Điểm đến không được để trống')
      .max(200, 'Điểm đến tối đa 200 ký tự'),

    departureDate: z
      .string({ required_error: 'Ngày khởi hành là bắt buộc' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày khởi hành phải theo định dạng YYYY-MM-DD'),

    returnDate: z
      .string({ required_error: 'Ngày về là bắt buộc' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày về phải theo định dạng YYYY-MM-DD'),

    purpose: z
      .string({ required_error: 'Mục đích công tác là bắt buộc' })
      .trim()
      .min(10, 'Mục đích công tác tối thiểu 10 ký tự')
      .max(1000, 'Mục đích công tác tối đa 1000 ký tự'),

    estimatedBudget: z
      .number({
        required_error:    'Tổng dự toán là bắt buộc',
        invalid_type_error: 'Tổng dự toán phải là số',
      })
      .int('Tổng dự toán phải là số nguyên (VNĐ)')
      .positive('Tổng dự toán phải lớn hơn 0'),

    // ── Urgency (bắt buộc khi workingDays < 3 — kiểm tra ở superRefine) ──────
    urgencyReason: z
      .string()
      .trim()
      .min(10, 'Lý do khẩn cấp tối thiểu 10 ký tự')
      .max(500, 'Lý do khẩn cấp tối đa 500 ký tự')
      .optional(),
  })
  // ── Cross-field validations ───────────────────────────────────────────────
  .superRefine((data, ctx) => {
    const today = todayDateOnly();

    // Validate departureDate >= today (TC-D01)
    const departure = parseDateOnly(data.departureDate);
    if (!departure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departureDate'],
        message: 'Ngày khởi hành không hợp lệ',
      });
      return;
    }
    if (departure < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departureDate'],
        message: 'Ngày khởi hành không được nằm trong quá khứ',
      });
    }

    // Validate returnDate >= departureDate (TC-D02)
    const returning = parseDateOnly(data.returnDate);
    if (!returning) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDate'],
        message: 'Ngày về không hợp lệ',
      });
      return;
    }
    if (returning < departure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDate'],
        message: 'Ngày về phải sau hoặc bằng ngày khởi hành',
      });
    }

    // urgencyReason bắt buộc khi workingDays < 3 (BR-TR-03)
    if (departure >= today) {
      const workingDays = countWorkingDaysLocal(today, departure);
      if (workingDays < 3) {
        const reason = data.urgencyReason?.trim();
        if (!reason || reason.length < 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['urgencyReason'],
            message: `Chuyến đi khẩn cấp (còn ${workingDays} ngày làm việc): urgencyReason bắt buộc, tối thiểu 10 ký tự`,
          });
        }
      }
    }
  });

// ─── Exported Types ───────────────────────────────────────────────────────────

/** Type-safe validated input — dùng trong service và controller */
export type CreateTripInput = z.infer<typeof createTripSchema>;

// ─── Per Diem Warning — DEPRECATED (giữ để không break imports cũ) ──────────
// Không còn dùng ở trip.service.ts nhưng giữ export để tránh build error.

export const PER_DIEM_RATE: Record<string, number> = {
  TIER1_CITY: 400_000,
  OTHER:      300_000,
};

export interface PerDiemWarning {
  code: 'POLICY_VIOLATION_PER_DIEM_EXCEEDED';
  detail: string;
  maxPerDiem: number;
  actual: number;
}

/** @deprecated — BR-TR-02 không còn phát sinh warning riêng (D-15, D-16) */
export function checkPerDiemWarning(
  _perDiemBudget: number | undefined,
  _destinationType: string,
  _tripDays: number
): PerDiemWarning | null {
  return null;
}
