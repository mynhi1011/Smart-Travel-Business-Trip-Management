/**
 * TripRequestForm.test.tsx — Component Tests: TripRequestForm
 *
 * Kiểm thử toàn diện form tạo chuyến công tác với RTL + userEvent.
 *
 * Test matrix (bám theo test-strategy.md §7.5):
 *   F-01: [HAPPY]  Submit form hợp lệ → onSubmit gọi với đúng payload
 *   F-02: [FAIL]   Submit thiếu destination → error "Vui lòng nhập điểm đến"
 *   F-03: [FAIL]   Submit thiếu origin → error hiển thị
 *   F-04: [FAIL]   ReturnDate trước departureDate → date range error
 *   F-05: [FAIL]   estimatedBudget <= 0 → error (boundary)
 *   F-06: [FAIL]   purpose < 10 ký tự → error
 *   F-07: [RENDER] Render không crash — đủ elements
 *   F-08: [STATE]  isLoading=true → button disabled
 *   F-09: [STATE]  apiError prop → API error hiển thị
 *   F-10: [BIZ]    Submit không gọi service khi validation fail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripRequestForm } from '../components/TripRequestForm';

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Điền form đầy đủ hợp lệ */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Điểm xuất phát'), 'Hà Nội');
  await user.type(screen.getByLabelText('Điểm đến'), 'TP. Hồ Chí Minh');
  await user.selectOptions(
    screen.getByLabelText('Loại điểm đến'),
    'TIER1_CITY'
  );
  await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
  await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
  await user.type(
    screen.getByLabelText('Mục đích công tác'),
    'Tham dự hội nghị khách hàng khu vực phía Nam năm 2099'
  );
  await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '8000000');
}

// ══════════════════════════════════════════════════════════════════════════════
// TripRequestForm — Component Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('TripRequestForm component', () => {

  // ── F-07: Render smoke test ────────────────────────────────────────────────
  describe('[RENDER] smoke test', () => {

    it('render không crash — form và tất cả required inputs hiện diện', () => {
      render(<TripRequestForm onSubmit={vi.fn()} />);

      expect(screen.getByRole('form', { name: 'Tạo chuyến công tác' })).toBeInTheDocument();
      expect(screen.getByLabelText('Điểm xuất phát')).toBeInTheDocument();
      expect(screen.getByLabelText('Điểm đến')).toBeInTheDocument();
      expect(screen.getByLabelText('Loại điểm đến')).toBeInTheDocument();
      expect(screen.getByLabelText('Ngày khởi hành')).toBeInTheDocument();
      expect(screen.getByLabelText('Ngày về')).toBeInTheDocument();
      expect(screen.getByLabelText('Mục đích công tác')).toBeInTheDocument();
      expect(screen.getByLabelText('Tổng dự toán (VNĐ)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tạo chuyến đi' })).toBeInTheDocument();
    });

    it('mặc định không có error nào khi chưa submit', () => {
      render(<TripRequestForm onSubmit={vi.fn()} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

  });

  // ── F-01: Happy Path ───────────────────────────────────────────────────────
  describe('[HAPPY] F-01 — submit form hợp lệ', () => {

    it('onSubmit được gọi 1 lần với đúng payload', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      expect(mockSubmit).toHaveBeenCalledOnce();
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'Hà Nội',
          destination: 'TP. Hồ Chí Minh',
          destinationType: 'TIER1_CITY',
          departureDate: '2099-06-01',
          returnDate: '2099-06-05',
          estimatedBudget: 8_000_000,
        })
      );
    });

    it('submit hợp lệ → không có error message trong DOM', async () => {
      const user = userEvent.setup({ delay: null });
      render(<TripRequestForm onSubmit={vi.fn()} />);

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

  });

  // ── F-02: Validation — thiếu destination ─────────────────────────────────
  describe('[FAIL] F-02 — thiếu destination', () => {

    it('submit thiếu destination → error "Vui lòng nhập điểm đến" hiển thị', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      // Điền tất cả trừ destination
      await user.type(screen.getByLabelText('Điểm xuất phát'), 'Hà Nội');
      // KHÔNG điền destination
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'TIER1_CITY');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Tham dự hội nghị khách hàng phía Nam');
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '8000000');
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      // Assert: error message xuất hiện trong DOM
      const destError = screen.getByTestId('destination-error');
      expect(destError).toBeInTheDocument();
      expect(destError).toHaveTextContent('Vui lòng nhập điểm đến');

      // Assert: onSubmit KHÔNG được gọi
      expect(mockSubmit).not.toHaveBeenCalled();
    });

  });

  // ── F-03: Validation — thiếu origin ──────────────────────────────────────
  describe('[FAIL] F-03 — thiếu origin', () => {

    it('submit thiếu origin → error hiển thị, onSubmit không được gọi', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      // Bỏ qua origin, điền các field khác
      await user.type(screen.getByLabelText('Điểm đến'), 'TP. HCM');
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'TIER1_CITY');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Họp đối tác quan trọng tại HCM');
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '5000000');
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      expect(screen.getByTestId('origin-error')).toBeInTheDocument();
      expect(mockSubmit).not.toHaveBeenCalled();
    });

  });

  // ── F-04: Validation — date range không hợp lệ ───────────────────────────
  describe('[FAIL] F-04 — returnDate trước departureDate', () => {

    it('returnDate < departureDate → date range error hiển thị', async () => {
      const user = userEvent.setup({ delay: null });
      render(<TripRequestForm onSubmit={vi.fn()} />);

      await user.type(screen.getByLabelText('Điểm xuất phát'), 'Hà Nội');
      await user.type(screen.getByLabelText('Điểm đến'), 'Đà Nẵng');
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'OTHER');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-10');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05'); // TRƯỚC ngày đi
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Gặp gỡ đối tác tại Đà Nẵng');
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '5000000');
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      // Assert: error tại returnDate field
      const returnError = screen.getByTestId('return-date-error');
      expect(returnError).toBeInTheDocument();
      expect(returnError).toHaveTextContent(/sau hoặc bằng/i);
    });

  });

  // ── F-05: Validation — budget boundary ───────────────────────────────────
  describe('[FAIL] F-05 — estimatedBudget boundary value', () => {

    it('estimatedBudget = 0 → error "phải lớn hơn 0"', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      await user.type(screen.getByLabelText('Điểm xuất phát'), 'Hà Nội');
      await user.type(screen.getByLabelText('Điểm đến'), 'HCM');
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'TIER1_CITY');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Tham dự sự kiện quan trọng');
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '0'); // boundary: 0

      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      const budgetError = screen.getByTestId('budget-error');
      expect(budgetError).toBeInTheDocument();
      expect(budgetError).toHaveTextContent(/lớn hơn 0/i);
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('estimatedBudget = 1 → PASS validation (minimum valid)', async () => {
      // Dùng userEvent.setup({ delay: null }) để tắt typing delay — tránh timeout
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      await user.type(screen.getByLabelText('Điểm xuất phát'), 'HN');
      await user.type(screen.getByLabelText('Điểm đến'), 'HCM');
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'TIER1_CITY');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Test boundary minimal');
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '1'); // minimum valid

      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      expect(screen.queryByTestId('budget-error')).not.toBeInTheDocument();
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ estimatedBudget: 1 }));
    });

  });

  // ── F-06: Validation — purpose quá ngắn ──────────────────────────────────
  describe('[FAIL] F-06 — purpose < 10 ký tự', () => {

    it('purpose 5 ký tự → error "tối thiểu 10 ký tự"', async () => {
      const user = userEvent.setup({ delay: null });
      render(<TripRequestForm onSubmit={vi.fn()} />);

      await user.type(screen.getByLabelText('Điểm xuất phát'), 'HN');
      await user.type(screen.getByLabelText('Điểm đến'), 'HCM');
      await user.selectOptions(screen.getByLabelText('Loại điểm đến'), 'TIER1_CITY');
      await user.type(screen.getByLabelText('Ngày khởi hành'), '2099-06-01');
      await user.type(screen.getByLabelText('Ngày về'), '2099-06-05');
      await user.type(screen.getByLabelText('Mục đích công tác'), 'Ngắn'); // chỉ 4 ký tự
      await user.type(screen.getByLabelText('Tổng dự toán (VNĐ)'), '5000000');
      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      const purposeError = screen.getByTestId('purpose-error');
      expect(purposeError).toBeInTheDocument();
      expect(purposeError).toHaveTextContent('tối thiểu 10 ký tự');
    });

  });

  // ── F-08: Loading State ───────────────────────────────────────────────────
  describe('[STATE] F-08 — isLoading prop', () => {

    it('isLoading=true → button disabled + text "Đang gửi..."', () => {
      render(<TripRequestForm onSubmit={vi.fn()} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Đang gửi...');
    });

    it('isLoading=true → tất cả inputs bị disabled', () => {
      render(<TripRequestForm onSubmit={vi.fn()} isLoading={true} />);

      expect(screen.getByLabelText('Điểm xuất phát')).toBeDisabled();
      expect(screen.getByLabelText('Điểm đến')).toBeDisabled();
      expect(screen.getByLabelText('Ngày khởi hành')).toBeDisabled();
      expect(screen.getByLabelText('Ngày về')).toBeDisabled();
    });

  });

  // ── F-09: API Error ────────────────────────────────────────────────────────
  describe('[STATE] F-09 — apiError prop', () => {

    it('apiError="Dữ liệu không hợp lệ" → hiển thị trong DOM với role="alert"', () => {
      render(<TripRequestForm onSubmit={vi.fn()} apiError="Dữ liệu không hợp lệ" />);

      const apiError = screen.getByTestId('api-error');
      expect(apiError).toBeInTheDocument();
      expect(apiError).toHaveRole('alert');
      expect(apiError).toHaveTextContent('Dữ liệu không hợp lệ');
    });

    it('apiError=null → api-error element không render', () => {
      render(<TripRequestForm onSubmit={vi.fn()} apiError={null} />);
      expect(screen.queryByTestId('api-error')).not.toBeInTheDocument();
    });

  });

  // ── F-10: Submit không gọi service khi validation fail (BIZ rule) ─────────
  describe('[BIZ] F-10 — onSubmit không được gọi khi validation fail', () => {

    it('submit form hoàn toàn rỗng → onSubmit không được gọi', async () => {
      const user = userEvent.setup({ delay: null });
      const mockSubmit = vi.fn();
      render(<TripRequestForm onSubmit={mockSubmit} />);

      await user.click(screen.getByRole('button', { name: 'Tạo chuyến đi' }));

      expect(mockSubmit).not.toHaveBeenCalled();

      // Phải có ít nhất 1 alert (nhiều field fail)
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });

  });

});
