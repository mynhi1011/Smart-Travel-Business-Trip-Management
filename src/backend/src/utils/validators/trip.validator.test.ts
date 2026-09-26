/**
 * trip.validator.test.ts — Unit Tests: createTripSchema (Zod) + checkPerDiemWarning
 *
 * Kiểm thử toàn diện Zod schema validation trong isolation — không cần Express/DB.
 * Mọi field đều được test: required, type, boundary value, cross-field constraint.
 *
 * Test matrix:
 *   HAPPY: Payload đầy đủ hợp lệ → parse thành công
 *   FAIL/REQUIRED: Thiếu từng required field → fieldErrors đúng
 *   FAIL/TYPE: Sai kiểu dữ liệu → VALIDATION_ERROR
 *   FAIL/BOUNDARY: Giá trị âm, bằng 0, quá dài → lỗi đúng
 *   FAIL/CROSS: returnDate < departureDate, departureDate trong quá khứ
 *   BIZ: checkPerDiemWarning — vượt/đúng/không có hạn mức
 */

import { describe, it, expect } from 'vitest';
import { createTripSchema, checkPerDiemWarning, PER_DIEM_RATE } from './trip.validator';

// ─── Helper: ngày trong tương lai xa ──────────────────────────────────────────
// Dùng năm 2099 để tránh flaky test khi chạy vào ngày gần deadline
const FUTURE_DATE = '2099-06-01';
const FUTURE_DATE_LATER = '2099-06-05'; // sau FUTURE_DATE
const PAST_DATE = '2020-01-01'; // chắc chắn trong quá khứ

/** Base payload hợp lệ — test failures sẽ override field cần test */
const VALID_PAYLOAD = {
  origin: 'Hà Nội',
  destination: 'TP. Hồ Chí Minh',
  departureDate: FUTURE_DATE,
  returnDate: FUTURE_DATE_LATER,
  purpose: 'Tham dự hội nghị khách hàng khu vực phía Nam năm 2099',
  estimatedBudget: 8_000_000,
};

// ══════════════════════════════════════════════════════════════════════════════
// createTripSchema
// ══════════════════════════════════════════════════════════════════════════════

describe('createTripSchema', () => {

  // ── Happy Path ─────────────────────────────────────────────────────────────
  describe('[HAPPY] payload hợp lệ', () => {

    it('parse thành công với payload đầy đủ — trả về object đúng type', () => {
      const result = createTripSchema.safeParse(VALID_PAYLOAD);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Assert field values đúng sau parse
      expect(result.data.origin).toBe('Hà Nội');
      expect(result.data.destination).toBe('TP. Hồ Chí Minh');
      expect(result.data.estimatedBudget).toBe(8_000_000);
    });

    it('parse thành công với payload tối thiểu (chỉ required fields)', () => {
      const minPayload = {
        origin: 'Hà Nội',
        destination: 'Đà Nẵng',
        departureDate: FUTURE_DATE,
        returnDate: FUTURE_DATE_LATER,
        purpose: 'Thăm khách hàng tại Đà Nẵng để thảo luận dự án',
        estimatedBudget: 5_000_000,
      };

      const result = createTripSchema.safeParse(minPayload);
      expect(result.success).toBe(true);
    });

    it('trim whitespace: origin/destination/purpose với spaces thừa vẫn parse OK', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        origin: '  Hà Nội  ',       // spaces thừa
        destination: '  TP. HCM  ',
        purpose: '  ' + VALID_PAYLOAD.purpose + '  ',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      // Zod .trim() phải strip spaces
      expect(result.data.origin).toBe('Hà Nội');
      expect(result.data.destination).toBe('TP. HCM');
    });

    it('departureDate = returnDate (đi về trong ngày) — hợp lệ', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        departureDate: FUTURE_DATE,
        returnDate: FUTURE_DATE, // same day — hợp lệ (>= không phải >)
      });
      expect(result.success).toBe(true);
    });

  });

  // ── Validation — Required Fields ──────────────────────────────────────────
  describe('[FAIL] required field bị thiếu', () => {

    it.each([
      ['origin',         { ...VALID_PAYLOAD, origin: undefined }],
      ['destination',    { ...VALID_PAYLOAD, destination: undefined }],
      ['departureDate',  { ...VALID_PAYLOAD, departureDate: undefined }],
      ['returnDate',     { ...VALID_PAYLOAD, returnDate: undefined }],
      ['purpose',        { ...VALID_PAYLOAD, purpose: undefined }],
      ['estimatedBudget',{ ...VALID_PAYLOAD, estimatedBudget: undefined }],
    ] as const)('thiếu "%s" → parse fail với fieldErrors tại field đó', (fieldName, payload) => {
      const result = createTripSchema.safeParse(payload);

      expect(result.success).toBe(false);
      if (result.success) return;

      // Assert: lỗi xuất hiện tại đúng field (fieldErrors)
      const flat = result.error.flatten();
      const allErrors = {
        ...flat.fieldErrors,
        ...flat.formErrors,
      };
      const errorKeys = Object.keys(flat.fieldErrors);
      // field bị thiếu phải xuất hiện trong fieldErrors
      expect(errorKeys).toContain(fieldName);
    });

  });

  // ── Validation — Type Checking ─────────────────────────────────────────────
  describe('[FAIL] sai kiểu dữ liệu', () => {

    it('estimatedBudget là string → parse fail (invalid_type)', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        estimatedBudget: '8000000', // string thay vì number
      });
      expect(result.success).toBe(false);
    });

    it('destinationType là field legacy → bị strip theo D-16', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        destinationType: 'INVALID_TYPE', // không phải TIER1_CITY hoặc OTHER
      });
      expect(result.success).toBe(true);
    });

    it('departureDate sai format (DD/MM/YYYY thay vì YYYY-MM-DD) → parse fail', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        departureDate: '01/06/2099', // format sai
      });
      expect(result.success).toBe(false);
    });

  });

  // ── Validation — Boundary Values ──────────────────────────────────────────
  describe('[FAIL] boundary value', () => {

    it('estimatedBudget = 0 → parse fail (phải positive)', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        estimatedBudget: 0,
      });
      expect(result.success).toBe(false);
    });

    it('estimatedBudget = -1 → parse fail (phải positive)', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        estimatedBudget: -1,
      });
      expect(result.success).toBe(false);
    });

    it('estimatedBudget = 1 → parse success (minimum valid positive integer)', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        estimatedBudget: 1,
      });
      expect(result.success).toBe(true);
    });

    it('origin quá dài (201 chars) → parse fail', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        origin: 'A'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('origin đúng 200 chars → parse success', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        origin: 'A'.repeat(200),
      });
      expect(result.success).toBe(true);
    });

    it('purpose ít hơn 10 ký tự → parse fail', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        purpose: 'Ngắn',  // 4 ký tự — dưới tối thiểu 10
      });
      expect(result.success).toBe(false);
    });

    it('purpose đúng 10 ký tự → parse success', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        purpose: '1234567890', // đúng 10 ký tự
      });
      expect(result.success).toBe(true);
    });

    it('hotelCostPerNight legacy không còn thuộc request contract', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        hotelCostPerNight: -100,
      });
      expect(result.success).toBe(true);
    });

    it('perDiemBudget = 0 → parse success (optional, 0 hợp lệ)', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        perDiemBudget: 0,
      });
      expect(result.success).toBe(true);
    });

  });

  // ── Validation — Cross-field (superRefine) ────────────────────────────────
  describe('[FAIL] cross-field validation', () => {

    it('returnDate trước departureDate → parse fail với lỗi tại returnDate', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        departureDate: '2099-06-10',
        returnDate:    '2099-06-05', // TRƯỚC departureDate
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      const flat = result.error.flatten();
      // Lỗi phải tại field returnDate
      expect(flat.fieldErrors['returnDate']).toBeDefined();
      expect(flat.fieldErrors['returnDate']?.[0]).toMatch(/ngày về|sau hoặc bằng/i);
    });

    it('departureDate trong quá khứ → parse fail', () => {
      const result = createTripSchema.safeParse({
        ...VALID_PAYLOAD,
        departureDate: PAST_DATE,
        returnDate: PAST_DATE,
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      const flat = result.error.flatten();
      expect(flat.fieldErrors['departureDate']).toBeDefined();
    });

  });

});

// ══════════════════════════════════════════════════════════════════════════════
// checkPerDiemWarning — BR-TR-02: soft validation
// ══════════════════════════════════════════════════════════════════════════════

describe('checkPerDiemWarning', () => {

  it('[HAPPY] perDiemBudget đúng hạn mức TIER1_CITY → trả về null (không cảnh báo)', () => {
    // 4 ngày × 400k = 1,600,000 — đúng bằng hạn mức
    const result = checkPerDiemWarning(1_600_000, 'TIER1_CITY', 4);
    expect(result).toBeNull();
  });

  it('[HAPPY] perDiemBudget dưới hạn mức → trả về null', () => {
    // 3 ngày × 400k = 1,200,000 — dưới hạn mức 1,200,000
    const result = checkPerDiemWarning(900_000, 'TIER1_CITY', 3);
    expect(result).toBeNull();
  });

  it('[D-16] perDiemBudget không còn tạo warning riêng', () => {
    // Hạn mức: 4 ngày × 400k = 1,600,000 — gửi 2,000,000
    const result = checkPerDiemWarning(2_000_000, 'TIER1_CITY', 4);

    expect(result).toBeNull();
  });

  it('[D-16] perDiemBudget OTHER không còn tạo warning riêng', () => {
    // OTHER: 300k/ngày × 5 ngày = 1,500,000 — gửi 2,000,000
    const result = checkPerDiemWarning(2_000_000, 'OTHER', 5);

    expect(result).toBeNull();
  });

  it('[EDGE] perDiemBudget = undefined → trả về null (không kiểm tra)', () => {
    const result = checkPerDiemWarning(undefined, 'TIER1_CITY', 4);
    expect(result).toBeNull();
  });

  it('[EDGE] perDiemBudget = 0 → trả về null (không kiểm tra)', () => {
    const result = checkPerDiemWarning(0, 'TIER1_CITY', 4);
    expect(result).toBeNull();
  });

  it('[D-16] tripDays = 0 không tạo per-diem warning riêng', () => {
    const result = checkPerDiemWarning(1, 'TIER1_CITY', 0);
    expect(result).toBeNull();
  });

  it('[CONST] PER_DIEM_RATE TIER1_CITY = 400,000 VNĐ/ngày theo BR-TR-02', () => {
    expect(PER_DIEM_RATE['TIER1_CITY']).toBe(400_000);
  });

  it('[CONST] PER_DIEM_RATE OTHER = 300,000 VNĐ/ngày theo BR-TR-02', () => {
    expect(PER_DIEM_RATE['OTHER']).toBe(300_000);
  });

});
