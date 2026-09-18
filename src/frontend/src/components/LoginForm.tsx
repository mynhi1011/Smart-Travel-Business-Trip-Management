/**
 * LoginForm.tsx — Form đăng nhập (tách từ App.tsx để testable)
 *
 * Props:
 *   onSubmit(email, password) — callback khi form submit hợp lệ
 *   isLoading — disable form khi đang call API
 *   error — error message từ API response
 *
 * Client-side validation:
 *   - Email: required, format hợp lệ
 *   - Password: required, tối thiểu 8 ký tự
 */

import { useState, type FormEvent } from 'react';

export interface LoginFormProps {
  onSubmit: (email: string, password: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ onSubmit, isLoading = false, error = null }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  /** Client-side validation — chạy trước khi submit */
  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!email.trim()) {
      errs.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Email không hợp lệ';
    }

    if (!password) {
      errs.password = 'Mật khẩu không được để trống';
    } else if (password.length < 8) {
      errs.password = 'Mật khẩu tối thiểu 8 ký tự';
    }

    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    void onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Đăng nhập" noValidate>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@example.com"
          disabled={isLoading}
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <span id="email-error" role="alert" data-testid="email-error">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Tối thiểu 8 ký tự"
          disabled={isLoading}
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <span id="password-error" role="alert" data-testid="password-error">
            {errors.password}
          </span>
        )}
      </div>

      {/* API-level error — từ onSubmit callback */}
      {error && (
        <div role="alert" data-testid="api-error">
          {error}
        </div>
      )}

      <button type="submit" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  );
}
