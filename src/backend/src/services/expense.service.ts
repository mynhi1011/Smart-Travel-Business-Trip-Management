/**
 * expense.service.ts — Expense Service
 *
 * Xử lý logic Expense Claim và tính variance (BR-TR-05).
 *
 * BR-TR-05:
 *   variance ≤ 0%       → Finance approve bình thường
 *   0 < variance ≤ 10%  → Cần Employee nhập justification
 *   variance > 10%      → Block Finance close; cần Manager re-approve trước
 *
 * Tài liệu tham chiếu: architecture.md §5.3, business-rules.md BR-TR-05
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ngưỡng variance cần giải trình (%) — BR-TR-05 */
export const VARIANCE_JUSTIFICATION_THRESHOLD = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VarianceResult {
  totalActual: number;
  estimatedBudget: number;
  variancePct: number;       // Tỷ lệ % = (actual - estimated) / estimated * 100
  varianceAmount: number;    // Số tiền chênh lệch (VNĐ)
  requiresJustification: boolean;   // 0 < variance ≤ 10%
  requiresManagerReapproval: boolean; // variance > 10%
}

// ─── Variance Calculator ──────────────────────────────────────────────────────

/**
 * calculateVariance — Tính variance giữa chi phí thực tế và dự toán (BR-TR-05)
 *
 * @param totalActual - Tổng chi phí thực tế (VNĐ)
 * @param estimatedBudget - Dự toán ban đầu (VNĐ)
 * @returns VarianceResult với đầy đủ thông tin chênh lệch
 */
export function calculateVariance(
  totalActual: number,
  estimatedBudget: number
): VarianceResult {
  if (estimatedBudget <= 0) {
    throw new Error('estimatedBudget phải > 0 để tính variance');
  }

  const varianceAmount = totalActual - estimatedBudget;
  const variancePct = (varianceAmount / estimatedBudget) * 100;

  // Round về 2 decimal places (NUMERIC(6,2) trong PostgreSQL spec)
  const variancePctRounded = Math.round(variancePct * 100) / 100;

  return {
    totalActual,
    estimatedBudget,
    variancePct: variancePctRounded,
    varianceAmount,
    requiresJustification:
      variancePctRounded > 0 && variancePctRounded <= VARIANCE_JUSTIFICATION_THRESHOLD,
    requiresManagerReapproval:
      variancePctRounded > VARIANCE_JUSTIFICATION_THRESHOLD,
  };
}

/**
 * validateExpenseSubmit — Validate trước khi submit expense claim
 * TODO: Implement đầy đủ khi xây dựng Expense feature
 */
export function validateExpenseSubmit(
  variance: VarianceResult,
  justification: string | null
): { valid: boolean; error?: string } {
  if (variance.requiresJustification && !justification?.trim()) {
    return {
      valid: false,
      error: `Chi phí vượt dự toán ${variance.variancePct.toFixed(1)}%. Vui lòng nhập lý do giải trình.`,
    };
  }

  if (variance.requiresManagerReapproval) {
    return {
      valid: false,
      error: `Chi phí vượt dự toán ${variance.variancePct.toFixed(1)}% (> ${VARIANCE_JUSTIFICATION_THRESHOLD}%). Cần Manager phê duyệt bổ sung trước khi nộp.`,
    };
  }

  return { valid: true };
}
