/**
 * ApprovalReasonsBanner.tsx — Banner hiển thị lý do duyệt 2 cấp
 *
 * Dùng chung ở:
 *   - Màn Manager duyệt cấp 1 (hiện lý do + "sẽ chuyển Travel Admin")
 *   - Màn Travel Admin duyệt cấp 2 (hiện lý do + thông tin cấp 1 đã duyệt)
 *   - Chi tiết trip của Employee (hiện lý do để Employee hiểu)
 *
 * Props:
 *   approvalReasons: ApprovalReason[] — mảng lý do từ BE snapshot
 *   level:          1 | 2 | 'employee' — điều chỉnh nội dung phụ
 *   level1Approval: Level1Approval | null — khi level=2
 */

import type { ApprovalReason, Level1Approval } from '../services/trips';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// ─── Inline SVG icons (không dùng external lib) ───────────────────────────────

/** Icon cảnh báo tam giác — dùng ở header banner */
function IconAlertTriangle({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

/** Icon đồng hồ / khẩn cấp — URGENT_TRIP */
function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

/** Icon ví/ngân sách — BUDGET_OVER_THRESHOLD */
function IconWallet({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  );
}

/** Icon xu hướng tăng — COMBINED_COST_LIMIT_EXCEEDED */
function IconTrendingUp({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.94" />
    </svg>
  );
}

/** Icon mặc định cho code không nhận ra */
function IconInfo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function ReasonIcon({ code }: { code: string }) {
  const cls = 'w-4 h-4 shrink-0 mt-0.5 text-amber-700';
  if (code === 'URGENT_TRIP')                  return <IconClock className={cls} />;
  if (code === 'BUDGET_OVER_THRESHOLD')        return <IconWallet className={cls} />;
  if (code === 'COMBINED_COST_LIMIT_EXCEEDED') return <IconTrendingUp className={cls} />;
  return <IconInfo className={cls} />;
}

// ─── ReasonItem ───────────────────────────────────────────────────────────────

function ReasonItem({ reason }: { reason: ApprovalReason }) {
  return (
    <div className="flex items-start gap-2.5">
      <ReasonIcon code={reason.code} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">{reason.title}</p>
        <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{reason.detail}</p>
      </div>
    </div>
  );
}

// ─── ApprovalReasonsBanner ────────────────────────────────────────────────────

interface ApprovalReasonsBannerProps {
  approvalReasons:  ApprovalReason[];
  level?:           1 | 2 | 'employee';
  level1Approval?:  Level1Approval | null;
}

export function ApprovalReasonsBanner({
  approvalReasons,
  level = 'employee',
  level1Approval,
}: ApprovalReasonsBannerProps) {
  if (!approvalReasons || approvalReasons.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3"
      role="region"
      aria-label="Lý do duyệt 2 cấp"
      data-testid="approval-reasons-banner"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
        <p className="text-sm font-bold text-amber-900">Yêu cầu này cần duyệt 2 cấp vì:</p>
      </div>

      {/* Danh sách lý do */}
      <div className="flex flex-col gap-2.5 pl-1">
        {approvalReasons.map((r) => (
          <ReasonItem key={r.code} reason={r} />
        ))}
      </div>

      {/* Chú thích theo level */}
      {level === 1 && (
        <div className="pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-700 leading-relaxed">
            Sau khi bạn duyệt, yêu cầu sẽ chuyển sang <strong>Travel Admin / Director</strong> phê duyệt cấp 2.
          </p>
        </div>
      )}

      {level === 2 && level1Approval && (
        <div className="pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-700 leading-relaxed">
            Đã duyệt cấp 1 bởi <strong>{level1Approval.approverName}</strong>
            {' '}lúc <strong>{fmtDate(level1Approval.approvedAt)}</strong>
            {level1Approval.comment && (
              <>, ghi chú: <em>"{level1Approval.comment}"</em></>
            )}.
          </p>
        </div>
      )}

      {level === 'employee' && (
        <div className="pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-700">
            Vì những lý do trên, yêu cầu cần qua 2 cấp phê duyệt (Manager → Travel Admin).
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TwoLevelBadge — nhãn nhỏ dùng ở danh sách trip ─────────────────────────

interface TwoLevelBadgeProps {
  approvalReasons: ApprovalReason[];
  className?: string;
}

export function TwoLevelBadge({ approvalReasons, className = '' }: TwoLevelBadgeProps) {
  if (!approvalReasons || approvalReasons.length === 0) return null;

  const tooltip = approvalReasons
    .map((r) => {
      const short: Record<string, string> = {
        URGENT_TRIP:                  'Khẩn cấp',
        BUDGET_OVER_THRESHOLD:        'Ngân sách > 20 triệu',
        COMBINED_COST_LIMIT_EXCEEDED: 'Vượt hạn mức',
      };
      return short[r.code] ?? r.title;
    })
    .join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 ${className}`}
      title={tooltip}
      aria-label={`Duyệt 2 cấp: ${tooltip}`}
      data-testid="two-level-badge"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Duyệt 2 cấp
    </span>
  );
}
