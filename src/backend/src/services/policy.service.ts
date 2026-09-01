/**
 * policy.service.ts — Policy Check Engine
 *
 * Implements toàn bộ Business Rules liên quan đến kiểm tra chính sách
 * công tác trước khi submit (architecture.md §5.3).
 *
 * Business Rules:
 *   BR-TR-01 — Hotel limit theo jobGrade
 *   BR-TR-02 — Per diem cap theo destination type
 *   BR-TR-03 — Advance notice ≥ 3 working days
 *   BR-TR-04 — Budget threshold → requires level 2 approval
 */

// ─── Constants (BR-TR-01, BR-TR-02) ──────────────────────────────────────────

/** Hạn mức khách sạn theo cấp bậc (VNĐ/đêm) — BR-TR-01, D-06 */
export const HOTEL_LIMIT: Record<string, number> = {
  STAFF:          1_000_000,
  MANAGER_GRADE:  1_800_000,
  DIRECTOR:       3_000_000,
};

/** Mức per diem theo loại địa điểm (VNĐ/ngày) — BR-TR-02 */
export const PER_DIEM_RATE: Record<string, number> = {
  TIER1_CITY: 400_000, // Hà Nội, TP.HCM, Đà Nẵng
  OTHER:      300_000, // Các tỉnh thành khác
};

/** Ngưỡng ngân sách cần duyệt cấp 2 (VNĐ) — BR-TR-04 */
export const LEVEL2_BUDGET_THRESHOLD = 20_000_000;

/** Ngày làm việc tối thiểu trước khi khởi hành — BR-TR-03, D-07 */
export const MIN_ADVANCE_WORKING_DAYS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViolationCode =
  | 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET'
  | 'POLICY_VIOLATION_PER_DIEM_EXCEEDED'
  | 'URGENT_TRIP_NOTICE'
  | 'POLICY_VIOLATION_BUDGET_THRESHOLD';

export type ViolationSeverity = 'WARNING' | 'BLOCKER';

export interface PolicyViolation {
  code: ViolationCode;
  detail: string;
  severity: ViolationSeverity;
  rule: string;
  limit?: number;
  actual?: number;
}

export interface PolicyCheckResult {
  passed: boolean;
  violations: PolicyViolation[];
  violationCount: number;
  requiresLevel2Approval: boolean;
}

export interface PolicyCheckInput {
  jobGrade: string;           // STAFF | MANAGER_GRADE | DIRECTOR
  destinationType: string;    // TIER1_CITY | OTHER
  estimatedBudget: number;    // Tổng dự toán VNĐ
  hotelCostPerNight?: number; // Chi phí khách sạn/đêm
  perDiemBudget?: number;     // Dự toán phụ cấp
  tripDays: number;           // Số ngày công tác
  departureDate: Date;        // Ngày khởi hành
  createdAt: Date;            // Ngày tạo request (để tính working days)
}

// ─── Helper: Working Days Calculator ─────────────────────────────────────────

/**
 * Tính số ngày làm việc giữa 2 ngày (không tính weekend)
 * Chưa tính ngày lễ — đủ cho MVP scope
 */
export function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // 0 = Sunday, 6 = Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ─── Policy Check Engine ──────────────────────────────────────────────────────

/**
 * runPolicyCheck — Chạy toàn bộ business rules kiểm tra chính sách
 *
 * @param input - Thông tin trip và user để kiểm tra
 * @returns PolicyCheckResult với danh sách violations
 */
export function runPolicyCheck(input: PolicyCheckInput): PolicyCheckResult {
  const violations: PolicyViolation[] = [];

  // ── BR-TR-01: Hotel limit theo jobGrade ────────────────────────────────────
  if (input.hotelCostPerNight !== undefined && input.hotelCostPerNight > 0) {
    const hotelLimit = HOTEL_LIMIT[input.jobGrade];
    if (hotelLimit !== undefined && input.hotelCostPerNight > hotelLimit) {
      violations.push({
        code: 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET',
        detail: `Chi phí khách sạn ${input.hotelCostPerNight.toLocaleString('vi-VN')} VNĐ/đêm vượt hạn mức ${input.jobGrade} (${hotelLimit.toLocaleString('vi-VN')} VNĐ/đêm)`,
        severity: 'WARNING',
        rule: 'BR-TR-01',
        limit: hotelLimit,
        actual: input.hotelCostPerNight,
      });
    }
  }

  // ── BR-TR-02: Per diem cap ─────────────────────────────────────────────────
  if (input.perDiemBudget !== undefined && input.perDiemBudget > 0) {
    const dailyRate = PER_DIEM_RATE[input.destinationType] ?? PER_DIEM_RATE['OTHER'];
    const maxPerDiem = input.tripDays * (dailyRate ?? 0);
    if (input.perDiemBudget > maxPerDiem) {
      violations.push({
        code: 'POLICY_VIOLATION_PER_DIEM_EXCEEDED',
        detail: `Phụ cấp công tác ${input.perDiemBudget.toLocaleString('vi-VN')} VNĐ vượt mức tối đa ${maxPerDiem.toLocaleString('vi-VN')} VNĐ (${input.tripDays} ngày × ${dailyRate?.toLocaleString('vi-VN')} VNĐ/ngày)`,
        severity: 'WARNING',
        rule: 'BR-TR-02',
        limit: maxPerDiem,
        actual: input.perDiemBudget,
      });
    }
  }

  // ── BR-TR-03: Advance notice ≥ 3 working days ─────────────────────────────
  const workingDaysAdvance = countWorkingDays(input.createdAt, input.departureDate);
  if (workingDaysAdvance < MIN_ADVANCE_WORKING_DAYS) {
    violations.push({
      code: 'URGENT_TRIP_NOTICE',
      detail: `Yêu cầu được tạo chỉ ${workingDaysAdvance} ngày làm việc trước khởi hành (tối thiểu ${MIN_ADVANCE_WORKING_DAYS} ngày)`,
      severity: 'WARNING',
      rule: 'BR-TR-03',
      limit: MIN_ADVANCE_WORKING_DAYS,
      actual: workingDaysAdvance,
    });
  }

  // ── BR-TR-04: Budget threshold → level 2 ──────────────────────────────────
  const requiresLevel2 =
    input.estimatedBudget > LEVEL2_BUDGET_THRESHOLD || violations.length > 0;

  return {
    passed: violations.length === 0,
    violations,
    violationCount: violations.length,
    requiresLevel2Approval: requiresLevel2,
  };
}
