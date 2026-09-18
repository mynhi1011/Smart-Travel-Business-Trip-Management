/**
 * PolicyBanner.test.tsx — Component Tests: PolicyBanner
 *
 * Kiểm thử render logic của PolicyBanner component.
 *
 * Test matrix:
 *   R-01: [RENDER] violations rỗng → không render gì (null)
 *   R-02: [RENDER] 1 violation error → render với label "Vi phạm"
 *   R-03: [RENDER] 1 violation warning → render với label "Lưu ý"
 *   R-04: [RENDER] nhiều violations → render tất cả
 *   R-05: [BIZ]    OVER_20M violation → message chứa text budget
 *   R-06: [A11Y]   region/alert roles đúng để screen reader announce
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PolicyBanner, type PolicyViolation } from '../components/PolicyBanner';

// ══════════════════════════════════════════════════════════════════════════════
// PolicyBanner — Component Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('PolicyBanner component', () => {

  // ── R-01: Không render khi violations rỗng ─────────────────────────────────
  describe('[RENDER] R-01 — violations rỗng', () => {

    it('violations=[] → không render gì vào DOM', () => {
      const { container } = render(<PolicyBanner violations={[]} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('violations=[] → không có policy-banner trong DOM', () => {
      render(<PolicyBanner violations={[]} />);
      expect(screen.queryByTestId('policy-banner')).not.toBeInTheDocument();
    });

  });

  // ── R-02: Violation level error ────────────────────────────────────────────
  describe('[RENDER] R-02 — violation level "error" (BLOCKER)', () => {

    const errorViolation: PolicyViolation = {
      level: 'error',
      code: 'OVER_20M',
      message: 'Ngân sách 25,000,000đ vượt ngưỡng 20,000,000đ — bắt buộc phê duyệt Travel Admin',
    };

    it('render violation error → banner và violation item hiển thị', () => {
      render(<PolicyBanner violations={[errorViolation]} />);

      expect(screen.getByTestId('policy-banner')).toBeInTheDocument();
      expect(screen.getByTestId('violation-OVER_20M')).toBeInTheDocument();
    });

    it('violation error → label hiển thị "Vi phạm" (không phải "Lưu ý")', () => {
      render(<PolicyBanner violations={[errorViolation]} />);

      const label = screen.getByTestId('violation-label-OVER_20M');
      expect(label).toHaveTextContent('Vi phạm');
      expect(label).not.toHaveTextContent('Lưu ý');
    });

    it('violation error → message hiển thị đầy đủ', () => {
      render(<PolicyBanner violations={[errorViolation]} />);

      const message = screen.getByTestId('violation-message-OVER_20M');
      expect(message).toHaveTextContent('vượt ngưỡng 20,000,000đ');
    });

  });

  // ── R-03: Violation level warning ─────────────────────────────────────────
  describe('[RENDER] R-03 — violation level "warning"', () => {

    const warningViolation: PolicyViolation = {
      level: 'warning',
      code: 'SHORT_NOTICE',
      message: 'Thời gian nộp khá sát (4 ngày làm việc) — khuyến nghị nộp trước 5 ngày',
    };

    it('violation warning → label hiển thị "Lưu ý" (không phải "Vi phạm")', () => {
      render(<PolicyBanner violations={[warningViolation]} />);

      const label = screen.getByTestId('violation-label-SHORT_NOTICE');
      expect(label).toHaveTextContent('Lưu ý');
      expect(label).not.toHaveTextContent('Vi phạm');
    });

    it('violation warning → message hiển thị', () => {
      render(<PolicyBanner violations={[warningViolation]} />);

      expect(screen.getByTestId('violation-message-SHORT_NOTICE'))
        .toHaveTextContent('5 ngày');
    });

  });

  // ── R-04: Nhiều violations ─────────────────────────────────────────────────
  describe('[RENDER] R-04 — nhiều violations', () => {

    const multipleViolations: PolicyViolation[] = [
      { level: 'error',   code: 'OVER_20M',     message: 'Budget vượt ngưỡng 20M' },
      { level: 'warning', code: 'SHORT_NOTICE',  message: 'Thời gian nộp sát' },
      { level: 'warning', code: 'PER_DIEM_NOTE', message: 'Hạn mức phụ cấp tối đa' },
    ];

    it('3 violations → render đủ 3 item', () => {
      render(<PolicyBanner violations={multipleViolations} />);

      expect(screen.getByTestId('violation-OVER_20M')).toBeInTheDocument();
      expect(screen.getByTestId('violation-SHORT_NOTICE')).toBeInTheDocument();
      expect(screen.getByTestId('violation-PER_DIEM_NOTE')).toBeInTheDocument();
    });

    it('3 violations → có đúng 1 "Vi phạm" và 2 "Lưu ý"', () => {
      render(<PolicyBanner violations={multipleViolations} />);

      const violationLabels = screen.getAllByText('Vi phạm');
      const warningLabels = screen.getAllByText('Lưu ý');

      expect(violationLabels).toHaveLength(1);
      expect(warningLabels).toHaveLength(2);
    });

  });

  // ── R-05: Business Rule — OVER_20M ────────────────────────────────────────
  describe('[BIZ] R-05 — OVER_20M policy violation', () => {

    it('OVER_20M violation message chứa thông tin budget — user hiểu được', () => {
      const violation: PolicyViolation = {
        level: 'error',
        code: 'OVER_20M',
        message: 'Ngân sách 25,000,000đ vượt ngưỡng 20,000,000đ — bắt buộc phê duyệt Travel Admin',
      };

      render(<PolicyBanner violations={[violation]} />);

      const message = screen.getByTestId('violation-message-OVER_20M');
      // Message phải đề cập đến số tiền cụ thể
      expect(message.textContent).toMatch(/20,000,000/);
      // Message phải đề cập đến hành động cần thực hiện
      expect(message.textContent).toMatch(/Travel Admin/);
    });

  });

  // ── R-06: Accessibility ───────────────────────────────────────────────────
  describe('[A11Y] R-06 — accessibility roles', () => {

    it('banner có role="region" với aria-label để screen reader navigate', () => {
      const violations: PolicyViolation[] = [
        { level: 'error', code: 'OVER_20M', message: 'Budget vượt ngưỡng' },
      ];

      render(<PolicyBanner violations={violations} />);

      // role="region" + aria-label để hỗ trợ screen reader
      expect(screen.getByRole('region', { name: 'Cảnh báo chính sách' })).toBeInTheDocument();
    });

    it('mỗi violation item có role="alert" để screen reader announce', () => {
      const violations: PolicyViolation[] = [
        { level: 'error',   code: 'V1', message: 'Violation 1' },
        { level: 'warning', code: 'V2', message: 'Warning 2' },
      ];

      render(<PolicyBanner violations={violations} />);

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
    });

    it('violations hiển thị với aria-live="polite" — không interrupt user', () => {
      const violations: PolicyViolation[] = [
        { level: 'warning', code: 'W1', message: 'Warning message' },
      ];

      render(<PolicyBanner violations={violations} />);

      const alert = screen.getByTestId('violation-W1');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

  });

  // ── Mixed: single violation của mỗi loại ──────────────────────────────────
  describe('[RENDER] mixed single violations', () => {

    it.each([
      ['error',   'LATE_SUBMISSION', 'Nộp muộn — 0 ngày làm việc còn lại',  'Vi phạm'],
      ['warning', 'HIGH_BUDGET',     'Ngân sách cao >15M — vui lòng tối ưu', 'Lưu ý'],
    ] as const)(
      'violation level="%s" code="%s" → label "%s"',
      (level, code, message, expectedLabel) => {
        render(<PolicyBanner violations={[{ level, code, message }]} />);

        expect(screen.getByTestId(`violation-label-${code}`))
          .toHaveTextContent(expectedLabel);
        expect(screen.getByTestId(`violation-message-${code}`))
          .toHaveTextContent(message);
      }
    );

  });

});
