/**
 * policyRules.ts — Pure Business Rule Module (no Express/Prisma dependencies)
 *
 * Chứa:
 *   - Hằng số BR-TR-01, BR-TR-02
 *   - calcTripDays, resolveDestinationType
 *   - checkCombinedCostLimit (BR-TR-08)
 *   - buildApprovalReasons (BR-TR-03/04/08 → ApprovalReason[])
 *
 * Dễ unit test độc lập. Không import bất kỳ thứ gì ngoài TypeScript stdlib.
 *
 * Tài liệu tham chiếu: business-rules.md, BR-TR-08-combined-cost-limit.md,
 *   decision-log.md D-06, D-10, D-15, D-16
 */

// ─── BR-TR-01: Hotel Limit theo jobGrade (VNĐ/đêm) ──────────────────────────

/** Hạn mức khách sạn theo cấp bậc (VNĐ/đêm) — BR-TR-01, D-06 */
export const HOTEL_LIMIT_PER_NIGHT: Record<string, number> = {
  STAFF:         1_000_000,
  MANAGER_GRADE: 1_800_000,
  DIRECTOR:      3_000_000,
};

// ─── BR-TR-02: Per Diem Rate theo loại điểm đến (VNĐ/ngày) ──────────────────

/** Mức per diem theo loại điểm đến (VNĐ/ngày) — BR-TR-02 */
export const PER_DIEM_RATE: Record<string, number> = {
  TIER1_CITY: 400_000, // Hà Nội, TP.HCM, Đà Nẵng
  OTHER:      300_000, // Các tỉnh thành khác
};

// ─── Destination alias map — resolveDestinationType ──────────────────────────

/** Alias chuẩn hóa → TIER1_CITY (sau khi đã bỏ dấu, hạ thường, trim) */
const TIER1_ALIASES: ReadonlySet<string> = new Set([
  // Hà Nội
  'ha noi', 'hanoi', 'hn',
  // TP.HCM
  'ho chi minh', 'tp ho chi minh', 'tp hcm', 'tphcm', 'hcm',
  'sai gon', 'saigon', 'thanh pho ho chi minh',
  // Đà Nẵng
  'da nang', 'danang',
]);

/**
 * normalizeVietnamese — bỏ dấu, hạ thường, bỏ dấu câu/khoảng trắng thừa
 * Dùng unorm-style decompose + remove combining chars nếu môi trường hỗ trợ,
 * fallback sang bản thay thế thủ công.
 */
export function normalizeVietnamese(s: string): string {
  // Bước 1: Unicode decompose (NFD) — tách ký tự gốc + combining diacritics
  const decomposed = s.normalize('NFD');
  // Bước 2: Xóa combining diacritical marks (U+0300..U+036F)
  const stripped = decomposed.replace(/[\u0300-\u036f]/g, '');
  // Bước 3: Xóa ký tự đặc biệt còn sót (đ → d)
  const mapped = stripped
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')  // bỏ dấu câu còn lại
    .replace(/\s+/g, ' ')          // gộp khoảng trắng thừa
    .trim();
  return mapped;
}

/**
 * resolveDestinationType — suy ra loại điểm đến từ chuỗi điểm đến
 *
 * Bỏ dấu → hạ thường → so khớp alias table.
 * Khớp → TIER1_CITY, không khớp → OTHER.
 */
export function resolveDestinationType(destination: string): 'TIER1_CITY' | 'OTHER' {
  const norm = normalizeVietnamese(destination);
  if (TIER1_ALIASES.has(norm)) return 'TIER1_CITY';
  // Thử so khớp substring (vd "Tp. Hồ Chí Minh" → "tp ho chi minh")
  for (const alias of TIER1_ALIASES) {
    if (norm.includes(alias) || alias.includes(norm)) return 'TIER1_CITY';
  }
  return 'OTHER';
}

// ─── calcTripDays — đếm ngày theo date-only/UTC ──────────────────────────────

/**
 * calcTripDays — tính số ngày công tác (tính cả ngày đi và ngày về)
 *
 * Dùng date-only (UTC) để tránh lệch múi giờ.
 * tripDays = (returnDate − departureDate) + 1
 * hotelNights = max(tripDays − 1, 0)
 *
 * @returns { tripDays, hotelNights } — hoặc { tripDays: 0, hotelNights: 0 } nếu dữ liệu lệch
 */
export function calcTripDays(
  departureDate: Date,
  returnDate: Date
): { tripDays: number; hotelNights: number } {
  const depMs  = Date.UTC(departureDate.getUTCFullYear(), departureDate.getUTCMonth(), departureDate.getUTCDate());
  const retMs  = Date.UTC(returnDate.getUTCFullYear(), returnDate.getUTCMonth(), returnDate.getUTCDate());
  const diffDays = Math.round((retMs - depMs) / 86_400_000);
  if (diffDays < 0) return { tripDays: 0, hotelNights: 0 };
  const tripDays   = diffDays + 1;
  const hotelNights = Math.max(tripDays - 1, 0);
  return { tripDays, hotelNights };
}

// ─── BR-TR-08: checkCombinedCostLimit ────────────────────────────────────────

export interface CombinedCostInput {
  startDate:     Date;
  endDate:       Date;
  jobGrade:      string; // STAFF | MANAGER_GRADE | DIRECTOR
  destination:   string; // chuỗi điểm đến người dùng nhập
  plannedBudget: number; // estimatedBudget — Combined_Actual
}

export interface CombinedCostResult {
  exceeded:        boolean;
  plannedBudget:   number;
  combinedLimit:   number;
  hotelLimitTotal: number;
  perDiemLimitTotal: number;
  tripDays:        number;
  hotelNights:     number;
  jobGrade:        string;
  destinationType: 'TIER1_CITY' | 'OTHER';
}

/**
 * checkCombinedCostLimit — BR-TR-08 (D-15, D-16)
 *
 * Combined_Actual     = plannedBudget
 * Hotel_Limit_Total   = HOTEL_LIMIT_PER_NIGHT[jobGrade] × hotelNights
 * Per_Diem_Limit_Total = tripDays × PER_DIEM_RATE[destinationType]
 * Combined_Limit      = Hotel_Limit_Total + Per_Diem_Limit_Total
 *
 * exceeded = Combined_Actual > Combined_Limit
 *
 * Không đánh giá khi:
 *   - dates không hợp lệ (returnDate < departureDate)
 *   - jobGrade không nhận ra (trả exceeded=false)
 */
export function checkCombinedCostLimit(input: CombinedCostInput): CombinedCostResult {
  const destinationType = resolveDestinationType(input.destination);
  const { tripDays, hotelNights } = calcTripDays(input.startDate, input.endDate);

  // Không đánh giá khi ngày không hợp lệ
  if (tripDays === 0) {
    return {
      exceeded: false, plannedBudget: input.plannedBudget, combinedLimit: 0,
      hotelLimitTotal: 0, perDiemLimitTotal: 0,
      tripDays: 0, hotelNights: 0, jobGrade: input.jobGrade, destinationType,
    };
  }

  const hotelRate   = HOTEL_LIMIT_PER_NIGHT[input.jobGrade] ?? 0;
  const perDiemRate = PER_DIEM_RATE[destinationType];

  const hotelLimitTotal    = hotelRate * hotelNights;
  const perDiemLimitTotal  = tripDays * perDiemRate;
  const combinedLimit      = hotelLimitTotal + perDiemLimitTotal;
  const exceeded           = input.plannedBudget > combinedLimit;

  return {
    exceeded,
    plannedBudget: input.plannedBudget,
    combinedLimit,
    hotelLimitTotal,
    perDiemLimitTotal,
    tripDays,
    hotelNights,
    jobGrade:        input.jobGrade,
    destinationType,
  };
}

// ─── ApprovalReason type ──────────────────────────────────────────────────────

export type ApprovalReasonCode =
  | 'URGENT_TRIP'
  | 'BUDGET_OVER_THRESHOLD'
  | 'COMBINED_COST_LIMIT_EXCEEDED';

export interface ApprovalReason {
  code:   ApprovalReasonCode;
  title:  string;
  detail: string; // chuỗi tiếng Việt đã format, có số liệu cụ thể
  data:   Record<string, unknown>; // số liệu thô để client dùng
}

// ─── buildApprovalReasons ────────────────────────────────────────────────────

export interface BuildApprovalReasonsInput {
  isUrgent:          boolean;
  urgencyReason?:    string | null;
  estimatedBudget:   number;
  startDate:         Date;
  endDate:           Date;
  jobGrade:          string;
  destination:       string;
}

/**
 * buildApprovalReasons — hàm thuần duy nhất xây dựng danh sách lý do 2 cấp
 *
 * Trả [] nếu không có lý do nào → 1 cấp duyệt.
 * Trả mảng có phần tử → 2 cấp duyệt (requiresLevel2 = reasons.length > 0).
 *
 * Thứ tự: URGENT_TRIP → BUDGET_OVER_THRESHOLD → COMBINED_COST_LIMIT_EXCEEDED
 */
export function buildApprovalReasons(input: BuildApprovalReasonsInput): ApprovalReason[] {
  const reasons: ApprovalReason[] = [];

  // ── Điều kiện 1: URGENT_TRIP (BR-TR-03) ──────────────────────────────────
  if (input.isUrgent) {
    const urgentReasonText = input.urgencyReason?.trim()
      ? `Lý do khẩn cấp: ${input.urgencyReason.trim()}.`
      : 'Lý do khẩn cấp: không rõ.';
    reasons.push({
      code:  'URGENT_TRIP',
      title: 'Chuyến đi khẩn cấp',
      detail: `Yêu cầu gửi dưới 3 ngày làm việc trước ngày khởi hành. ${urgentReasonText}`,
      data:  { urgencyReason: input.urgencyReason ?? null },
    });
  }

  // ── Điều kiện 2: BUDGET_OVER_THRESHOLD (BR-TR-04) ────────────────────────
  if (input.estimatedBudget > 20_000_000) {
    reasons.push({
      code:  'BUDGET_OVER_THRESHOLD',
      title: 'Ngân sách vượt ngưỡng',
      detail: `Ngân sách dự kiến ${input.estimatedBudget.toLocaleString('vi-VN')} VNĐ vượt ngưỡng 20.000.000 VNĐ.`,
      data:  { plannedBudget: input.estimatedBudget, threshold: 20_000_000 },
    });
  }

  // ── Điều kiện 3: COMBINED_COST_LIMIT_EXCEEDED (BR-TR-08) ─────────────────
  const costResult = checkCombinedCostLimit({
    startDate:     input.startDate,
    endDate:       input.endDate,
    jobGrade:      input.jobGrade,
    destination:   input.destination,
    plannedBudget: input.estimatedBudget,
  });

  if (costResult.exceeded) {
    const destLabel = costResult.destinationType === 'TIER1_CITY'
      ? 'Hà Nội / TP.HCM / Đà Nẵng'
      : 'tỉnh/thành phố khác';
    const jobGradeLabel: Record<string, string> = {
      STAFF: 'Staff', MANAGER_GRADE: 'Manager', DIRECTOR: 'Director',
    };
    const grade = jobGradeLabel[costResult.jobGrade] ?? costResult.jobGrade;
    reasons.push({
      code:  'COMBINED_COST_LIMIT_EXCEEDED',
      title: 'Vượt tổng hạn mức lưu trú và phụ cấp',
      detail: `Vi phạm chính sách: Ngân sách dự kiến ${costResult.plannedBudget.toLocaleString('vi-VN')} VNĐ vượt tổng hạn mức lưu trú và phụ cấp ${costResult.combinedLimit.toLocaleString('vi-VN')} VNĐ (${grade}, ${costResult.tripDays} ngày / ${costResult.hotelNights} đêm, ${destLabel}).`,
      data:  {
        plannedBudget:    costResult.plannedBudget,
        combinedLimit:    costResult.combinedLimit,
        hotelLimitTotal:  costResult.hotelLimitTotal,
        perDiemLimitTotal: costResult.perDiemLimitTotal,
        tripDays:         costResult.tripDays,
        hotelNights:      costResult.hotelNights,
        jobGrade:         costResult.jobGrade,
        destinationType:  costResult.destinationType,
      },
    });
  }

  return reasons;
}
