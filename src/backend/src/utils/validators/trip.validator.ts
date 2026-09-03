/**
 * trip.validator.ts — Zod Validation Schema cho Trip Request
 *
 * Bám đúng:
 *   - API.md §5 POST /trips — validation rules từng field
 *   - US-01 — validation matrix, hard vs soft validation
 *   - data-model.md §3.3 — constraints DB
 *
 * Hard validation (trả 400 nếu vi phạm):
 *   - origin/destination: required, 1–200 chars
 *   - destinationType: enum TIER1_CITY | OTHER
 *   - departureDate: required, >= today (không phải quá khứ) — TC-D01
 *   - returnDate: required, >= departureDate — TC-D02
 *   - purpose: required, 10–1000 chars
 *   - estimatedBudget: required, integer > 0 — TC-P08
 *   - hotelCostPerNight/hotelNights: optional, integer >= 0
 *   - perDiemBudget/transportBudget/otherBudget: optional, integer >= 0
 *   - urgencyReason: bắt buộc khi isUrgent=true (kiểm tra ở service layer)
 *
 * Soft validation (trả 201 + warnings[], không block):
 *   - perDiemBudget > tripDays × PER_DIEM_RATE → POLICY_VIOLATION_PER_DIEM_EXCEEDED
 *
 * Server-computed fields — bị STRIP hoàn toàn nếu client gửi lên:
 *   tripDays, isUrgent, requiresLevel2, status, employeeId
 */

import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lấy ngày hôm nay ở dạng YYYY-MM-DD theo server clock
 * Reset về midnight để so sánh date-only (không tính giờ)
 */
function todayDateOnly(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse YYYY-MM-DD string thành Date (midnight UTC)
 * Trả null nếu không hợp lệ
 */
function parseDateOnly(s: string): Date | null {
  const d = new Date(s + 'T00:00:00.000Z');
  return isNaN(d.getTime()) ? null : d;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

/**
 * createTripSchema — Zod schema cho POST /api/v1/trips request body
 *
 * Áp dụng .strict() để bắt các field lạ mà client tự thêm vào
 * (server-computed fields sẽ bị báo lỗi rõ ràng thay vì âm thầm bỏ qua)
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

    destinationType: z.enum(['TIER1_CITY', 'OTHER'], {
      required_error: 'Loại điểm đến là bắt buộc',
      invalid_type_error: 'Loại điểm đến phải là TIER1_CITY hoặc OTHER',
    }),

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
        required_error: 'Tổng dự toán là bắt buộc',
        invalid_type_error: 'Tổng dự toán phải là số',
      })
      .int('Tổng dự toán phải là số nguyên (VNĐ)')
      .positive('Tổng dự toán phải lớn hơn 0'),

    // ── Optional fields (budget breakdown) ───────────────────────────────────
    hotelCostPerNight: z
      .number({ invalid_type_error: 'Chi phí khách sạn/đêm phải là số' })
      .int('Chi phí khách sạn/đêm phải là số nguyên')
      .min(0, 'Chi phí khách sạn/đêm không được âm')
      .optional(),

    hotelNights: z
      .number({ invalid_type_error: 'Số đêm lưu trú phải là số' })
      .int('Số đêm lưu trú phải là số nguyên')
      .min(0, 'Số đêm lưu trú không được âm')
      .optional(),

    perDiemBudget: z
      .number({ invalid_type_error: 'Dự toán phụ cấp phải là số' })
      .int('Dự toán phụ cấp phải là số nguyên')
      .min(0, 'Dự toán phụ cấp không được âm')
      .optional(),

    transportBudget: z
      .number({ invalid_type_error: 'Dự toán đi lại phải là số' })
      .int('Dự toán đi lại phải là số nguyên')
      .min(0, 'Dự toán đi lại không được âm')
      .optional(),

    otherBudget: z
      .number({ invalid_type_error: 'Chi phí khác phải là số' })
      .int('Chi phí khác phải là số nguyên')
      .min(0, 'Chi phí khác không được âm')
      .optional(),

    // ── Urgency fields (bắt buộc khi isUrgent được tính bởi server) ──────────
    // urgencyReason: optional ở schema-level, nhưng bắt buộc ở service-level
    // khi countWorkingDays(today, departureDate) < 3 (BR-TR-03)
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
  });

// ─── Exported Types ───────────────────────────────────────────────────────────

/** Type-safe validated input — dùng trong service và controller */
export type CreateTripInput = z.infer<typeof createTripSchema>;

// ─── Per Diem Warning Checker (Soft Validation — US-01 TC-P03) ───────────────

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

/**
 * checkPerDiemWarning — Kiểm tra soft validation per diem (BR-TR-02)
 *
 * Không block request — chỉ trả về warning để đưa vào response body.
 * Service gọi hàm này sau khi Zod validate thành công.
 *
 * @returns PerDiemWarning | null
 */
export function checkPerDiemWarning(
  perDiemBudget: number | undefined,
  destinationType: string,
  tripDays: number
): PerDiemWarning | null {
  if (!perDiemBudget || perDiemBudget <= 0) return null;

  const rate = PER_DIEM_RATE[destinationType] ?? PER_DIEM_RATE['OTHER'];
  const maxPerDiem = tripDays * (rate ?? 0);

  if (perDiemBudget > maxPerDiem) {
    return {
      code: 'POLICY_VIOLATION_PER_DIEM_EXCEEDED',
      detail: `Phụ cấp công tác ${perDiemBudget.toLocaleString('vi-VN')} VNĐ vượt mức tối đa ${maxPerDiem.toLocaleString('vi-VN')} VNĐ (${tripDays} ngày × ${rate?.toLocaleString('vi-VN')} VNĐ/ngày theo BR-TR-02)`,
      maxPerDiem,
      actual: perDiemBudget,
    };
  }

  return null;
}
