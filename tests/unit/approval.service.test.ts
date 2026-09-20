/**
 * approval.service.test.ts — Unit Tests: Approval Router Service
 *
 * approval.service.ts chứa pure function routeApproval() — không dùng Prisma.
 * Không cần mock bất kỳ dependency nào.
 *
 * Business Rule: BR-TR-04
 *   budget > 20M VNĐ  OR  hasViolations  → PENDING_ADMIN_APPROVAL
 *   budget ≤ 20M VNĐ  AND !hasViolations → APPROVED
 *
 * Test IDs: A-01 … A-09
 */

import { describe, it, expect } from 'vitest';
import { routeApproval } from '../../src/backend/src/services/approval.service';
import { LEVEL2_BUDGET_THRESHOLD } from '../../src/backend/src/services/policy.service';

describe('routeApproval — BR-TR-04: Approval routing', () => {

  // ── Happy Path ─────────────────────────────────────────────────────────────

  // A-01
  it('[A-01] budget dưới ngưỡng + không vi phạm → APPROVED', () => {
    const result = routeApproval({ totalBudget: 10_000_000, hasViolations: false });

    expect(result.decision).toBe('APPROVED');
    expect(result.reason).toBeTruthy();
  });

  // A-02
  it('[A-02] budget đúng bằng ngưỡng 20M + không vi phạm → APPROVED (boundary, không vượt)', () => {
    const result = routeApproval({
      totalBudget:   LEVEL2_BUDGET_THRESHOLD, // = 20_000_000, không > 20M
      hasViolations: false,
    });

    expect(result.decision).toBe('APPROVED');
  });

  // A-09
  it('[A-09] budget = 0, không vi phạm → APPROVED', () => {
    const result = routeApproval({ totalBudget: 0, hasViolations: false });

    expect(result.decision).toBe('APPROVED');
  });

  // ── Business Rule Violations ───────────────────────────────────────────────

  // A-03
  it('[A-03] budget vượt ngưỡng (20M + 1) → PENDING_ADMIN_APPROVAL', () => {
    const result = routeApproval({
      totalBudget:   LEVEL2_BUDGET_THRESHOLD + 1, // = 20_000_001
      hasViolations: false,
    });

    expect(result.decision).toBe('PENDING_ADMIN_APPROVAL');
  });

  // A-04
  it('[A-04] budget OK nhưng có vi phạm chính sách → PENDING_ADMIN_APPROVAL', () => {
    const result = routeApproval({ totalBudget: 5_000_000, hasViolations: true });

    expect(result.decision).toBe('PENDING_ADMIN_APPROVAL');
  });

  // A-05
  it('[A-05] cả budget vượt lẫn có vi phạm → PENDING_ADMIN_APPROVAL, reason chứa cả 2', () => {
    const result = routeApproval({ totalBudget: 25_000_000, hasViolations: true });

    expect(result.decision).toBe('PENDING_ADMIN_APPROVAL');
    // reason phải đề cập đến cả budget lẫn vi phạm
    expect(result.reason).toMatch(/25\.000\.000|25,000,000/);
    expect(result.reason).toMatch(/vi phạm/i);
  });

  // ── Reason String Content ──────────────────────────────────────────────────

  // A-06
  it('[A-06] APPROVED reason chứa thông tin "trong hạn mức"', () => {
    const result = routeApproval({ totalBudget: 5_000_000, hasViolations: false });

    expect(result.reason).toMatch(/trong hạn mức/i);
    expect(result.reason).toMatch(/không có vi phạm/i);
  });

  // A-07
  it('[A-07] PENDING reason chứa budget amount khi chỉ vượt budget', () => {
    const result = routeApproval({ totalBudget: 25_000_000, hasViolations: false });

    expect(result.decision).toBe('PENDING_ADMIN_APPROVAL');
    // reason phải đề cập đến số tiền budget
    expect(result.reason).toMatch(/25/);
  });

  // A-08
  it('[A-08] PENDING reason chứa "vi phạm" khi chỉ có violations', () => {
    const result = routeApproval({ totalBudget: 5_000_000, hasViolations: true });

    expect(result.decision).toBe('PENDING_ADMIN_APPROVAL');
    expect(result.reason).toMatch(/vi phạm/i);
  });

});

describe('LEVEL2_BUDGET_THRESHOLD export', () => {

  it('export đúng giá trị 20,000,000 VNĐ', () => {
    expect(LEVEL2_BUDGET_THRESHOLD).toBe(20_000_000);
  });

});
