/**
 * LoginForm.test.tsx — Component Tests: LoginForm
 *
 * Kiểm thử LoginForm component với React Testing Library.
 * Tất cả API calls bị mock — test chỉ kiểm tra component behavior.
 *
 * Test matrix:
 *   F-RENDER: Render không crash, đủ các elements
 *   F-HAPPY:  Submit form hợp lệ → onSubmit được gọi với đúng args
 *   F-FAIL:   Submit thiếu email → error message hiển thị
 *   F-FAIL:   Submit thiếu password → error message hiển thị
 *   F-FAIL:   Email sai format → error message hiển thị
 *   F-FAIL:   Password < 8 ký tự → error message hiển thị
 *   F-STATE:  isLoading=true → button disabled + text thay đổi
 *   F-STATE:  apiError prop → error message từ API hiển thị
 *   F-CLEAR:  Submit hợp lệ sau khi đã có validation error → errors bị xóa
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../components/LoginForm';

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const VALID_EMAIL = 'test@smarttravel.vn';
const VALID_PASSWORD = 'Password123!';

// ══════════════════════════════════════════════════════════════════════════════
// LoginForm — Component Tests
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginForm component', () => {

  // ── Render Tests ────────────────────────────────────────────────────────────
  describe('[RENDER] smoke tests', () => {

    it('render không crash — các element bắt buộc hiện diện', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      // Assert: form có aria-label (accessibility)
      expect(screen.getByRole('form', { name: 'Đăng nhập' })).toBeInTheDocument();

      // Assert: email input (getByLabelText — tốt hơn getByTestId)
      expect(screen.getByLabelText('Email')).toBeInTheDocument();

      // Assert: password input
      expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();

      // Assert: submit button
      expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
    });

    it('mặc định: không có error message nào khi chưa submit', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      // Assert: không có alert nào khi form chưa được touch
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('mặc định: input email và password rỗng', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      expect(screen.getByLabelText('Email')).toHaveValue('');
      expect(screen.getByLabelText('Mật khẩu')).toHaveValue('');
    });

  });

  // ── Happy Path ─────────────────────────────────────────────────────────────
  describe('[HAPPY] submit form hợp lệ', () => {

    it('submit với email và password hợp lệ → onSubmit được gọi với đúng arguments', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();

      render(<LoginForm onSubmit={mockSubmit} />);

      // Act: type email
      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      // Act: type password
      await user.type(screen.getByLabelText('Mật khẩu'), VALID_PASSWORD);
      // Act: click submit
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: onSubmit được gọi 1 lần với đúng email + password
      expect(mockSubmit).toHaveBeenCalledOnce();
      expect(mockSubmit).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD);
    });

    it('submit hợp lệ → không có validation error message nào trong DOM', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={vi.fn()} />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Mật khẩu'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: không có alert sau khi submit hợp lệ
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

  });

  // ── Failure Path — Client Validation ─────────────────────────────────────
  describe('[FAIL] client-side validation errors', () => {

    it('submit form rỗng → hiển thị cả 2 error messages (email + password)', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();

      render(<LoginForm onSubmit={mockSubmit} />);

      // Act: submit không điền gì
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: error email hiển thị
      expect(screen.getByTestId('email-error')).toBeInTheDocument();
      expect(screen.getByTestId('email-error')).toHaveTextContent('không được để trống');

      // Assert: error password hiển thị
      expect(screen.getByTestId('password-error')).toBeInTheDocument();
      expect(screen.getByTestId('password-error')).toHaveTextContent('không được để trống');

      // Assert: onSubmit KHÔNG được gọi khi validation fail
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('email sai format → hiển thị "Email không hợp lệ"', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={vi.fn()} />);

      await user.type(screen.getByLabelText('Email'), 'not-a-valid-email');
      await user.type(screen.getByLabelText('Mật khẩu'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: email error hiển thị đúng message
      const emailError = screen.getByTestId('email-error');
      expect(emailError).toBeInTheDocument();
      expect(emailError).toHaveTextContent('Email không hợp lệ');
    });

    it('password < 8 ký tự → hiển thị error "tối thiểu 8 ký tự"', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={vi.fn()} />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Mật khẩu'), '1234567'); // 7 ký tự — dưới tối thiểu
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      const pwdError = screen.getByTestId('password-error');
      expect(pwdError).toBeInTheDocument();
      expect(pwdError).toHaveTextContent('tối thiểu 8 ký tự');
    });

    it('password đúng 8 ký tự → PASS validation (boundary value)', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Mật khẩu'), '12345678'); // đúng 8 ký tự
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Không có password error
      expect(screen.queryByTestId('password-error')).not.toBeInTheDocument();
      // onSubmit được gọi
      expect(mockSubmit).toHaveBeenCalledOnce();
    });

    it('email input có aria-invalid=true khi có error', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: aria-invalid phải set để screen reader announce error
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

  });

  // ── Loading State ──────────────────────────────────────────────────────────
  describe('[STATE] isLoading prop', () => {

    it('isLoading=true → button disabled và hiển thị text "Đang đăng nhập..."', () => {
      render(<LoginForm onSubmit={vi.fn()} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Đang đăng nhập...');
    });

    it('isLoading=true → các input bị disabled', () => {
      render(<LoginForm onSubmit={vi.fn()} isLoading={true} />);

      expect(screen.getByLabelText('Email')).toBeDisabled();
      expect(screen.getByLabelText('Mật khẩu')).toBeDisabled();
    });

    it('isLoading=false (default) → button và inputs không bị disabled', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      expect(screen.getByRole('button')).not.toBeDisabled();
      expect(screen.getByLabelText('Email')).not.toBeDisabled();
    });

  });

  // ── API Error Display ──────────────────────────────────────────────────────
  describe('[STATE] error prop (API error từ server)', () => {

    it('error="Email hoặc mật khẩu không đúng" → hiển thị trong DOM', () => {
      render(<LoginForm onSubmit={vi.fn()} error="Email hoặc mật khẩu không đúng" />);

      const apiError = screen.getByTestId('api-error');
      expect(apiError).toBeInTheDocument();
      expect(apiError).toHaveTextContent('Email hoặc mật khẩu không đúng');
    });

    it('error=null → không hiển thị api-error element', () => {
      render(<LoginForm onSubmit={vi.fn()} error={null} />);

      expect(screen.queryByTestId('api-error')).not.toBeInTheDocument();
    });

    it('api-error element có role="alert" để screen reader announce', () => {
      render(<LoginForm onSubmit={vi.fn()} error="Lỗi server" />);

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

  });

  // ── Error Clear Behavior ───────────────────────────────────────────────────
  describe('[BEHAVIOR] validation error tự clear khi submit lại hợp lệ', () => {

    it('submit lần 1 fail (thiếu email) → fix rồi submit lần 2 → errors bị xóa', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      render(<LoginForm onSubmit={mockSubmit} />);

      // Lần 1: submit không có email → error hiện
      await user.type(screen.getByLabelText('Mật khẩu'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
      expect(screen.getByTestId('email-error')).toBeInTheDocument();

      // Lần 2: điền email rồi submit lại
      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

      // Assert: email error bị xóa
      await waitFor(() => {
        expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();
      });

      // Assert: onSubmit được gọi lần 2
      expect(mockSubmit).toHaveBeenCalledOnce();
    });

  });

});
