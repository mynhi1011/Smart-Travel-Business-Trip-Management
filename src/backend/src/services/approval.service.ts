/**
 * approval.service.ts — Approval Router Service
 *
 * Quyết định phân tầng phê duyệt sau khi Manager approve (BR-TR-04).
 *
 * Logic (D-16):
 *   requiresLevel2 = approvalReasons.length > 0
 *   Nguồn sự thật: buildApprovalReasons() trong policyRules.ts
 *
 *   3 điều kiện → 2 cấp:
 *     1. URGENT_TRIP: nộp < 3 ngày làm việc (BR-TR-03)
 *     2. BUDGET_OVER_THRESHOLD: estimatedBudget > 20M (BR-TR-04)
 *     3. COMBINED_COST_LIMIT_EXCEEDED: plannedBudget > combinedLimit (BR-TR-08)
 *
 * Tài liệu tham chiếu: architecture.md §5.3, business-rules.md BR-TR-04
 */

import { LEVEL2_BUDGET_THRESHOLD } from './policy.service';
export { LEVEL2_BUDGET_THRESHOLD };

export type ApprovalDecision = 'APPROVED' | 'PENDING_ADMIN_APPROVAL';

export interface ApprovalRoutingInput {
  totalBudget:   number;
  hasViolations: boolean; // true nếu violations white-list có ít nhất 1 phần tử
}

export interface ApprovalRoutingResult {
  decision: ApprovalDecision;
  reason:   string;
}

/**
 * routeApproval — Quyết định trạng thái sau khi Manager duyệt cấp 1 (BR-TR-04)
 *
 * Nguồn sự thật: hasViolations được tính bởi requiresLevel2FromViolations()
 * trong policy.service.ts — chỉ đếm violations thuộc LEVEL2_REQUIRED_CODES.
 * Hàm này chỉ là thin wrapper để áp dụng decision.
 */
export function routeApproval(input: ApprovalRoutingInput): ApprovalRoutingResult {
  const overBudgetThreshold = input.totalBudget > LEVEL2_BUDGET_THRESHOLD;

  if (overBudgetThreshold || input.hasViolations) {
    const reasons: string[] = [];
    if (overBudgetThreshold) {
      reasons.push(
        `Ngân sách ${input.totalBudget.toLocaleString('vi-VN')} VNĐ vượt ngưỡng ${LEVEL2_BUDGET_THRESHOLD.toLocaleString('vi-VN')} VNĐ`
      );
    }
    if (input.hasViolations) {
      reasons.push('Có vi phạm chính sách công tác (khẩn cấp hoặc vượt hạn mức)');
    }

    return {
      decision: 'PENDING_ADMIN_APPROVAL',
      reason:   reasons.join('; '),
    };
  }

  return {
    decision: 'APPROVED',
    reason:   'Ngân sách trong hạn mức và không có vi phạm chính sách',
  };
}
