/**
 * policy.service.test.ts — Unit Tests: Policy Check Engine
 *
 * policy.service.ts chứa toàn bộ pure functions — không dùng Prisma.
 * Không cần mock bất kỳ dependency nào.
 *
 * Business Rules được test:
 *   BR-TR-01 — Hotel limit theo jobGrade
 *   BR-TR-02 — Per diem cap theo destination type (severity BLOCKER)
 *   BR-TR-03 — Advance notice >= 3 working days
 *   BR-TR-04 — Budget threshold 20M → requires level 2 approval
 *
 * Test IDs bám theo Test Matrix Phase 4: P-01 … P-22
 */

import { describe, it, expect } from 'vitest';
import {
  countWorkingDays,
  runPolicyCheck,
  HOTEL_LIMIT,
  PER_DIEM_RATE,
  LEVEL2_BUDGET_THRESHOLD,
  MIN_ADVANCE_WORKING_DAYS,
  type PolicyCheckInput,
} from '../../src/backend/src/services/policy.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * nextMonday — Trả về ngày Thứ 2 tiếp theo từ hôm nay
 * Dùng làm điểm neo cho các test liên quan đến working days
 * để tránh flaky test cuối tuần.
 */
function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // 0=Sun,1=Mon,...,6=Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Base input hợp lệ — test cases sẽ override từng field */
function makeInput(overrides: Partial<PolicyCheckInput> = {}): PolicyCheckInput {
  const monday = nextMonday();
  return {
    jobGrade:         'STAFF',
    destinationType:  'TIER1_CITY',
    estimatedBudget:  8_000_000,
    tripDays:         4,
    departureDate:    addDays(monday, 14), // 14 ngày sau → nhiều hơn 3 WD
    createdAt:        monday,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// countWorkingDays
// ══════════════════════════════════════════════════════════════════════════════

describe('countWorkingDays', () => {

  // P-01
  it('[P-01] đếm đúng 5 ngày làm việc trong 1 tuần (Mon→Sat)', () => {
    const monday = nextMonday();
    const saturday = addDays(monday, 5); // Mon+5 = Sat (không tính)
    expect(countWorkingDays(monday, saturday)).toBe(5);
  });

  // P-02
  it('[P-02] bỏ qua T7 và CN khi tính qua 2 tuần', () => {
    const monday = nextMonday();
    const twoWeeksLater = addDays(monday, 14); // 2 tuần = 14 ngày, 10 WD
    expect(countWorkingDays(monday, twoWeeksLater)).toBe(10);
  });

  // P-03
  it('[P-03] from === to → trả về 0 (boundary)', () => {
    const monday = nextMonday();
    expect(countWorkingDays(monday, monday)).toBe(0);
  });

  // P-04
  it('[P-04] from > to → trả về 0 (loop không chạy)', () => {
    const monday = nextMonday();
    const prevDay = addDays(monday, -1);
    expect(countWorkingDays(monday, prevDay)).toBe(0);
  });

  // P-05
  it('[P-05] chỉ weekend (Sat → Mon) → 0 ngày làm việc', () => {
    const monday = nextMonday();
    const saturday = addDays(monday, -2);  // Thứ 7
    const nextMon  = addDays(monday, 0);   // Thứ 2 tiếp (không tính vào range)
    // Sat 00:00 → Mon 00:00 = chỉ Sat + Sun trong range → 0 WD
    expect(countWorkingDays(saturday, nextMon)).toBe(0);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — Constants
// ══════════════════════════════════════════════════════════════════════════════

describe('Constants', () => {

  it('HOTEL_LIMIT STAFF = 1,000,000 VNĐ (BR-TR-01)', () => {
    expect(HOTEL_LIMIT['STAFF']).toBe(1_000_000);
  });

  it('HOTEL_LIMIT MANAGER_GRADE = 1,800,000 VNĐ (BR-TR-01)', () => {
    expect(HOTEL_LIMIT['MANAGER_GRADE']).toBe(1_800_000);
  });

  it('HOTEL_LIMIT DIRECTOR = 3,000,000 VNĐ (BR-TR-01)', () => {
    expect(HOTEL_LIMIT['DIRECTOR']).toBe(3_000_000);
  });

  it('PER_DIEM_RATE TIER1_CITY = 400,000 VNĐ/ngày (BR-TR-02)', () => {
    expect(PER_DIEM_RATE['TIER1_CITY']).toBe(400_000);
  });

  it('PER_DIEM_RATE OTHER = 300,000 VNĐ/ngày (BR-TR-02)', () => {
    expect(PER_DIEM_RATE['OTHER']).toBe(300_000);
  });

  it('LEVEL2_BUDGET_THRESHOLD = 20,000,000 VNĐ (BR-TR-04)', () => {
    expect(LEVEL2_BUDGET_THRESHOLD).toBe(20_000_000);
  });

  it('MIN_ADVANCE_WORKING_DAYS = 3 (BR-TR-03)', () => {
    expect(MIN_ADVANCE_WORKING_DAYS).toBe(3);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — Happy Path
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — [HAPPY] không có violation', () => {

  // P-06
  it('[P-06] input hợp lệ hoàn toàn → passed=true, violations=[]', () => {
    const result = runPolicyCheck(makeInput());

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.violationCount).toBe(0);
    expect(result.requiresLevel2Approval).toBe(false);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-01: Hotel Limit
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-01: Hotel limit theo jobGrade', () => {

  // P-07
  it('[P-07] STAFF vượt hotel limit (1.2M > 1M) → ACCOMMODATION_OVER_BUDGET, WARNING', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'STAFF',
      hotelCostPerNight: 1_200_000,
    }));

    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('WARNING');
    expect(v?.rule).toBe('BR-TR-01');
    expect(v?.limit).toBe(1_000_000);
    expect(v?.actual).toBe(1_200_000);
  });

  // P-08
  it('[P-08] MANAGER_GRADE đúng hạn mức (1.8M = 1.8M) → không vi phạm (boundary)', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'MANAGER_GRADE',
      hotelCostPerNight: 1_800_000,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET')).toBe(false);
  });

  // P-09
  it('[P-09] MANAGER_GRADE vượt hạn mức (1.8M + 1) → vi phạm (boundary)', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'MANAGER_GRADE',
      hotelCostPerNight: 1_800_001,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET')).toBe(true);
  });

  // P-10
  it('[P-10] jobGrade không có trong HOTEL_LIMIT → không trigger BR-TR-01', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'UNKNOWN_GRADE',
      hotelCostPerNight: 9_999_999,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET')).toBe(false);
  });

  // P-11
  it('[P-11] hotelCostPerNight = 0 → không trigger BR-TR-01', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'STAFF',
      hotelCostPerNight: 0,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET')).toBe(false);
  });

  it('[P-11b] hotelCostPerNight = undefined → không trigger BR-TR-01', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'STAFF',
      hotelCostPerNight: undefined,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET')).toBe(false);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-02: Per Diem Cap
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-02: Per diem cap', () => {

  // P-12
  it('[P-12] TIER1_CITY: perDiem vượt → PER_DIEM_EXCEEDED, BLOCKER', () => {
    // 4 ngày × 400k = 1.6M max; gửi 2M → vượt
    const result = runPolicyCheck(makeInput({
      destinationType: 'TIER1_CITY',
      perDiemBudget:   2_000_000,
      tripDays:        4,
    }));

    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_PER_DIEM_EXCEEDED');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('BLOCKER');     // BUG-13 fix: phải là BLOCKER
    expect(v?.rule).toBe('BR-TR-02');
    expect(v?.limit).toBe(1_600_000);        // 4 × 400k
    expect(v?.actual).toBe(2_000_000);
  });

  // P-13
  it('[P-13] OTHER: perDiem đúng hạn mức (300k × 1 ngày) → không vi phạm', () => {
    const result = runPolicyCheck(makeInput({
      destinationType: 'OTHER',
      perDiemBudget:   300_000,
      tripDays:        1,
    }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_PER_DIEM_EXCEEDED')).toBe(false);
  });

  // P-14
  it('[P-14] destinationType unknown → fallback rate OTHER (300k/ngày)', () => {
    // 1 ngày × 300k = 300k max; gửi 400k → vượt theo rate OTHER
    const result = runPolicyCheck(makeInput({
      destinationType: 'UNKNOWN_TYPE',
      perDiemBudget:   400_000,
      tripDays:        1,
    }));

    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_PER_DIEM_EXCEEDED');
    expect(v).toBeDefined();
    expect(v?.limit).toBe(300_000); // fallback OTHER rate
  });

  // P-15
  it('[P-15] severity của PER_DIEM_EXCEEDED phải là BLOCKER (không phải WARNING)', () => {
    const result = runPolicyCheck(makeInput({
      destinationType: 'TIER1_CITY',
      perDiemBudget:   2_000_000,
      tripDays:        1,
    }));

    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_PER_DIEM_EXCEEDED');
    expect(v?.severity).toBe('BLOCKER');
    expect(v?.severity).not.toBe('WARNING');
  });

  it('[P-15b] perDiemBudget = undefined → không trigger BR-TR-02', () => {
    const result = runPolicyCheck(makeInput({ perDiemBudget: undefined }));
    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_PER_DIEM_EXCEEDED')).toBe(false);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-03: Advance Notice
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-03: Advance notice', () => {

  // P-16
  it('[P-16] < 3 ngày làm việc trước khởi hành → URGENT_TRIP_NOTICE, WARNING', () => {
    const monday = nextMonday();
    // Mon → Wed = 2 ngày làm việc (Mon+1=Tue, Mon+2=Wed) → chưa đủ 3
    const wednesday = addDays(monday, 2);

    const result = runPolicyCheck(makeInput({
      createdAt:     monday,
      departureDate: wednesday,
    }));

    const v = result.violations.find(v => v.code === 'URGENT_TRIP_NOTICE');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('WARNING');
    expect(v?.rule).toBe('BR-TR-03');
    expect(v?.actual).toBeLessThan(3);
    expect(v?.limit).toBe(3);
  });

  // P-17
  it('[P-17] đúng 3 ngày làm việc trước khởi hành → không trigger (boundary)', () => {
    const monday = nextMonday();
    // Mon → Thu = 3 ngày làm việc (Tue, Wed, Thu) — không trigger
    const thursday = addDays(monday, 3);

    const result = runPolicyCheck(makeInput({
      createdAt:     monday,
      departureDate: thursday,
    }));

    expect(result.violations.some(v => v.code === 'URGENT_TRIP_NOTICE')).toBe(false);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-04: Budget Threshold
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-04: Budget threshold', () => {

  // P-18
  it('[P-18] budget = 20,000,001 → BUDGET_THRESHOLD, WARNING (vượt ngưỡng)', () => {
    const result = runPolicyCheck(makeInput({ estimatedBudget: 20_000_001 }));

    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_BUDGET_THRESHOLD');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('WARNING');
    expect(v?.rule).toBe('BR-TR-04');
    expect(v?.limit).toBe(20_000_000);
    expect(v?.actual).toBe(20_000_001);
  });

  // P-19
  it('[P-19] budget = 20,000,000 → KHÔNG trigger (đúng bằng ngưỡng, không vượt)', () => {
    const result = runPolicyCheck(makeInput({ estimatedBudget: 20_000_000 }));

    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_BUDGET_THRESHOLD')).toBe(false);
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — Multi-violation + requiresLevel2
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — Multiple violations & requiresLevel2', () => {

  // P-20
  it('[P-20] nhiều violations cùng lúc → violations.length tương ứng', () => {
    const monday = nextMonday();
    const result = runPolicyCheck({
      jobGrade:          'STAFF',
      destinationType:   'TIER1_CITY',
      estimatedBudget:   25_000_000,    // BR-TR-04
      hotelCostPerNight: 1_500_000,     // BR-TR-01 (> 1M)
      perDiemBudget:     3_000_000,     // BR-TR-02 (> 4days × 400k = 1.6M)
      tripDays:          4,
      createdAt:         monday,
      departureDate:     addDays(monday, 14), // đủ advance notice
    });

    // Phải có: ACCOMMODATION + PER_DIEM + BUDGET_THRESHOLD = 3 violations
    expect(result.violations.length).toBe(3);
    expect(result.violationCount).toBe(3);
    expect(result.passed).toBe(false);
  });

  // P-21
  it('[P-21] có bất kỳ violation nào → requiresLevel2Approval=true', () => {
    const result = runPolicyCheck(makeInput({ estimatedBudget: 25_000_000 }));

    expect(result.requiresLevel2Approval).toBe(true);
    expect(result.passed).toBe(false);
  });

  // P-22
  it('[P-22] violation object có đủ required fields', () => {
    const result = runPolicyCheck(makeInput({
      jobGrade:          'STAFF',
      hotelCostPerNight: 1_200_000,
    }));

    const v = result.violations[0]!;
    expect(v).toHaveProperty('code');
    expect(v).toHaveProperty('detail');
    expect(v).toHaveProperty('severity');
    expect(v).toHaveProperty('rule');
    expect(v).toHaveProperty('limit');
    expect(v).toHaveProperty('actual');
    expect(typeof v.detail).toBe('string');
    expect(v.detail.length).toBeGreaterThan(0);
  });

});
