/**
 * PolicyBanner.tsx — Hiển thị policy violations (tách từ App.tsx để testable)
 *
 * Nhận mảng violations và render từng item với màu sắc theo severity:
 *   - "error" (BLOCKER) → đỏ + label "Vi phạm"
 *   - "warning" → vàng + label "Lưu ý"
 *
 * Không render gì nếu violations rỗng.
 */

export type PolicyLevel = 'error' | 'warning';

export interface PolicyViolation {
  level: PolicyLevel;
  code: string;
  message: string;
}

export interface PolicyBannerProps {
  violations: PolicyViolation[];
}

export function PolicyBanner({ violations }: PolicyBannerProps) {
  if (violations.length === 0) return null;

  return (
    <div role="region" aria-label="Cảnh báo chính sách" data-testid="policy-banner">
      {violations.map(v => (
        <div
          key={v.code}
          role="alert"
          data-testid={`violation-${v.code}`}
          aria-live="polite"
          className={
            v.level === 'error'
              ? 'policy-error'
              : 'policy-warning'
          }
        >
          <span data-testid={`violation-label-${v.code}`}>
            {v.level === 'error' ? 'Vi phạm' : 'Lưu ý'}
          </span>
          <span data-testid={`violation-message-${v.code}`}>
            {v.message}
          </span>
        </div>
      ))}
    </div>
  );
}
