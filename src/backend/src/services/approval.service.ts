/**
 * approval.service.ts — Approval Router Service
 *
 * Quyết định phân tầng phê duyệt sau khi Manager approve (BR-TR-04).
 * Logic: budget > 20M VNĐ HOẶC có policy violations → PENDING_ADMIN_APPROVAL
 *        budget ≤ 20M VNĐ VÀ không vi phạm → APPROVED
 *
 * Tài liệu tham chiếu: architecture.md §5.3, business-rules.md BR-TR-04
 */

import { LEVEL2_BUDGET_THRESHOLD } from './policy.service';

export type ApprovalDecision = 'APPROVED' | 'PENDING_ADMIN_APPROVAL';

export interface ApprovalRoutingInput {
  totalBudget: number;
  hasViolations: boolean;
}

export interface ApprovalRoutingResult {
  decision: ApprovalDecision;
  reason: string;
}

/**
 * routeApproval — Quyết định trạng thái sau khi Manager duyệt cấp 1 (BR-TR-04)
 *
 * @param input - Budget và violation flags
 * @returns ApprovalRoutingResult với decision và lý do
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
      reasons.push('Có vi phạm chính sách công tác');
    }

    return {
      decision: 'PENDING_ADMIN_APPROVAL',
      reason: reasons.join('; '),
    };
  }

  return {
    decision: 'APPROVED',
    reason: 'Ngân sách trong hạn mức và không có vi phạm chính sách',
  };
}
