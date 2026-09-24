/**
 * policy.service.test.ts — Unit Tests: Policy Check Engine (BR-TR-08 phiên bản mới)
 *
 * Test Plan bám theo prompt §6 + ví dụ chuẩn trong §2.
 *
 * Các test ID mới: P-01..P-05 (countWorkingDays giữ nguyên),
 *   P-06 (happy path), P-07..P-19 (BR-TR-08), P-20..P-25 (BR-TR-03/04),
 *   P-26..P-35 (buildApprovalReasons + routing), P-36..P-38 (regression).
 *
 * BR-TR-01/02 standalone không còn — tests P-07..P-15 cũ ĐÃ XÓA (D-16).
 */

import { describe, it, expect } from 'vitest';
import {
  countWorkingDays,
  runPolicyCheck,
  LEVEL2_BUDGET_THRESHOLD,
  MIN_ADVANCE_WORKING_DAYS,
  requiresLevel2FromViolations,
  type PolicyCheckInput,
} from '../../src/backend/src/services/policy.service';

import {
  resolveDestinationType,
  calcTripDays,
  checkCombinedCostLimit,
  buildApprovalReasons,
  HOTEL_LIMIT_PER_NIGHT,
  PER_DIEM_RATE,
  normalizeVietnamese,
  type BuildApprovalReasonsInput,
} from '../../src/backend/src/services/policyRules';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Base input hợp lệ hoàn toàn — override từng field trong từng test */
function makeInput(overrides: Partial<PolicyCheckInput> = {}): PolicyCheckInput {
  const monday = nextMonday();
  return {
    jobGrade:        'STAFF',
    destination:     'TP. Hồ Chí Minh',
    estimatedBudget: 2_000_000, // dưới combined limit Staff/TPHCM/3ngày = 3.2M
    tripDays:        3,
    departureDate:   addDays(monday, 14),
    returnDate:      addDays(monday, 16), // 3 ngày
    createdAt:       monday,
    ...overrides,
  };
}

function makeApprovalInput(overrides: Partial<BuildApprovalReasonsInput> = {}): BuildApprovalReasonsInput {
  const monday = nextMonday();
  return {
    isUrgent:        false,
    urgencyReason:   null,
    estimatedBudget: 2_000_000,
    startDate:       addDays(monday, 14),
    endDate:         addDays(monday, 16),
    jobGrade:        'STAFF',
    destination:     'TP. Hồ Chí Minh',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// countWorkingDays (giữ nguyên P-01..P-05)
// ══════════════════════════════════════════════════════════════════════════════

describe('countWorkingDays', () => {
  it('[P-01] đếm đúng 5 ngày làm việc trong 1 tuần (Mon→Sat)', () => {
    const monday   = nextMonday();
    const saturday = addDays(monday, 5);
    expect(countWorkingDays(monday, saturday)).toBe(5);
  });

  it('[P-02] bỏ qua T7 và CN khi tính qua 2 tuần', () => {
    const monday         = nextMonday();
    const twoWeeksLater = addDays(monday, 14);
    expect(countWorkingDays(monday, twoWeeksLater)).toBe(10);
  });

  it('[P-03] from === to → 0', () => {
    const monday = nextMonday();
    expect(countWorkingDays(monday, monday)).toBe(0);
  });

  it('[P-04] from > to → 0', () => {
    const monday  = nextMonday();
    const prevDay = addDays(monday, -1);
    expect(countWorkingDays(monday, prevDay)).toBe(0);
  });

  it('[P-05] chỉ weekend (Sat→Mon) → 0', () => {
    const monday    = nextMonday();
    const saturday  = addDays(monday, -2);
    expect(countWorkingDays(saturday, monday)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════

describe('Constants', () => {
  it('HOTEL_LIMIT_PER_NIGHT STAFF = 1,000,000', () => expect(HOTEL_LIMIT_PER_NIGHT['STAFF']).toBe(1_000_000));
  it('HOTEL_LIMIT_PER_NIGHT MANAGER_GRADE = 1,800,000', () => expect(HOTEL_LIMIT_PER_NIGHT['MANAGER_GRADE']).toBe(1_800_000));
  it('HOTEL_LIMIT_PER_NIGHT DIRECTOR = 3,000,000', () => expect(HOTEL_LIMIT_PER_NIGHT['DIRECTOR']).toBe(3_000_000));
  it('PER_DIEM_RATE TIER1_CITY = 400,000', () => expect(PER_DIEM_RATE['TIER1_CITY']).toBe(400_000));
  it('PER_DIEM_RATE OTHER = 300,000', () => expect(PER_DIEM_RATE['OTHER']).toBe(300_000));
  it('LEVEL2_BUDGET_THRESHOLD = 20,000,000', () => expect(LEVEL2_BUDGET_THRESHOLD).toBe(20_000_000));
  it('MIN_ADVANCE_WORKING_DAYS = 3', () => expect(MIN_ADVANCE_WORKING_DAYS).toBe(3));
});

// ══════════════════════════════════════════════════════════════════════════════
// normalizeVietnamese + resolveDestinationType
// ══════════════════════════════════════════════════════════════════════════════

describe('normalizeVietnamese + resolveDestinationType', () => {
  const TIER1_CASES = [
    'TP. Hồ Chí Minh', 'Hồ Chí Minh', 'tp hcm', 'TPHCM', 'HCM',
    'Sài Gòn', 'saigon', 'hà nội', 'Ha Noi', 'HN', 'hanoi',
    'Đà Nẵng', 'Da Nang', 'danang',
  ];
  const OTHER_CASES = ['Huế', 'Cần Thơ', 'Đắk Lắk', 'Vũng Tàu', 'Nha Trang', 'Buôn Ma Thuột'];

  for (const city of TIER1_CASES) {
    it(`[resolveDestinationType] "${city}" → TIER1_CITY`, () => {
      expect(resolveDestinationType(city)).toBe('TIER1_CITY');
    });
  }

  for (const city of OTHER_CASES) {
    it(`[resolveDestinationType] "${city}" → OTHER`, () => {
      expect(resolveDestinationType(city)).toBe('OTHER');
    });
  }

  it('normalizeVietnamese bỏ dấu đúng', () => {
    expect(normalizeVietnamese('Hồ Chí Minh')).toBe('ho chi minh');
    expect(normalizeVietnamese('Hà Nội')).toBe('ha noi');
    expect(normalizeVietnamese('Đà Nẵng')).toBe('da nang');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// calcTripDays
// ══════════════════════════════════════════════════════════════════════════════

describe('calcTripDays', () => {
  it('3 ngày (dep + 2 ngày) → tripDays=3, hotelNights=2', () => {
    const dep = new Date('2026-10-01T00:00:00.000Z');
    const ret = new Date('2026-10-03T00:00:00.000Z');
    expect(calcTripDays(dep, ret)).toEqual({ tripDays: 3, hotelNights: 2 });
  });

  it('1 ngày (chuyến trong ngày) → tripDays=1, hotelNights=0', () => {
    const dep = new Date('2026-10-01T00:00:00.000Z');
    const ret = new Date('2026-10-01T00:00:00.000Z');
    expect(calcTripDays(dep, ret)).toEqual({ tripDays: 1, hotelNights: 0 });
  });

  it('ngày về < ngày đi → tripDays=0, hotelNights=0', () => {
    const dep = new Date('2026-10-05T00:00:00.000Z');
    const ret = new Date('2026-10-03T00:00:00.000Z');
    expect(calcTripDays(dep, ret)).toEqual({ tripDays: 0, hotelNights: 0 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// checkCombinedCostLimit — BR-TR-08 (ví dụ chuẩn từ prompt §2)
// ══════════════════════════════════════════════════════════════════════════════

describe('checkCombinedCostLimit — BR-TR-08', () => {

  // ví dụ chuẩn: Staff, TP.HCM, 3 ngày → combinedLimit = 2,000,000 + 1,200,000 = 3,200,000
  it('[P-07] Staff/TPHCM/3ngày: plannedBudget 3,300,000 > 3,200,000 → exceeded=true', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'TP. Hồ Chí Minh', plannedBudget: 3_300_000 });
    expect(r.exceeded).toBe(true);
    expect(r.combinedLimit).toBe(3_200_000);
    expect(r.hotelLimitTotal).toBe(2_000_000);
    expect(r.perDiemLimitTotal).toBe(1_200_000);
    expect(r.tripDays).toBe(3);
    expect(r.hotelNights).toBe(2);
    expect(r.destinationType).toBe('TIER1_CITY');
  });

  it('[P-08] Staff/TPHCM/3ngày: plannedBudget 3,200,000 = limit → exceeded=false (boundary)', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'TP. Hồ Chí Minh', plannedBudget: 3_200_000 });
    expect(r.exceeded).toBe(false);
    expect(r.combinedLimit).toBe(3_200_000);
  });

  it('[P-09] Manager/TPHCM/3ngày: hotelLimit=1,800,000×2=3,600,000 + perDiem=1,200,000 = 4,800,000', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'MANAGER_GRADE', destination: 'Hà Nội', plannedBudget: 4_900_000 });
    expect(r.exceeded).toBe(true);
    expect(r.combinedLimit).toBe(4_800_000);
  });

  it('[P-10] Director/OTHER/4ngày: hotelLimit=3,000,000×3=9,000,000 + perDiem=300,000×4=1,200,000 = 10,200,000', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-04T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'DIRECTOR', destination: 'Cần Thơ', plannedBudget: 10_000_000 });
    expect(r.exceeded).toBe(false);
    expect(r.combinedLimit).toBe(10_200_000);
    expect(r.destinationType).toBe('OTHER');
  });

  it('[P-11] Staff/OTHER/1ngày (chuyến trong ngày): hotelNights=0 → combinedLimit=0+300,000=300,000', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-01T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'Huế', plannedBudget: 400_000 });
    expect(r.hotelNights).toBe(0);
    expect(r.tripDays).toBe(1);
    expect(r.combinedLimit).toBe(300_000);
    expect(r.exceeded).toBe(true);
  });

  it('[P-12] ngày về < ngày đi → exceeded=false (dữ liệu lệch, không đánh giá)', () => {
    const dep = new Date('2026-11-05T00:00:00.000Z');
    const ret = new Date('2026-11-01T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'TP. Hồ Chí Minh', plannedBudget: 99_999_999 });
    expect(r.exceeded).toBe(false);
    expect(r.tripDays).toBe(0);
  });

  it('[P-13] alias "HCM" → TIER1_CITY', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'HCM', plannedBudget: 3_300_000 });
    expect(r.destinationType).toBe('TIER1_CITY');
    expect(r.exceeded).toBe(true);
  });

  it('[P-14] alias "Da Nang" → TIER1_CITY', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'Da Nang', plannedBudget: 3_300_000 });
    expect(r.destinationType).toBe('TIER1_CITY');
  });

  it('[P-15] "Huế" → OTHER', () => {
    const dep = new Date('2026-11-01T00:00:00.000Z');
    const ret = new Date('2026-11-03T00:00:00.000Z');
    const r = checkCombinedCostLimit({ startDate: dep, endDate: ret, jobGrade: 'STAFF', destination: 'Huế', plannedBudget: 300_000 });
    expect(r.destinationType).toBe('OTHER');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — Happy Path
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — Happy Path', () => {
  it('[P-06] input hợp lệ hoàn toàn → passed=true, violations=[], requiresLevel2=false', () => {
    const result = runPolicyCheck(makeInput());
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.requiresLevel2Approval).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-03 (Advance Notice)
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-03', () => {
  it('[P-20] < 3 ngày làm việc → URGENT_TRIP_NOTICE, WARNING', () => {
    const monday    = nextMonday();
    const wednesday = addDays(monday, 2); // chỉ 2 WD
    const result = runPolicyCheck(makeInput({
      createdAt:     monday,
      departureDate: wednesday,
      returnDate:    addDays(wednesday, 2),
    }));
    const v = result.violations.find(v => v.code === 'URGENT_TRIP_NOTICE');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('WARNING');
    expect(v?.rule).toBe('BR-TR-03');
  });

  it('[P-21] đúng 3 ngày làm việc → không trigger (boundary)', () => {
    const monday   = nextMonday();
    const thursday = addDays(monday, 3); // 3 WD (Tue, Wed, Thu)
    const result = runPolicyCheck(makeInput({
      createdAt:     monday,
      departureDate: thursday,
      returnDate:    addDays(thursday, 2),
    }));
    expect(result.violations.some(v => v.code === 'URGENT_TRIP_NOTICE')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-04 (Budget Threshold)
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-04', () => {
  it('[P-22] budget 20,000,001 → POLICY_VIOLATION_BUDGET_THRESHOLD', () => {
    const result = runPolicyCheck(makeInput({ estimatedBudget: 20_000_001 }));
    const v = result.violations.find(v => v.code === 'POLICY_VIOLATION_BUDGET_THRESHOLD');
    expect(v).toBeDefined();
    expect(v?.rule).toBe('BR-TR-04');
  });

  it('[P-23] budget 20,000,000 → không trigger (boundary)', () => {
    const result = runPolicyCheck(makeInput({ estimatedBudget: 20_000_000 }));
    expect(result.violations.some(v => v.code === 'POLICY_VIOLATION_BUDGET_THRESHOLD')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runPolicyCheck — BR-TR-08 qua runPolicyCheck
// ══════════════════════════════════════════════════════════════════════════════

describe('runPolicyCheck — BR-TR-08 (via runPolicyCheck)', () => {
  it('[P-24] Staff/TPHCM/3ngày/3,300,000 → COMBINED_COST_LIMIT_EXCEEDED', () => {
    const monday = nextMonday();
    const dep    = addDays(monday, 14);
    const ret    = addDays(dep, 2);
    const result = runPolicyCheck(makeInput({
      jobGrade:        'STAFF',
      destination:     'TP. Hồ Chí Minh',
      estimatedBudget: 3_300_000,
      tripDays:        3,
      departureDate:   dep,
      returnDate:      ret,
    }));
    const v = result.violations.find(v => v.code === 'COMBINED_COST_LIMIT_EXCEEDED');
    expect(v).toBeDefined();
    expect(v?.rule).toBe('BR-TR-08');
    expect(v?.limit).toBe(3_200_000);
    expect(v?.actual).toBe(3_300_000);
    expect(result.requiresLevel2Approval).toBe(true);
  });

  it('[P-25] Staff/TPHCM/3ngày/3,200,000 → không vi phạm (boundary)', () => {
    const monday = nextMonday();
    const dep    = addDays(monday, 14);
    const ret    = addDays(dep, 2);
    const result = runPolicyCheck(makeInput({
      estimatedBudget: 3_200_000,
      departureDate:   dep,
      returnDate:      ret,
    }));
    expect(result.violations.some(v => v.code === 'COMBINED_COST_LIMIT_EXCEEDED')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildApprovalReasons — routing BR-TR-04
// ══════════════════════════════════════════════════════════════════════════════

describe('buildApprovalReasons — routing BR-TR-04', () => {
  const monday = nextMonday();
  const dep    = addDays(monday, 14);
  const ret    = addDays(dep, 2);

  it('[P-26] chỉ khẩn cấp → 2 cấp, lý do URGENT_TRIP', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        true,
      urgencyReason:   'Họp khẩn cấp với đối tác quan trọng',
      estimatedBudget: 2_000_000,
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some(r => r.code === 'URGENT_TRIP')).toBe(true);
  });

  it('[P-27] chỉ ngân sách > 20M → 2 cấp, lý do BUDGET_OVER_THRESHOLD', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 25_000_000,
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons.some(r => r.code === 'BUDGET_OVER_THRESHOLD')).toBe(true);
    expect(reasons.some(r => r.code === 'URGENT_TRIP')).toBe(false);
  });

  it('[P-28] chỉ vượt hạn mức BR-TR-08 (ngân sách ≤ 20M, không khẩn cấp) → 2 cấp, COMBINED_COST_LIMIT_EXCEEDED', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 3_300_000, // > 3,200,000 limit Staff/TPHCM/3ngày
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons.some(r => r.code === 'COMBINED_COST_LIMIT_EXCEEDED')).toBe(true);
    expect(reasons.some(r => r.code === 'BUDGET_OVER_THRESHOLD')).toBe(false);
  });

  it('[P-29] cả 3 điều kiện cùng lúc → 2 cấp, 3 lý do', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        true,
      urgencyReason:   'Khẩn cấp cần xử lý ngay hôm nay',
      estimatedBudget: 25_000_000,
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons.length).toBe(3);
    expect(reasons.some(r => r.code === 'URGENT_TRIP')).toBe(true);
    expect(reasons.some(r => r.code === 'BUDGET_OVER_THRESHOLD')).toBe(true);
    expect(reasons.some(r => r.code === 'COMBINED_COST_LIMIT_EXCEEDED')).toBe(true);
  });

  it('[P-30] không dính điều kiện nào → 1 cấp, mảng rỗng', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 2_000_000, // dưới limit
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons).toHaveLength(0);
  });

  it('[P-31] mỗi ApprovalReason có đủ fields: code, title, detail, data', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 3_300_000,
      startDate:       dep,
      endDate:         ret,
    }));
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) {
      expect(r).toHaveProperty('code');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('detail');
      expect(r).toHaveProperty('data');
      expect(r.detail.length).toBeGreaterThan(0);
    }
  });

  it('[P-32] COMBINED_COST_LIMIT_EXCEEDED detail chứa số tiền VNĐ cụ thể', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 3_300_000,
      startDate:       dep,
      endDate:         ret,
    }));
    const r = reasons.find(r => r.code === 'COMBINED_COST_LIMIT_EXCEEDED');
    expect(r?.detail).toContain('3.300.000');
    expect(r?.detail).toContain('3.200.000');
  });

  it('[P-33] requiresLevel2 = reasons.length > 0 (nguồn sự thật duy nhất)', () => {
    const reasons = buildApprovalReasons(makeApprovalInput({
      isUrgent:        false,
      estimatedBudget: 2_000_000,
      startDate:       dep,
      endDate:         ret,
    }));
    const requiresLevel2 = reasons.length > 0;
    expect(requiresLevel2).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// requiresLevel2FromViolations
// ══════════════════════════════════════════════════════════════════════════════

describe('requiresLevel2FromViolations', () => {
  it('[P-34] URGENT_TRIP_NOTICE → true', () => {
    expect(requiresLevel2FromViolations([{ code: 'URGENT_TRIP_NOTICE', severity: 'WARNING' }])).toBe(true);
  });

  it('[P-35] POLICY_VIOLATION_BUDGET_THRESHOLD → true', () => {
    expect(requiresLevel2FromViolations([{ code: 'POLICY_VIOLATION_BUDGET_THRESHOLD', severity: 'WARNING' }])).toBe(true);
  });

  it('[P-36] COMBINED_COST_LIMIT_EXCEEDED → true', () => {
    expect(requiresLevel2FromViolations([{ code: 'COMBINED_COST_LIMIT_EXCEEDED', severity: 'WARNING' }])).toBe(true);
  });

  it('[P-37] violation INFO severity → false (bị lọc ra)', () => {
    expect(requiresLevel2FromViolations([{ code: 'URGENT_TRIP_NOTICE', severity: 'INFO' }])).toBe(false);
  });

  it('[P-38] mảng rỗng → false', () => {
    expect(requiresLevel2FromViolations([])).toBe(false);
  });
});
