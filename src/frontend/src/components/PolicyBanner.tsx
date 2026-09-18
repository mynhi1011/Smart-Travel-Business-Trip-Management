/**
 * PolicyBanner.tsx — Hiển thị policy violations
 *
 * Source of truth duy nhất cho component này — trước đây bị định nghĩa
 * trùng lặp cả trong App.tsx và file này. Đã hợp nhất:
 *   - Tailwind styles từ App.tsx (UI thực tế)
 *   - data-testid + accessibility roles từ file này (cho test)
 *
 * Props:
 *   violations — mảng PolicyViolation; không render gì nếu rỗng
 *
 * Severity rendering:
 *   "error"   (BLOCKER) → đỏ  + label "Vi phạm"
 *   "warning"           → vàng + label "Lưu ý"
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
    <div
      role="region"
      aria-label="Cảnh báo chính sách"
      data-testid="policy-banner"
      className="flex flex-col gap-2 mb-4"
    >
      {violations.map(v => (
        <div
          key={v.code}
          role="alert"
          data-testid={`violation-${v.code}`}
          aria-live="polite"
          className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm ${
            v.level === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          <span
            data-testid={`violation-label-${v.code}`}
            className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
              v.level === 'error'
                ? 'bg-red-200 text-red-700'
                : 'bg-amber-200 text-amber-700'
            }`}
          >
            {v.level === 'error' ? 'Vi phạm' : 'Lưu ý'}
          </span>
          <span data-testid={`violation-message-${v.code}`}>{v.message}</span>
        </div>
      ))}
    </div>
  );
}
