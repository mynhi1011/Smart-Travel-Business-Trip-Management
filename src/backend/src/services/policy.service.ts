/**
 * policy.service.ts — Policy Check Engine
 *
 * Implements Business Rules kiểm tra chính sách trước khi submit (architecture.md §5.3).
 *
 * Business Rules:
 *   BR-TR-03 — Advance notice ≥ 3 working days (URGENT_TRIP_NOTICE)
 *   BR-TR-04 — Budget threshold → requires level 2 approval
 *   BR-TR-08 — Combined cost limit (plannedBudget vs hotel+perDiem combined limit)
 *
 * BR-TR-01 và BR-TR-02 chỉ là mức tham chiếu — KHÔNG phát sinh warning riêng.
 * Kiểm tra tổng hợp duy nhất là BR-TR-08 (checkCombinedCostLimit).
 *
 * Tài liệu tham chiếu: business-rules.md, decision-log.md D-10, D-15, D-16
 */

// Re-export hằng số từ policyRules để các module khác vẫn import được từ policy.service
export { HOTEL_LIMIT_PER_NIGHT as HOTEL_LIMIT, PER_DIEM_RATE } from './policyRules';
import { calcTripDays, checkCombinedCostLimit } from './policyRules';

// ─── Re-export for backwards compat ──────────────────────────────────────────
export { calcTripDays };

/** Ngưỡng ngân sách cần duyệt cấp 2 (VNĐ) — BR-TR-04 */
export const LEVEL2_BUDGET_THRESHOLD = 20_000_000;

/** Ngày làm việc tối thiểu trước khi khởi hành — BR-TR-03, D-07 */
export const MIN_ADVANCE_WORKING_DAYS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViolationCode =
  | 'COMBINED_COST_LIMIT_EXCEEDED'    // BR-TR-08 — tổng hạn mức kết hợp
  | 'URGENT_TRIP_NOTICE'              // BR-TR-03 — nộp < 3 ngày làm việc
  | 'POLICY_VIOLATION_BUDGET_THRESHOLD'; // BR-TR-04 — ngân sách > 20M

export type ViolationSeverity = 'WARNING' | 'BLOCKER';

export interface PolicyViolation {
  code: ViolationCode;
  detail: string;
  severity: ViolationSeverity;
  rule: string;
  limit?: number;
  actual?: number;
  // BR-TR-08 extra fields
  combinedLimit?: number;
  hotelLimitTotal?: number;
  perDiemLimitTotal?: number;
  tripDays?: number;
  hotelNights?: number;
  jobGrade?: string;
  destinationType?: string;
}

export interface PolicyCheckResult {
  passed: boolean;
  violations: PolicyViolation[];
  violationCount: number;
  requiresLevel2Approval: boolean;
}

export interface PolicyCheckInput {
  jobGrade: string;          // STAFF | MANAGER_GRADE | DIRECTOR (từ DB user, không từ client)
  destination: string;       // Chuỗi điểm đến người dùng nhập
  estimatedBudget: number;   // plannedBudget — Combined_Actual (BR-TR-08)
  tripDays: number;          // Số ngày công tác (tính sẵn)
  departureDate: Date;       // Ngày khởi hành
  returnDate: Date;          // Ngày về (để tính tripDays nội bộ nếu cần)
  createdAt: Date;           // Ngày tạo request (để tính working days)
}

// ─── Helper: Working Days Calculator ─────────────────────────────────────────

/**
 * countWorkingDays — đếm ngày làm việc giữa 2 ngày (bỏ Thứ 7, Chủ nhật)
 * Chưa tính ngày lễ — đủ cho MVP scope.
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
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ─── White-list: violations đẩy trip sang 2 cấp (BR-TR-04) ──────────────────
// Chỉ 3 code sau → 2 cấp duyệt (D-16):
//   URGENT_TRIP_NOTICE          — BR-TR-03: nộp < 3 ngày làm việc
//   POLICY_VIOLATION_BUDGET_THRESHOLD — BR-TR-04: ngân sách > 20M
//   COMBINED_COST_LIMIT_EXCEEDED — BR-TR-08: vượt tổng hạn mức
const LEVEL2_REQUIRED_CODES: ReadonlySet<string> = new Set([
  'URGENT_TRIP_NOTICE',
  'POLICY_VIOLATION_BUDGET_THRESHOLD',
  'COMBINED_COST_LIMIT_EXCEEDED',
]);

/**
 * requiresLevel2FromViolations — nguồn sự thật duy nhất cho "cần cấp 2?"
 * Dùng nhất quán ở runPolicyCheck và approveTrip.
 */
export function requiresLevel2FromViolations(
  violations: ReadonlyArray<{ code: string; severity: string }>
): boolean {
  return violations.some(
    (v) => LEVEL2_REQUIRED_CODES.has(v.code) && v.severity !== 'INFO'
  );
}

// ─── Policy Check Engine ──────────────────────────────────────────────────────

/**
 * runPolicyCheck — Chạy toàn bộ business rules kiểm tra chính sách
 *
 * Checks:
 *   1. BR-TR-03: Advance notice (< 3 working days → URGENT_TRIP_NOTICE)
 *   2. BR-TR-04: Budget threshold (> 20M → POLICY_VIOLATION_BUDGET_THRESHOLD)
 *   3. BR-TR-08: Combined cost limit (plannedBudget > combinedLimit → COMBINED_COST_LIMIT_EXCEEDED)
 *
 * KHÔNG check BR-TR-01 (hotel per night riêng) hay BR-TR-02 (per diem riêng).
 * Đây là thay đổi theo D-15, D-16.
 */
export function runPolicyCheck(input: PolicyCheckInput): PolicyCheckResult {
  const violations: PolicyViolation[] = [];

  // ── BR-TR-03: Advance notice ≥ 3 working days ─────────────────────────────
  const workingDaysAdvance = countWorkingDays(input.createdAt, input.departureDate);
  if (workingDaysAdvance < MIN_ADVANCE_WORKING_DAYS) {
    violations.push({
      code:   'URGENT_TRIP_NOTICE',
      detail: `Yêu cầu được tạo chỉ ${workingDaysAdvance} ngày làm việc trước khởi hành (tối thiểu ${MIN_ADVANCE_WORKING_DAYS} ngày)`,
      severity: 'WARNING',
      rule:   'BR-TR-03',
      limit:  MIN_ADVANCE_WORKING_DAYS,
      actual: workingDaysAdvance,
    });
  }

  // ── BR-TR-04: Budget threshold → violation + level 2 ────────────────────
  if (input.estimatedBudget > LEVEL2_BUDGET_THRESHOLD) {
    violations.push({
      code:   'POLICY_VIOLATION_BUDGET_THRESHOLD',
      detail: `Ngân sách dự kiến ${input.estimatedBudget.toLocaleString('vi-VN')} VNĐ vượt ngưỡng ${LEVEL2_BUDGET_THRESHOLD.toLocaleString('vi-VN')} VNĐ — bắt buộc phê duyệt cấp 2`,
      severity: 'WARNING',
      rule:   'BR-TR-04',
      limit:  LEVEL2_BUDGET_THRESHOLD,
      actual: input.estimatedBudget,
    });
  }

  // ── BR-TR-08: Combined cost limit ────────────────────────────────────────
  const costResult = checkCombinedCostLimit({
    startDate:     input.departureDate,
    endDate:       input.returnDate,
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
    violations.push({
      code:   'COMBINED_COST_LIMIT_EXCEEDED',
      detail: `Vi phạm chính sách BR-TR-08: Ngân sách dự kiến ${costResult.plannedBudget.toLocaleString('vi-VN')} VNĐ vượt tổng hạn mức lưu trú và phụ cấp ${costResult.combinedLimit.toLocaleString('vi-VN')} VNĐ (${grade}, ${costResult.tripDays} ngày / ${costResult.hotelNights} đêm, ${destLabel})`,
      severity: 'WARNING',
      rule:   'BR-TR-08',
      limit:  costResult.combinedLimit,
      actual: costResult.plannedBudget,
      combinedLimit:    costResult.combinedLimit,
      hotelLimitTotal:  costResult.hotelLimitTotal,
      perDiemLimitTotal: costResult.perDiemLimitTotal,
      tripDays:         costResult.tripDays,
      hotelNights:      costResult.hotelNights,
      jobGrade:         costResult.jobGrade,
      destinationType:  costResult.destinationType,
    });
  }

  const requiresLevel2 = requiresLevel2FromViolations(violations);

  return {
    passed:                violations.length === 0,
    violations,
    violationCount:        violations.length,
    requiresLevel2Approval: requiresLevel2,
  };
}
