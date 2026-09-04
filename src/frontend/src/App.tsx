import { useState, useRef, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ApiError, authApi, getAccessToken, type BackendUser } from "./services/api";
import { listTrips, createTrip, submitTrip, approveTrip, rejectTrip, closeTrip, type BackendTrip } from "./services/trips";
import { generateItinerary as generateAiItinerary, type AiItineraryItem } from "./services/ai";
import {
  listNotifications as apiListNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type BackendNotification,
} from "./services/notifications";
import {
  getDashboard,
  type ManagerDashboard,
  type TravelAdminDashboard, type FinanceDashboard, type AdminDashboard,
} from "./services/dashboard";
import {
  getItinerary, addItineraryItem, updateItineraryItem, deleteItineraryItem,
  type BackendItineraryItem, type ItineraryItemInput, type ItineraryCategory, type ItineraryTimeSlot,
} from "./services/itinerary";
import {
  getExpense, createExpense, addExpenseItem,
  submitExpense, approveExpense, rejectExpense, reapproveExpense,
  type BackendExpense, type ExpenseCategory,
} from "./services/expenses";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

// BUG-17 fix: tách TRAVEL_ADMIN và ADMIN thành hai role riêng trong UI
// Backend ADMIN có quyền xem toàn hệ thống — không được gộp chung với TRAVEL_ADMIN
type Role = "employee" | "manager" | "admin" | "sysadmin" | "finance";
type User = { id?: string; email: string; password?: string; name: string; role: Role; title: string };

type TripStatus =
  | "DRAFT" | "SUBMITTED"
  | "APPROVED_MANAGER"
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED" | "REJECTED"
  | "TRIP_IN_PROGRESS"
  | "EXPENSE_SUBMITTED"
  | "PENDING_MANAGER_ADDITIONAL_APPROVAL"
  | "EXPENSE_APPROVED"   // BUG-03: Finance approve expense xong nhưng trip chưa CLOSED
  | "CLOSED";

type PolicyLevel = "error" | "warning";
type PolicyViolation = { level: PolicyLevel; code: string; message: string };

type ExpenseItem = {
  id: string; date: string; category: string; label: string;
  description: string; budgeted: number; actual: number; receipt?: string;
};

type Trip = {
  id: string; tripCode: string; from: string; to: string;
  departDate: string; returnDate: string;
  budget: number; status: TripStatus;
  employeeId: string; employeeName: string;
  purpose: string; submittedAt: string;
  managerNote?: string; adminNote?: string; financeNote?: string;
  actualExpenses?: ExpenseItem[];
  policyViolations?: PolicyViolation[];
  managerApproved?: boolean; adminApproved?: boolean;
  managerAdditionalApproval?: boolean;
  urgent?: boolean; urgentReason?: string;
};

type Notification = {
  id: string; toUser: string; message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean; createdAt: string; tripId?: string;
};

type ItineraryItem = { time: string; title: string; detail: string };
type ItineraryDay  = { day: string; items: ItineraryItem[] };

// ══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════════════════════════════════

const USERS: User[] = [
  { email: "nhanvien@smarttravel.vn",    password: "12345678", name: "Nguyễn Văn Nam", role: "employee", title: "Sales Executive" },
  { email: "truongphong@smarttravel.vn", password: "12345678", name: "Trần Thị Lan",   role: "manager",  title: "Sales Manager" },
  { email: "admin@smarttravel.vn",       password: "12345678", name: "Lê Minh Tuấn",   role: "admin",    title: "Travel Admin" },
  { email: "ketoan@smarttravel.vn",      password: "12345678", name: "Phạm Thu Hà",    role: "finance",  title: "Finance Officer" },
];

const EXPENSE_CATEGORIES = [
  { key: "flight",    label: "Vé máy bay"  },
  { key: "hotel",     label: "Khách sạn"   },
  { key: "transport", label: "Di chuyển"   },
  { key: "meal",      label: "Ăn uống"     },
  { key: "other",     label: "Chi phí khác"},
];

const MAJOR_CITIES = ["hà nội", "tp.hcm", "hcm", "hồ chí minh", "tp. hồ chí minh", "thành phố hồ chí minh", "sài gòn", "đà nẵng", "hải phòng", "cần thơ"];

const VIETNAM_PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định",
  "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau", "Cao Bằng", "Cần Thơ", "Đà Nẵng", "Đắk Lắk",
  "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh",
  "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum",
  "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận",
  "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng",
  "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "TP. Hồ Chí Minh",
  "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
];

function perDiemRate(city: string): number {
  return MAJOR_CITIES.some(c => city.toLowerCase().includes(c)) ? 400_000 : 300_000;
}

function parseDMY(s: string): Date | null {
  const p = s.split("/");
  if (p.length !== 3) return null;
  const d = new Date(+p[2], +p[1] - 1, +p[0]);
  return isNaN(d.getTime()) ? null : d;
}

// DEFAULT_EXPENSES removed — expense data now loaded from backend API

// _trips mock removed — trip data now loaded from backend API

// _notifications mock removed — BUG-04/BUG-05: notifications now fetched from backend API + SSE

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—";
}

/** Map BackendNotification.type → frontend Notification.type */
function mapNotifType(type: string): Notification["type"] {
  if (type.includes("REJECT") || type.includes("FAILED")) return "error";
  if (type.includes("APPROVED") || type.includes("CLOSED")) return "success";
  if (type.includes("PENDING") || type.includes("REAPPROVE")) return "warning";
  return "info";
}

function toFrontendNotif(n: BackendNotification): Notification {
  return {
    id: n.id,
    toUser: n.recipientId,
    message: n.message,
    type: mapNotifType(n.type),
    read: n.isRead,
    createdAt: new Intl.DateTimeFormat("vi-VN").format(new Date(n.createdAt)),
    tripId: n.referenceType === "TRIP" ? (n.referenceId ?? undefined) : undefined,
  };
}

/**
 * useNotifications — BUG-04/BUG-05 fix
 *
 * - Fetch từ GET /notifications khi mount
 * - markRead → PATCH /notifications/:id/read
 * - markAllRead → PATCH /notifications/read-all
 * - SSE stream /notifications/stream?token=<accessToken> cho real-time push
 */
const useNotifications = (userId: string) => {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifs = async () => {
    try {
      const res = await apiListNotifications({ limit: 50 });
      setNotifs(res.data.map(toFrontendNotif));
    } catch {
      // Không làm gián đoạn UI nếu load notification thất bại
    } finally {
      setLoading(false);
    }
  };

  // Mount: fetch lần đầu + mở SSE
  useEffect(() => {
    void fetchNotifs();

    // BUG-05: Mở SSE stream để nhận real-time push
    const token = getAccessToken();
    if (token) {
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
      const sseUrl = `${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          // Bỏ qua ping event
          if (payload.type === "CONNECTED" || payload.type === "ping") return;
          // Có notification mới → refetch để đảm bảo đồng bộ với DB
          void fetchNotifs();
        } catch { /* ignore malformed */ }
      };

      es.onerror = () => {
        // SSE lỗi/disconnect — đóng để tránh reconnect loop không kiểm soát
        es.close();
        eventSourceRef.current = null;
      };
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markRead = async (id: string) => {
    // Optimistic update
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await markNotificationRead(id);
    } catch {
      // Revert nếu API lỗi
      void fetchNotifs();
    }
  };

  const markAllRead = async () => {
    // Optimistic update
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void fetchNotifs();
    }
  };

  return {
    notifs,
    loading,
    markRead,
    markAllRead,
    unread: notifs.filter(n => !n.read).length,
  };
};

function toFrontendTrip(trip: BackendTrip): Trip {
  const statusMap: Record<string, TripStatus> = {
    DRAFT:                    "DRAFT",
    SUBMITTED:                "SUBMITTED",
    MANAGER_REVIEWING:        "SUBMITTED",
    PENDING_ADMIN_APPROVAL:   "PENDING_ADMIN_APPROVAL",
    APPROVED:                 "APPROVED",
    ONGOING:                  "TRIP_IN_PROGRESS",
    EXPENSE_DRAFT:            "TRIP_IN_PROGRESS",
    EXPENSE_SUBMITTED:        "EXPENSE_SUBMITTED",
    EXPENSE_APPROVED:         "EXPENSE_APPROVED",  // BUG-03: trạng thái riêng, chưa phải CLOSED
    EXPENSE_REJECTED:         "EXPENSE_SUBMITTED", // bị reject → employee sửa lại
    MANAGER_REAPPROVE:        "PENDING_MANAGER_ADDITIONAL_APPROVAL",
    CLOSED:                   "CLOSED",
    REJECTED:                 "REJECTED",
  };
  return {
    id: trip.id, tripCode: trip.tripCode, from: trip.origin, to: trip.destination,
    departDate: formatDate(trip.departureDate), returnDate: formatDate(trip.returnDate),
    budget: trip.estimatedBudget, status: statusMap[trip.status] ?? "DRAFT",
    employeeId: trip.employeeId, employeeName: trip.employee?.name ?? "—",
    purpose: trip.purpose, submittedAt: formatDate(trip.submittedAt),
    urgent: trip.isUrgent, urgentReason: trip.urgencyReason ?? undefined,
    policyViolations: trip.policyCheckResult?.violations.map((v) => ({
      level: v.severity === "BLOCKER" ? "error" : "warning",
      code: v.code, message: v.detail,
    })),
  };
}

const useTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try { setTrips((await listTrips()).map(toFrontendTrip)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  return { trips, loading, reload };
};

/**
 * useDashboard — BUG-10/BUG-11: Fetch dashboard data từ GET /dashboard
 * Backend trả data đã tổng hợp theo role, không cần tự tính từ listTrips().
 */
function useDashboard<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try { setData((await getDashboard()) as T); }
    catch { /* fallback: giữ null, UI tự xử lý */ }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  return { data, loading, reload };
}

function getAccomLimit(title: string): { limit: number; label: string } {
  const t = title.toLowerCase();
  if (t.includes("director") || t.includes("executive") || t.includes("ceo") || t.includes("cto") || t.includes("coo"))
    return { limit: 3_000_000, label: "Director/Executive" };
  if (t.includes("manager") || t.includes("lead") || t.includes("head"))
    return { limit: 1_800_000, label: "Manager/Lead" };
  return { limit: 1_000_000, label: "Staff/Specialist" };
}

/**
 * BUG-14 fix: đếm ngày làm việc (bỏ Thứ 7, Chủ nhật) — đồng bộ với backend countWorkingDays()
 * Backend: policy.service.ts countWorkingDays(from, to)
 */
function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function checkPolicy(budget: number, departDate: string, to: string, days: number, hotelPerNight = 0, employeeTitle = ""): PolicyViolation[] {
  const v: PolicyViolation[] = [];

  if (budget > 20_000_000) {
    v.push({ level: "error", code: "OVER_20M", message: `Ngân sách ${budget.toLocaleString("vi-VN")}đ vượt ngưỡng 20,000,000đ — bắt buộc phê duyệt Travel Admin` });
  } else if (budget > 15_000_000) {
    v.push({ level: "warning", code: "HIGH_BUDGET", message: "Ngân sách cao (>15,000,000đ) — vui lòng tối ưu trước khi nộp" });
  }

  if (hotelPerNight > 0) {
    const accom = getAccomLimit(employeeTitle);
    if (hotelPerNight > accom.limit) {
      v.push({ level: "warning", code: "ACCOMMODATION_OVER_LIMIT", message: `Dự toán khách sạn ${hotelPerNight.toLocaleString("vi-VN")}đ/đêm vượt hạn mức ${accom.label} (${accom.limit.toLocaleString("vi-VN")}đ/đêm)` });
    }
  }

  if (days > 0 && to) {
    const maxPerDiem = days * perDiemRate(to);
    // BUG-13 fix: BR-TR-02 "không cho phép vượt" → BLOCKER khi có perDiem input vượt hạn mức
    // Ở đây chỉ hiển thị info note vì frontend không biết perDiemBudget riêng của user
    // Policy check thực sự (BLOCKER) chạy ở server khi submit
    v.push({ level: "warning", code: "PER_DIEM_NOTE", message: `Hạn mức phụ cấp công tác tối đa: ${maxPerDiem.toLocaleString("vi-VN")}đ (${days} ngày × ${perDiemRate(to).toLocaleString("vi-VN")}đ/ngày) — BR-TR-02` });
  }

  if (departDate) {
    const dept = parseDMY(departDate);
    if (dept) {
      // BUG-14 fix: dùng ngày làm việc thay vì ngày lịch để đồng bộ với backend
      const workingDaysLeft = countWorkingDays(new Date(), dept);
      if (workingDaysLeft >= 0 && workingDaysLeft < 3) {
        v.push({ level: "error", code: "LATE_SUBMISSION", message: `Nộp muộn — còn ${workingDaysLeft} ngày làm việc trước khởi hành (tối thiểu 3 ngày làm việc). Đánh dấu là Chuyến đi khẩn cấp và nhập lý do.` });
      } else if (workingDaysLeft >= 3 && workingDaysLeft < 5) {
        v.push({ level: "warning", code: "SHORT_NOTICE", message: `Thời gian nộp khá sát (${workingDaysLeft} ngày làm việc) — khuyến nghị nộp trước 5 ngày làm việc` });
      }
    }
  }

  return v;
}

/**
 * BUG-15 fix: đồng bộ với backend routeApproval() trong approval.service.ts
 * Backend: violations.length > 0 → PENDING_ADMIN_APPROVAL (không lọc gì cả)
 * Frontend cũ: lọc bỏ LATE_SUBMISSION — không match backend
 *
 * Quyết định: giữ lọc LATE_SUBMISSION vì:
 * - LATE_SUBMISSION / URGENT_TRIP_NOTICE → severity WARNING (không phải BLOCKER)
 * - Backend policyCheckResult.violations chứa tất cả violations
 * - Frontend map: severity BLOCKER → "error", WARNING → "warning"
 * - Nếu chỉ có LATE_SUBMISSION (warning), backend vẫn route → PENDING_ADMIN_APPROVAL
 *   vì requiresLevel2 = violations.length > 0
 * → Sửa để dùng policyViolations từ backend (đã được server tính), ưu tiên budget check
 */
function needsAdminApproval(trip: Trip): boolean {
  // Budget > 20M luôn cần Admin (BR-TR-04)
  if (trip.budget > 20_000_000) return true;
  // Có bất kỳ violation nào (từ server) → cần Admin, đúng với backend routeApproval()
  if (trip.policyViolations && trip.policyViolations.length > 0) return true;
  return false;
}

function PolicyBanner({ violations }: { violations: PolicyViolation[] }) {
  if (!violations.length) return null;
  return (
    <div className="flex flex-col gap-2 mb-4">
      {violations.map(v => (
        <div key={v.code} className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm ${v.level === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${v.level === "error" ? "bg-red-200 text-red-700" : "bg-amber-200 text-amber-700"}`}>
            {v.level === "error" ? "Vi phạm" : "Lưu ý"}
          </span>
          <span>{v.message}</span>
        </div>
      ))}
    </div>
  );
}

const ROLE_COLORS: Record<Role, { logo: string; bg: string; text: string; border: string }> = {
  employee: { logo: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  manager:  { logo: "bg-teal-500",    bg: "bg-teal-50",     text: "text-teal-700",    border: "border-teal-200"    },
  admin:    { logo: "bg-violet-500",  bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200"  },
  sysadmin: { logo: "bg-rose-500",    bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200"    },
  finance:  { logo: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200"   },
};

const ROLE_LABEL: Record<Role, string> = { employee: "Nhân viên", manager: "Quản lý", admin: "Travel Admin", sysadmin: "System Admin", finance: "Finance" };

const STATUS_LABEL: Record<TripStatus, string> = {
  DRAFT:                               "Bản nháp",
  SUBMITTED:                           "Chờ duyệt cấp 1",
  APPROVED_MANAGER:                    "Đã duyệt cấp 1",
  PENDING_ADMIN_APPROVAL:              "Chờ duyệt cấp 2",
  APPROVED:                            "Đã duyệt",
  TRIP_IN_PROGRESS:                    "Đang thực hiện",
  REJECTED:                            "Từ chối",
  EXPENSE_SUBMITTED:                   "Đang quyết toán",
  PENDING_MANAGER_ADDITIONAL_APPROVAL: "Chờ Manager bổ sung",
  EXPENSE_APPROVED:                    "Finance đã duyệt — chờ đóng hồ sơ",
  CLOSED:                              "Đã đóng hồ sơ",
};

const STATUS_STYLE: Record<TripStatus, string> = {
  DRAFT:                               "bg-gray-100 text-gray-500 border border-gray-200",
  SUBMITTED:                           "bg-amber-100 text-amber-700 border border-amber-200",
  APPROVED_MANAGER:                    "bg-teal-100 text-teal-700 border border-teal-200",
  PENDING_ADMIN_APPROVAL:              "bg-blue-100 text-blue-700 border border-blue-200",
  APPROVED:                            "bg-emerald-100 text-emerald-700 border border-emerald-200",
  TRIP_IN_PROGRESS:                    "bg-cyan-100 text-cyan-700 border border-cyan-200",
  REJECTED:                            "bg-red-100 text-red-600 border border-red-200",
  EXPENSE_SUBMITTED:                   "bg-purple-100 text-purple-700 border border-purple-200",
  PENDING_MANAGER_ADDITIONAL_APPROVAL: "bg-orange-100 text-orange-700 border border-orange-200",
  EXPENSE_APPROVED:                    "bg-indigo-100 text-indigo-700 border border-indigo-200",
  CLOSED:                              "bg-gray-100 text-gray-500 border border-gray-200",
};

// AI_ITINERARY static data removed — BUG-06: replaced with real API call

/** Convert AiItineraryItem[] (backend shape) → ItineraryDay[] (local display shape) */
function aiItemsToItineraryDays(items: AiItineraryItem[]): ItineraryDay[] {
  const TIME_SLOT_LABEL: Record<string, string> = {
    MORNING: "Sáng", AFTERNOON: "Chiều", EVENING: "Tối", ALL_DAY: "Cả ngày",
  };
  const CATEGORY_LABEL: Record<string, string> = {
    MEETING: "Họp", ACCOMMODATION: "Lưu trú", TRANSPORT: "Di chuyển",
    MEAL: "Ăn uống", OTHER: "Khác",
  };

  // Nhóm theo dayNumber
  const grouped = new Map<number, AiItineraryItem[]>();
  for (const item of items) {
    if (!grouped.has(item.dayNumber)) grouped.set(item.dayNumber, []);
    grouped.get(item.dayNumber)!.push(item);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNumber, dayItems]) => {
      const dateLabel = dayItems[0]?.itemDate
        ? new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
            .format(new Date(dayItems[0].itemDate + "T00:00:00"))
        : "";
      return {
        day: `Ngày ${dayNumber}${dateLabel ? ` — ${dateLabel}` : ""}`,
        items: dayItems.map((it) => ({
          time: `${TIME_SLOT_LABEL[it.timeSlot] ?? it.timeSlot} · ${CATEGORY_LABEL[it.category] ?? it.category}`,
          title: it.activity,
          detail: `${it.location}${it.estimatedCost > 0 ? ` · ${it.estimatedCost.toLocaleString("vi-VN")}đ` : ""}${it.notes ? ` · ${it.notes}` : ""}`,
        })),
      };
    });
}

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.95 9.95 0 016.375 2.325M3 3l18 18" /></svg>
    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
}

function NotifBell({ userId }: { userId: string }) {
  const { notifs, unread, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const typeColor: Record<string, string> = { success: "text-emerald-600", warning: "text-amber-600", error: "text-red-600", info: "text-blue-600" };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="relative p-1.5 text-gray-400 hover:text-white transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-[#1b2f35] uppercase tracking-wider">Thông báo</p>
            {unread > 0 && <button onClick={() => { void markAllRead(); }} className="text-xs text-emerald-600 hover:underline">Đánh dấu tất cả đã đọc</button>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Không có thông báo nào.</p>}
            {notifs.map(n => (
              <div key={n.id} onClick={() => { void markRead(n.id); }} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${n.read ? "opacity-60" : ""}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${typeColor[n.type].replace("text-", "bg-")}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#1b2f35] leading-relaxed">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{n.createdAt}</p>
                </div>
                {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Nav({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="bg-[#1b2f35] text-white shrink-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center justify-center w-7 h-7 rounded-md ${ROLE_COLORS[user.role].logo} text-white font-bold text-sm select-none`}>S</span>
          <span className="font-semibold text-sm tracking-wide">Smart Travel</span>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden sm:flex items-center gap-1.5 text-sm text-gray-300 flex-wrap">
            <span className="uppercase tracking-wider font-medium text-gray-400">{user.role}</span>
            <span className="text-gray-600">·</span>
            <span className="text-white font-medium">{user.name}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-300">{user.title}</span>
          </nav>
          <NotifBell userId={user.id ?? user.email} />
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-md px-2.5 py-1.5 transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}

function PageHeader({ label, title, subtitle, action }: { label: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-amber-500 uppercase mb-1">{label}</p>
          <h1 className="text-3xl font-bold text-[#1b2f35] leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 mt-1">{action}</div>}
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-600 mb-1.5">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] focus:border-transparent transition" />;
}

function StatusBadge({ status, violations }: { status: TripStatus; violations?: PolicyViolation[] }) {
  const hasError = violations?.some(v => v.level === "error");
  const hasWarn  = violations?.some(v => v.level === "warning");
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${STATUS_STYLE[status]}`}>
        {STATUS_LABEL[status]}
      </span>
      {hasError && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200">Vi phạm</span>}
      {!hasError && hasWarn && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-600 border border-amber-200">Cảnh báo</span>}
    </div>
  );
}

function TripCard({ trip, onClick, cta }: { trip: Trip; onClick?: () => void; cta?: string }) {
  return (
    <Card className={onClick ? "hover:shadow-md transition-shadow cursor-pointer" : ""}>
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" onClick={onClick}>
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-[#1b2f35] mb-1">
            <span>{trip.from}</span><span className="text-emerald-500">→</span><span>{trip.to}</span>
            {trip.urgent && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200">Khẩn cấp</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span className="font-medium text-gray-500">{trip.tripCode}</span>
            <span>·</span><span>{trip.departDate} – {trip.returnDate}</span>
            <span>·</span><span>{trip.budget.toLocaleString("vi-VN")}đ</span>
            <span>·</span><span>{trip.employeeName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {cta && <span className="text-xs text-emerald-600 font-medium">{cta}</span>}
          <StatusBadge status={trip.status} violations={trip.policyViolations} />
        </div>
      </div>
    </Card>
  );
}

function ExportBtn({ label = "Xuất PDF" }: { label?: string }) {
  const [exporting, setExporting] = useState(false);
  function handle() { setExporting(true); setTimeout(() => { setExporting(false); window.print(); }, 400); }
  return (
    <button onClick={handle} disabled={exporting} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60">
      {exporting
        ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      }
      {label}
    </button>
  );
}

const MONTHS_VI = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
const DAYS_VI   = ["CN","T2","T3","T4","T5","T6","T7"];

function DatePicker({ value, onChange, placeholder = "dd/mm/yyyy", disabled = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

  const parsed = parseDMY(value);
  const [viewYear,  setViewYear]  = useState(parsed ? parsed.getFullYear()  : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth()      : today.getMonth());

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  function select(d: Date) {
    const dd   = String(d.getDate()).padStart(2, "0");
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    onChange(`${dd}/${mm}/${yyyy}`);
    setOpen(false);
  }

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d: Date) => parseDMY(value)?.toDateString() === d.toDateString();
  const isToday    = (d: Date) => today.toDateString() === d.toDateString();

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          readOnly
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onClick={() => !disabled && setOpen(v => !v)}
          className="w-full border border-gray-200 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] focus:border-transparent transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        />
        <button type="button" onClick={() => !disabled && setOpen(v => !v)} disabled={disabled} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 p-3 select-none">
          <div className="flex items-center justify-between mb-3 px-1">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-[#1b2f35]">{MONTHS_VI[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS_VI.map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => (
              <div key={i} className="flex items-center justify-center">
                {d ? (
                  <button type="button" onClick={() => select(d)} className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${isSelected(d) ? "bg-[#1b2f35] text-white" : isToday(d) ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200" : "text-gray-700 hover:bg-gray-100"}`}>
                    {d.getDate()}
                  </button>
                ) : <div className="w-8 h-8" />}
              </div>
            ))}
          </div>
          {value && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-center">
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Xoá ngày</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItineraryList({ initial, departDate, readOnly = false }: { initial: ItineraryDay[]; departDate?: string; readOnly?: boolean }) {
  const [days, setDays] = useState<ItineraryDay[]>(initial);
  const [editing, setEditing] = useState<{ d: number; i: number } | null>(null);
  const [draft, setDraft] = useState<ItineraryItem>({ time: "", title: "", detail: "" });
  const [guardError, setGuardError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) titleRef.current?.focus(); }, [editing]);

  function checkGuard(): boolean {
    if (!departDate) return true;
    const dept = parseDMY(departDate);
    if (!dept) return true;
    const cutoff = new Date(dept.getTime() - 86_400_000);
    if (new Date() >= cutoff) {
      setGuardError(`Không thể chỉnh sửa/xóa lịch trình trong vòng 1 ngày trước ngày khởi hành (${departDate}).`);
      return false;
    }
    setGuardError("");
    return true;
  }

  function startEdit(d: number, i: number) {
    if (!checkGuard()) return;
    setDraft({ ...days[d].items[i] }); setEditing({ d, i });
  }
  function saveEdit() {
    if (!editing) return;
    setDays(p => p.map((day, d) => d !== editing.d ? day : { ...day, items: day.items.map((it, i) => i !== editing.i ? it : { ...draft }) }));
    setEditing(null);
  }
  function del(d: number, i: number) {
    if (!checkGuard()) return;
    setDays(p => p.map((day, di) => di !== d ? day : { ...day, items: day.items.filter((_, ii) => ii !== i) }).filter(day => day.items.length > 0));
  }

  return (
    <div className="flex flex-col gap-6">
      {guardError && (
        <div className="px-3.5 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-xs font-medium">{guardError}</div>
      )}
      {days.map((day, d) => (
        <div key={day.day}>
          <p className="text-xs font-bold text-[#1b2f35] mb-3 pb-1.5 border-b border-gray-100">{day.day}</p>
          <div className="flex flex-col gap-1">
            {day.items.map((item, i) => (
              <div key={i} className="group flex gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                <span className="text-xs font-semibold text-gray-400 w-10 shrink-0 text-right pt-1">{item.time}</span>
                <div className="flex-1 min-w-0">
                  {editing?.d === d && editing?.i === i ? (
                    <div className="flex flex-col gap-2">
                      <input value={draft.time} onChange={e => setDraft(v => ({ ...v, time: e.target.value }))} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 w-24" placeholder="Giờ" />
                      <input ref={titleRef} value={draft.title} onChange={e => setDraft(v => ({ ...v, title: e.target.value }))} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full" placeholder="Tiêu đề" />
                      <textarea value={draft.detail} onChange={e => setDraft(v => ({ ...v, detail: e.target.value }))} rows={2} className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none w-full" placeholder="Chi tiết" />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md">Lưu</button>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-md">Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-[#1b2f35]">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                    </div>
                  )}
                </div>
                {!(editing?.d === d && editing?.i === i) && !readOnly && (
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    <button onClick={() => startEdit(d, i)} className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16H8v-2a2 2 0 01.586-1.414z" /></svg>
                    </button>
                    <button onClick={() => del(d, i)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Backend → UI category mapping ───────────────────────────────────────────
function mapBackendCategory(cat: string): string {
  const map: Record<string, string> = {
    ACCOMMODATION: "hotel", TRANSPORT: "transport",
    MEAL: "meal", PER_DIEM: "meal", OTHER: "other",
  };
  return map[cat] ?? cat.toLowerCase();
}

// ─── ExpenseItemForm — form thêm khoản chi mới vào expense ───────────────────
function ExpenseItemForm({ tripId, onAdded }: { tripId: string; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ expenseDate: "", category: "OTHER" as ExpenseCategory, amount: "", description: "" });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.expenseDate || !form.amount || !form.description.trim()) { setErr("Vui lòng điền đầy đủ."); return; }
    setSaving(true); setErr("");
    try {
      const [dd, mm, yyyy] = form.expenseDate.split("/");
      // Ensure expense header exists first
      try { await createExpense(tripId); } catch { /* already exists */ }
      await addExpenseItem(tripId, {
        expenseDate: `${yyyy}-${mm}-${dd}`,
        category: form.category,
        amount: Number(form.amount),
        description: form.description.trim(),
      });
      await onAdded();
      setForm({ expenseDate: "", category: "OTHER", amount: "", description: "" });
      setOpen(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Lỗi thêm khoản chi.");
    } finally {
      setSaving(false);
    }
  }

  const BACKEND_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
    { key: "ACCOMMODATION", label: "Lưu trú" },
    { key: "TRANSPORT", label: "Di chuyển" },
    { key: "MEAL", label: "Ăn uống" },
    { key: "PER_DIEM", label: "Phụ cấp" },
    { key: "OTHER", label: "Khác" },
  ];

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-sm font-semibold text-emerald-600 hover:underline">
        + Thêm khoản chi
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="mt-4 border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 flex flex-col gap-3">
      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Thêm khoản chi mới</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Ngày chi <span className="text-red-400">*</span></FieldLabel>
          <DatePicker value={form.expenseDate} onChange={v => setForm(f => ({ ...f, expenseDate: v }))} />
        </div>
        <div>
          <FieldLabel>Danh mục <span className="text-red-400">*</span></FieldLabel>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b2f35]">
            {BACKEND_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Số tiền (đ) <span className="text-red-400">*</span></FieldLabel>
          <input type="number" min={1} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b2f35]" placeholder="0" />
        </div>
        <div>
          <FieldLabel>Mô tả <span className="text-red-400">*</span></FieldLabel>
          <TextInput value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tên khoản chi..." />
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
          {saving ? "Đang thêm..." : "Thêm"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg">Huỷ</button>
      </div>
    </form>
  );
}

// ─── ItineraryListServer — hiển thị và chỉnh sửa itinerary từ backend ────────
const TIME_SLOT_LABEL: Record<string, string> = {
  MORNING: "Sáng", AFTERNOON: "Chiều", EVENING: "Tối", ALL_DAY: "Cả ngày",
};
const ITIN_CATEGORIES: { key: ItineraryCategory; label: string }[] = [
  { key: "MEETING", label: "Họp" },
  { key: "ACCOMMODATION", label: "Lưu trú" },
  { key: "TRANSPORT", label: "Di chuyển" },
  { key: "MEAL", label: "Ăn uống" },
  { key: "OTHER", label: "Khác" },
];

function ItineraryListServer({ items, readOnly, onAdd, onUpdate, onDelete }: {
  items: BackendItineraryItem[];
  tripId?: string;
  departDate?: string;
  readOnly?: boolean;
  onAdd: (input: ItineraryItemInput) => Promise<void>;
  onUpdate: (itemId: string, input: Partial<ItineraryItemInput>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ItineraryItemInput>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState<ItineraryItemInput>({
    itemDate: "", timeSlot: "MORNING", location: "", activity: "", category: "MEETING", estimatedCost: 0,
  });
  const [saving, setSaving] = useState(false);

  // Group by dayNumber
  const byDay = items.reduce<Record<number, BackendItineraryItem[]>>((acc, it) => {
    (acc[it.dayNumber] = acc[it.dayNumber] ?? []).push(it);
    return acc;
  }, {});

  async function saveEdit(itemId: string) {
    setSaving(true);
    try { await onUpdate(itemId, draft); setEditing(null); }
    finally { setSaving(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.itemDate || !newItem.location || !newItem.activity) return;
    setSaving(true);
    try { await onAdd(newItem); setAddOpen(false); setNewItem({ itemDate: "", timeSlot: "MORNING", location: "", activity: "", category: "MEETING", estimatedCost: 0 }); }
    finally { setSaving(false); }
  }

  function formatItemDate(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN");
  }

  if (items.length === 0 && readOnly) {
    return <p className="text-sm text-gray-400 text-center py-6">Chưa có lịch trình.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map(dayNum => (
        <div key={dayNum}>
          <p className="text-xs font-bold text-[#1b2f35] mb-2 pb-1.5 border-b border-gray-100">Ngày {dayNum}</p>
          <div className="flex flex-col gap-2">
            {byDay[Number(dayNum)].map(item => (
              <div key={item.id} className="group flex gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                <span className="text-xs font-semibold text-gray-400 w-16 shrink-0 pt-1">{TIME_SLOT_LABEL[item.timeSlot] ?? item.timeSlot}</span>
                <div className="flex-1 min-w-0">
                  {editing === item.id ? (
                    <div className="flex flex-col gap-2">
                      <TextInput value={draft.activity ?? item.activity} onChange={e => setDraft(d => ({ ...d, activity: e.target.value }))} placeholder="Hoạt động" />
                      <TextInput value={draft.location ?? item.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} placeholder="Địa điểm" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(item.id)} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md disabled:opacity-50">Lưu</button>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md">Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-[#1b2f35]">{item.activity}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.location} · {formatItemDate(item.itemDate)}</p>
                      {item.estimatedCost > 0 && <p className="text-xs text-gray-400">{item.estimatedCost.toLocaleString("vi-VN")}đ</p>}
                    </div>
                  )}
                </div>
                {editing !== item.id && !readOnly && (
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    <button onClick={() => { setDraft({}); setEditing(item.id); }} className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16H8v-2a2 2 0 01.586-1.414z" /></svg>
                    </button>
                    <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!readOnly && (
        addOpen ? (
          <form onSubmit={handleAdd} className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 flex flex-col gap-3">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Thêm mục lịch trình</p>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Ngày *</FieldLabel><DatePicker value={newItem.itemDate.replace(/-(\d+)-(\d+)$/, '/$2/$1').replace(/^(\d+)-/, '$2-').split('-').reverse().join('/') || ""} onChange={v => { const [dd,mm,yyyy] = v.split('/'); setNewItem(f => ({ ...f, itemDate: `${yyyy}-${mm}-${dd}` })); }} /></div>
              <div><FieldLabel>Thời gian</FieldLabel>
                <select value={newItem.timeSlot} onChange={e => setNewItem(f => ({ ...f, timeSlot: e.target.value as ItineraryTimeSlot }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b2f35]">
                  {(['MORNING','AFTERNOON','EVENING','ALL_DAY'] as ItineraryTimeSlot[]).map(s => <option key={s} value={s}>{TIME_SLOT_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div><FieldLabel>Hoạt động *</FieldLabel><TextInput value={newItem.activity} onChange={e => setNewItem(f => ({ ...f, activity: e.target.value }))} placeholder="Họp, di chuyển..." /></div>
            <div><FieldLabel>Địa điểm *</FieldLabel><TextInput value={newItem.location} onChange={e => setNewItem(f => ({ ...f, location: e.target.value }))} placeholder="Tên địa điểm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Danh mục</FieldLabel>
                <select value={newItem.category} onChange={e => setNewItem(f => ({ ...f, category: e.target.value as ItineraryCategory }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b2f35]">
                  {ITIN_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div><FieldLabel>Chi phí ước tính (đ)</FieldLabel><input type="number" min={0} value={newItem.estimatedCost ?? 0} onChange={e => setNewItem(f => ({ ...f, estimatedCost: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b2f35]" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">{saving ? "Đang thêm..." : "Thêm"}</button>
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg">Huỷ</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAddOpen(true)} className="text-sm font-semibold text-emerald-600 hover:underline">+ Thêm mục lịch trình</button>
        )
      )}
    </div>
  );
}

// ─── ApprovalItineraryPreview — read-only itinerary preview for approver ─────
function ApprovalItineraryPreview({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<BackendItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getItinerary(tripId).then(r => setItems(r.items)).catch(() => {}).finally(() => setLoading(false));
  }, [tripId]);
  if (loading) return <p className="text-xs text-gray-400">Đang tải lịch trình...</p>;
  if (items.length === 0) return <p className="text-xs text-gray-400">Chưa có lịch trình.</p>;
  const preview = items.slice(0, 5);
  return (
    <div className="flex flex-col gap-1.5">
      {preview.map(it => (
        <div key={it.id} className="flex gap-2 text-xs">
          <span className="text-gray-400 w-14 shrink-0">{TIME_SLOT_LABEL[it.timeSlot] ?? it.timeSlot}</span>
          <span className="font-medium text-[#1b2f35]">{it.activity}</span>
          <span className="text-gray-400">— {it.location}</span>
        </div>
      ))}
      {items.length > 5 && <p className="text-xs text-gray-400">...và {items.length - 5} mục khác</p>}
    </div>
  );
}

function VarianceTable({ items }: { items: ExpenseItem[] }) {
  const totalBudget = items.reduce((s, i) => s + i.budgeted, 0);
  const totalActual = items.reduce((s, i) => s + i.actual,   0);
  const totalDiff   = totalActual - totalBudget;
  const totalPct    = totalBudget > 0 ? ((totalDiff / totalBudget) * 100).toFixed(1) : "—";
  const catLabel    = (key: string) => EXPENSE_CATEGORIES.find(c => c.key === key)?.label || key;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Khoản mục</th>
            <th className="text-right py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Dự toán</th>
            <th className="text-right py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Thực tế</th>
            <th className="text-right py-2 pl-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Chênh lệch</th>
            <th className="text-right py-2 pl-3 text-xs font-bold text-gray-400 uppercase tracking-wider">%</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const diff = item.actual - item.budgeted;
            const pct  = item.budgeted > 0 ? ((diff / item.budgeted) * 100).toFixed(1) : item.actual > 0 ? "+inf" : "0";
            return (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-[#1b2f35]">{item.label}</p>
                  <p className="text-xs text-gray-400">{catLabel(item.category)}{item.description ? ` · ${item.description}` : ""}</p>
                </td>
                <td className="py-2.5 px-3 text-right text-gray-500">{item.budgeted.toLocaleString("vi-VN")}đ</td>
                <td className={`py-2.5 px-3 text-right font-semibold ${item.actual > item.budgeted ? "text-red-600" : "text-emerald-700"}`}>{item.actual.toLocaleString("vi-VN")}đ</td>
                <td className={`py-2.5 pl-3 text-right font-semibold ${diff > 0 ? "text-red-500" : diff < 0 ? "text-emerald-600" : "text-gray-400"}`}>
                  {diff > 0 ? `+${diff.toLocaleString("vi-VN")}` : diff < 0 ? `-${Math.abs(diff).toLocaleString("vi-VN")}` : "—"}đ
                </td>
                <td className={`py-2.5 pl-3 text-right text-[11px] font-bold ${diff > 0 ? "text-red-500" : diff < 0 ? "text-emerald-600" : "text-gray-400"}`}>
                  {diff !== 0 ? `${diff > 0 ? "+" : ""}${pct}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200">
            <td className="py-3 pr-4 font-bold text-[#1b2f35]">Tổng cộng</td>
            <td className="py-3 px-3 text-right font-bold text-gray-600">{totalBudget.toLocaleString("vi-VN")}đ</td>
            <td className={`py-3 px-3 text-right font-bold ${totalActual > totalBudget ? "text-red-600" : "text-emerald-700"}`}>{totalActual.toLocaleString("vi-VN")}đ</td>
            <td className={`py-3 pl-3 text-right font-bold ${totalDiff > 0 ? "text-red-500" : totalDiff < 0 ? "text-emerald-600" : "text-gray-400"}`}>
              {totalDiff !== 0 ? `${totalDiff > 0 ? "+" : ""}${totalDiff.toLocaleString("vi-VN")}đ` : "—"}
            </td>
            <td className={`py-3 pl-3 text-right text-xs font-bold ${totalDiff > 0 ? "text-red-500" : totalDiff < 0 ? "text-emerald-600" : "text-gray-400"}`}>
              {totalDiff !== 0 ? `${totalDiff > 0 ? "+" : ""}${totalPct}%` : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmployeeApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { trips, reload } = useTrips();
  const [screen, setScreen] = useState<"dashboard" | "create" | "success" | "itinerary" | "status" | "expense">("dashboard");
  const [selected, setSelected] = useState<Trip | null>(null);
  const [filter, setFilter] = useState<TripStatus | "all">("all");
  const myTrips = trips;

  if (screen === "create")    return <EmpCreate user={user} onLogout={onLogout} onSuccess={() => { void reload(); setScreen("success"); }} onCancel={() => setScreen("dashboard")} />;
  if (screen === "success")   return <EmpSuccess user={user} onLogout={onLogout} onBack={() => setScreen("dashboard")} />;
  if (screen === "itinerary" && selected) return <EmpItinerary user={user} onLogout={onLogout} trip={selected} onBack={() => setScreen("dashboard")} />;
  if (screen === "status"    && selected) return <EmpStatus    user={user} onLogout={onLogout} trip={selected} onBack={() => setScreen("dashboard")} />;
  if (screen === "expense"   && selected) return <EmpExpense   user={user} onLogout={onLogout} trip={selected} onBack={() => setScreen("dashboard")} onSave={async () => { await reload(); setScreen("dashboard"); }} />;

  const filtered = myTrips.filter(t => filter === "all" || t.status === filter);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label="Employee Dashboard" title="Chuyến công tác của bạn" subtitle="Theo dõi, tạo mới hoặc khai báo chi phí thực tế." action={<button onClick={() => setScreen("create")} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors">+ Tạo Trip Request</button>} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Status filter tab bar ── */}
        <div className="mb-5 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Row */}
          <div className="flex overflow-x-auto scrollbar-hide">
            {(
              [
                { key: "all",                                  label: "Tất cả",             color: "gray"    },
                { key: "SUBMITTED",                            label: "Chờ duyệt cấp 1",   color: "amber"   },
                { key: "APPROVED_MANAGER",                     label: "Đã duyệt cấp 1",    color: "teal"    },
                { key: "PENDING_ADMIN_APPROVAL",               label: "Chờ duyệt cấp 2",   color: "blue"    },
                { key: "APPROVED",                             label: "Đã duyệt",           color: "emerald" },
                { key: "TRIP_IN_PROGRESS",                     label: "Đang thực hiện",     color: "cyan"    },
                { key: "EXPENSE_SUBMITTED",                    label: "Đang quyết toán",    color: "purple"  },
                { key: "PENDING_MANAGER_ADDITIONAL_APPROVAL",  label: "Chờ Manager",        color: "orange"  },
                { key: "EXPENSE_APPROVED",                     label: "Chờ đóng hồ sơ",    color: "indigo"  },
                { key: "CLOSED",                               label: "Đã đóng",            color: "slate"   },
                { key: "REJECTED",                             label: "Từ chối",            color: "red"     },
              ] as { key: string; label: string; color: string }[]
            ).map((f, idx, arr) => {
              const count = f.key !== "all" ? myTrips.filter(t => t.status === f.key).length : myTrips.length;
              const active = filter === f.key;

              // colour palette per status
              const palette: Record<string, { tab: string; tabActive: string; badge: string; badgeActive: string }> = {
                gray:    { tab: "text-gray-500 hover:bg-gray-50 hover:text-gray-700",           tabActive: "bg-gray-100 text-gray-800",           badge: "bg-gray-200 text-gray-600",           badgeActive: "bg-gray-500 text-white"    },
                amber:   { tab: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",        tabActive: "bg-amber-100 text-amber-800",        badge: "bg-amber-200 text-amber-700",        badgeActive: "bg-amber-500 text-white"   },
                teal:    { tab: "text-teal-600 hover:bg-teal-50 hover:text-teal-700",           tabActive: "bg-teal-100 text-teal-800",          badge: "bg-teal-200 text-teal-700",          badgeActive: "bg-teal-600 text-white"    },
                blue:    { tab: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",           tabActive: "bg-blue-100 text-blue-800",          badge: "bg-blue-200 text-blue-700",          badgeActive: "bg-blue-500 text-white"    },
                emerald: { tab: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",  tabActive: "bg-emerald-100 text-emerald-800",    badge: "bg-emerald-200 text-emerald-700",    badgeActive: "bg-emerald-600 text-white" },
                cyan:    { tab: "text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700",           tabActive: "bg-cyan-100 text-cyan-800",          badge: "bg-cyan-200 text-cyan-700",          badgeActive: "bg-cyan-600 text-white"    },
                purple:  { tab: "text-purple-600 hover:bg-purple-50 hover:text-purple-700",     tabActive: "bg-purple-100 text-purple-800",      badge: "bg-purple-200 text-purple-700",      badgeActive: "bg-purple-600 text-white"  },
                orange:  { tab: "text-orange-600 hover:bg-orange-50 hover:text-orange-700",     tabActive: "bg-orange-100 text-orange-800",      badge: "bg-orange-200 text-orange-700",      badgeActive: "bg-orange-500 text-white"  },
                indigo:  { tab: "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",     tabActive: "bg-indigo-100 text-indigo-800",      badge: "bg-indigo-200 text-indigo-700",      badgeActive: "bg-indigo-600 text-white"  },
                slate:   { tab: "text-slate-500 hover:bg-slate-50 hover:text-slate-700",        tabActive: "bg-slate-100 text-slate-800",        badge: "bg-slate-200 text-slate-600",        badgeActive: "bg-slate-500 text-white"   },
                red:     { tab: "text-red-500 hover:bg-red-50 hover:text-red-700",              tabActive: "bg-red-100 text-red-800",            badge: "bg-red-200 text-red-600",            badgeActive: "bg-red-500 text-white"     },
              };
              const p = palette[f.color];

              // thin separator before "Đã đóng" and "Từ chối"
              const showDivider = idx > 0 && (f.key === "CLOSED" || f.key === "REJECTED");

              return (
                <div key={f.key} className="flex items-stretch shrink-0">
                  {showDivider && <div className="w-px bg-gray-200 my-2 mx-0.5 self-stretch" />}
                  <button
                    onClick={() => setFilter(f.key as typeof filter)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2 focus:outline-none
                      ${active
                        ? `${p.tabActive} border-current font-semibold`
                        : `${p.tab} border-transparent`
                      }
                      ${idx === 0 ? "rounded-tl-xl" : ""}
                      ${idx === arr.length - 1 ? "rounded-tr-xl" : ""}
                    `}
                  >
                    <span>{f.label}</span>
                    <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold transition-colors
                      ${active ? p.badgeActive : p.badge}
                    `}>
                      {count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-12">Không có chuyến công tác nào.</p>}
          {filtered.map(trip => (
            <Card key={trip.id} className="hover:shadow-md transition-shadow">
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-bold text-[#1b2f35] mb-1">
                    <span>{trip.from}</span><span className="text-emerald-500">→</span><span>{trip.to}</span>
                    {trip.urgent && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200">Khẩn cấp</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    <span className="font-medium text-gray-500">{trip.tripCode}</span>
                    <span>·</span><span>{trip.departDate} – {trip.returnDate}</span>
                    <span>·</span><span>{trip.budget.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button onClick={() => { setSelected(trip); setScreen("status"); }} className="text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">Trạng thái</button>
                  {trip.status === "APPROVED" && (
                    <>
                      <button onClick={() => { setSelected(trip); setScreen("itinerary"); }} className="text-sm font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">Lịch trình</button>
                      <button onClick={() => void reload()} className="text-sm font-medium text-cyan-700 border border-cyan-200 hover:bg-cyan-50 px-3 py-1.5 rounded-lg transition-colors">Bắt đầu chuyến đi</button>
                    </>
                  )}
                  {trip.status === "TRIP_IN_PROGRESS" && (
                    <>
                      <button onClick={() => { setSelected(trip); setScreen("itinerary"); }} className="text-sm font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">Lịch trình</button>
                      <button onClick={() => { setSelected(trip); setScreen("expense"); }} className="text-sm font-medium text-purple-700 border border-purple-200 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors">Khai chi phí</button>
                    </>
                  )}
                  {(trip.status === "EXPENSE_SUBMITTED" || trip.status === "PENDING_MANAGER_ADDITIONAL_APPROVAL" || trip.status === "EXPENSE_APPROVED" || trip.status === "CLOSED") && (
                    <button onClick={() => { setSelected(trip); setScreen("expense"); }} className="text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">{trip.status === "CLOSED" || trip.status === "EXPENSE_APPROVED" ? "Xem chi phí" : "Xem báo cáo"}</button>
                  )}
                  <StatusBadge status={trip.status} violations={trip.policyViolations} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function EmpCreate({ user, onLogout, onSuccess, onCancel }: {
  user: User; onLogout: () => void; onSuccess: () => void; onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  // BUG-06: state lưu tripId sau khi tạo DRAFT và itinerary thật từ AI
  const [draftTripId, setDraftTripId] = useState<string | null>(null);
  const [aiItinerary, setAiItinerary] = useState<ItineraryDay[]>([]);
  const [aiError, setAiError] = useState("");
  const [form, setForm] = useState({ from: "", to: "", departDate: "", returnDate: "", purpose: "", budget: "", urgent: false, urgentReason: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(v => ({ ...v, [f]: e.target.value }));
    setErrs(p => { const n = { ...p }; delete n[f]; return n; });
  };

  const budget = Number(form.budget) || 0;
  const deptD  = parseDMY(form.departDate);
  const retD   = parseDMY(form.returnDate);
  const tripDays = deptD && retD && retD > deptD ? Math.ceil((retD.getTime() - deptD.getTime()) / 86_400_000) : 0;
  const violations = checkPolicy(budget, form.departDate, form.to, tripDays, 0, user.title);
  const isLateSubmission = violations.some(v => v.code === "LATE_SUBMISSION");

  function validateStep0(): boolean {
    const e: Record<string, string> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (!form.from.trim()) e.from = "Vui lòng nhập điểm xuất phát.";
    if (!form.to.trim()) e.to = "Vui lòng nhập điểm đến.";
    else if (form.from.trim() && form.from.trim().toLowerCase() === form.to.trim().toLowerCase()) e.to = "Điểm đến phải khác điểm xuất phát.";

    if (!form.departDate) {
      e.departDate = "Vui lòng chọn ngày đi.";
    } else if (!deptD) {
      e.departDate = "Ngày đi không hợp lệ.";
    } else if (deptD < today) {
      e.departDate = "Ngày đi không thể là ngày trong quá khứ.";
    }

    if (!form.returnDate) {
      e.returnDate = "Vui lòng chọn ngày về.";
    } else if (!retD) {
      e.returnDate = "Ngày về không hợp lệ.";
    } else if (retD < today) {
      e.returnDate = "Ngày về không thể là ngày trong quá khứ.";
    } else if (deptD && retD <= deptD) {
      e.returnDate = "Ngày về phải sau ngày đi ít nhất 1 ngày.";
    }

    if (!form.purpose.trim()) e.purpose = "Vui lòng nhập mục đích chuyến đi.";
    else if (form.purpose.trim().length < 10) e.purpose = "Mục đích phải có ít nhất 10 ký tự.";

    const b = Number(form.budget.replace(/[^0-9]/g, ""));
    if (!form.budget.trim()) e.budget = "Vui lòng nhập ngân sách dự kiến.";
    else if (isNaN(b) || b <= 0) e.budget = "Ngân sách phải là số dương.";

    if (isLateSubmission && !form.urgent) e.urgent = "Phải xác nhận đây là chuyến đi khẩn cấp.";
    if (isLateSubmission && form.urgent && !form.urgentReason.trim()) e.urgentReason = "Vui lòng nhập lý do khẩn cấp.";

    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (step === 0 && !validateStep0()) return;
    setStep(s => s + 1);
  }

  async function submit() {
    try {
      let tripId = draftTripId;
      if (!tripId) {
        // Trip chưa được tạo (user bỏ qua bước AI) — tạo mới rồi submit
        const [dd1, mm1, yyyy1] = form.departDate.split("/");
        const [dd2, mm2, yyyy2] = form.returnDate.split("/");
        const destinationType = MAJOR_CITIES.some(c => form.to.toLowerCase().includes(c))
          ? "TIER1_CITY" : "OTHER";
        const created = await createTrip({
          origin: form.from,
          destination: form.to,
          destinationType,
          departureDate: `${yyyy1}-${mm1}-${dd1}`,
          returnDate: `${yyyy2}-${mm2}-${dd2}`,
          purpose: form.purpose,
          estimatedBudget: budget,
          ...(form.urgent || isLateSubmission
            ? { urgencyReason: form.urgentReason || undefined }
            : {}),
        });
        tripId = created.id;
      }
      await submitTrip(tripId);
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể tạo yêu cầu.");
    }
  }

  const STEP_LABELS = ["01  Thông tin chuyến đi", "02  Lịch trình (AI gợi ý)", "03  Xem lại & Gửi duyệt"];
  const perDiem = tripDays > 0 && form.to ? `${(tripDays * perDiemRate(form.to)).toLocaleString("vi-VN")}đ (${tripDays} ngày × ${perDiemRate(form.to).toLocaleString("vi-VN")}đ)` : "";
  const canGenerateAI = !!(form.from.trim() && form.to.trim() && form.departDate.trim() && form.returnDate.trim() && form.purpose.trim() && form.budget.trim());

  const fieldErr = (k: string) => errs[k] ? <p className="text-xs text-red-500 mt-1">{errs[k]}</p> : null;
  const inputCls = (k: string) => `w-full border rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] focus:border-transparent transition ${errs[k] ? "border-red-300 bg-red-50" : "border-gray-200"}`;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-500 uppercase mb-2">New Trip Request</p>
          <h1 className="text-3xl font-bold text-[#1b2f35] mb-3">Tạo yêu cầu công tác</h1>
          <p className="text-sm text-gray-500 mb-8">Hoàn tất 3 bước — hệ thống tự kiểm tra chính sách trước khi nộp.</p>
          <div className="bg-[#1b2f35] -mx-4 sm:-mx-6 px-4 sm:px-6 flex overflow-x-auto mt-1">
            {STEP_LABELS.map((s, i) => (
              <button
                key={i}
                onClick={() => i < step && setStep(i)}
                className={[
                  "flex-1 min-w-[220px] py-3.5 px-2 text-sm font-medium whitespace-nowrap transition-colors text-center",
                  i === step ? "text-amber-400" : i < step ? "text-gray-200" : "text-gray-500",
                  i < step ? "hover:text-white" : ""
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <datalist id="vietnam-provinces">
        {VIETNAM_PROVINCES.map((province) => (
          <option key={province} value={province} />
        ))}
      </datalist>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="border border-gray-200 rounded-xl p-6 sm:p-8 max-w-2xl mx-auto bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Điểm xuất phát <span className="text-red-400">*</span></FieldLabel>
                  <input list="vietnam-provinces" value={form.from} onChange={set("from")} placeholder="Đà Nẵng" className={inputCls("from")} />
                  {fieldErr("from")}
                </div>
                <div>
                  <FieldLabel>Điểm đến <span className="text-red-400">*</span></FieldLabel>
                  <input list="vietnam-provinces" value={form.to} onChange={set("to")} placeholder="TP. Hồ Chí Minh" className={inputCls("to")} />
                  {fieldErr("to")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Ngày đi <span className="text-red-400">*</span></FieldLabel>
                  <DatePicker value={form.departDate} onChange={v => { setForm(f => ({ ...f, departDate: v })); setErrs(p => { const n={...p}; delete n.departDate; return n; }); }} />
                  {fieldErr("departDate")}
                </div>
                <div>
                  <FieldLabel>Ngày về <span className="text-red-400">*</span></FieldLabel>
                  <DatePicker value={form.returnDate} onChange={v => { setForm(f => ({ ...f, returnDate: v })); setErrs(p => { const n={...p}; delete n.returnDate; return n; }); }} />
                  {fieldErr("returnDate")}
                </div>
              </div>
              {perDiem && (
                <div className="px-3.5 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-700">
                  Hạn mức phụ cấp công tác (BR-TR-02): <span className="font-semibold">{perDiem}</span>
                </div>
              )}
              <div>
                <FieldLabel>Mục đích chuyến đi <span className="text-red-400">*</span></FieldLabel>
                <textarea value={form.purpose} onChange={set("purpose")} rows={3} placeholder="Mô tả mục đích chi tiết (tối thiểu 10 ký tự)..." className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] focus:border-transparent resize-none transition ${errs.purpose ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
                <div className="flex justify-between mt-1">
                  {fieldErr("purpose") || <span />}
                  <span className={`text-xs ${form.purpose.trim().length < 10 ? "text-gray-400" : "text-emerald-600"}`}>{form.purpose.trim().length}/10</span>
                </div>
              </div>
              <div>
                <FieldLabel>Ngân sách dự kiến (VNĐ) <span className="text-red-400">*</span></FieldLabel>
                <input type="number" min={0} value={form.budget} onChange={set("budget")} placeholder="Ví dụ: 8000000" className={inputCls("budget")} />
                {budget > 0 && <p className="text-xs text-gray-400 mt-1">{budget.toLocaleString("vi-VN")} đồng</p>}
                {fieldErr("budget")}
              </div>
              {isLateSubmission && (
                <div className="flex flex-col gap-2 p-3.5 rounded-lg border border-red-200 bg-red-50">
                  <p className="text-xs font-semibold text-red-700">Chuyến đi dưới 3 ngày làm việc — bắt buộc đánh dấu khẩn cấp và nhập lý do (BR-TR-03).</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.urgent} onChange={e => { setForm(v => ({ ...v, urgent: e.target.checked })); setErrs(p => { const n={...p}; delete n.urgent; return n; }); }} className="w-4 h-4 accent-red-600" />
                    <span className="text-xs font-semibold text-red-700">Xác nhận đây là chuyến đi khẩn cấp (Urgent Trip)</span>
                  </label>
                  {errs.urgent && <p className="text-xs text-red-500">{errs.urgent}</p>}
                  {form.urgent && (
                    <>
                      <textarea value={form.urgentReason} onChange={set("urgentReason")} rows={2} placeholder="Lý do khẩn cấp..." className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-400 resize-none ${errs.urgentReason ? "border-red-400" : "border-red-200"}`} />
                      {fieldErr("urgentReason")}
                    </>
                  )}
                </div>
              )}
              {(form.budget || form.departDate) && violations.filter(v => v.code !== "PER_DIEM_NOTE" && v.code !== "LATE_SUBMISSION").length > 0 && (
                <PolicyBanner violations={violations.filter(v => v.code !== "PER_DIEM_NOTE" && v.code !== "LATE_SUBMISSION")} />
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              {!aiGenerated ? (
                <div>
                  <p className="text-sm text-gray-500 mb-5">Hệ thống sẽ gợi ý lịch trình dựa trên điểm đến, số ngày và ngân sách bạn nhập.</p>
                  {!canGenerateAI && (
                    <div className="mb-4 px-3.5 py-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700">
                      Vui lòng điền đầy đủ thông tin chuyến đi ở bước 1 trước khi sinh lịch trình AI.
                    </div>
                  )}
                  <button onClick={async () => {
                    if (!canGenerateAI) return;
                    setGenerating(true);
                    setAiError("");
                    try {
                      // BUG-06: Tạo trip DRAFT trước nếu chưa có, để lấy tripId gọi AI
                      let tripId = draftTripId;
                      if (!tripId) {
                        const [dd1, mm1, yyyy1] = form.departDate.split("/");
                        const [dd2, mm2, yyyy2] = form.returnDate.split("/");
                        const destinationType = MAJOR_CITIES.some(c => form.to.toLowerCase().includes(c))
                          ? "TIER1_CITY" : "OTHER";
                        const created = await createTrip({
                          origin: form.from,
                          destination: form.to,
                          destinationType,
                          departureDate: `${yyyy1}-${mm1}-${dd1}`,
                          returnDate: `${yyyy2}-${mm2}-${dd2}`,
                          purpose: form.purpose,
                          estimatedBudget: budget,
                          ...(form.urgent || isLateSubmission
                            ? { urgencyReason: form.urgentReason || undefined }
                            : {}),
                        });
                        tripId = created.id;
                        setDraftTripId(tripId);
                      }
                      // Gọi AI API thật (POST /ai/generate-itinerary)
                      const result = await generateAiItinerary({
                        tripId,
                        destination: form.to,
                        days: tripDays,
                        budget,
                      });
                      setAiItinerary(aiItemsToItineraryDays(result.items));
                      setAiGenerated(true);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Không thể sinh lịch trình.";
                      setAiError(msg);
                    } finally {
                      setGenerating(false);
                    }
                  }} disabled={generating || !canGenerateAI} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b2f35] hover:bg-[#243d45] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {generating ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Đang sinh...</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>Sinh lịch trình bằng AI</>}
                  </button>
                  {aiError && (
                    <div className="mt-3 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                      <span className="font-semibold">Lỗi sinh lịch trình: </span>{aiError}
                      <span className="ml-1 text-gray-500">(Bạn vẫn có thể tiếp tục và bổ sung lịch trình sau.)</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Lịch trình AI gợi ý</p>
                      <p className="text-sm text-gray-500 mt-0.5">{form.from} — {form.to}</p>
                    </div>
                    <div className="flex gap-2">
                      <ExportBtn label="Xuất PDF" />
                      <button onClick={() => { setAiGenerated(false); setAiError(""); }} className="text-xs text-emerald-600 hover:underline">Sinh lại</button>
                    </div>
                  </div>
                  {/* BUG-06: dùng aiItinerary từ API thật thay vì AI_ITINERARY static */}
                  <ItineraryList initial={aiItinerary} departDate={form.departDate} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4">Xem lại trước khi gửi</p>
              {violations.filter(v => v.code !== "PER_DIEM_NOTE").length > 0 && (
                <PolicyBanner violations={violations.filter(v => v.code !== "PER_DIEM_NOTE")} />
              )}
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm flex flex-col gap-2.5 mb-4">
                {[ ["Điểm đi", form.from], ["Điểm đến", form.to], ["Ngày đi", form.departDate], ["Ngày về", form.returnDate], ["Số ngày", `${tripDays} ngày`], ["Mục đích", form.purpose] ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4"><span className="text-gray-400">{k}</span><span className="font-medium text-right">{v}</span></div>
                ))}
                <div className="flex justify-between gap-4 border-t border-gray-200 pt-2.5">
                  <span className="text-gray-400">Ngân sách</span>
                  <span className="font-bold text-emerald-700">{budget.toLocaleString("vi-VN")}đ</span>
                </div>
                {(form.urgent || isLateSubmission) && form.urgentReason && (
                  <div className="flex justify-between gap-4 border-t border-gray-200 pt-2.5">
                    <span className="text-gray-400">Lý do khẩn cấp</span>
                    <span className="font-medium text-right text-red-600">{form.urgentReason}</span>
                  </div>
                )}
              </div>
              {budget > 20_000_000 && (
                <div className="px-3.5 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-700 mb-3">
                  Ngân sách &gt;20M: sau khi Manager duyệt, yêu cầu sẽ chuyển tự động đến Travel Admin phê duyệt cấp 2.
                </div>
              )}
              {isLateSubmission && !form.urgentReason.trim() && (
                <div className="px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                  Chuyến đi khẩn cấp — lý do khẩn cấp bắt buộc. Quay lại bước 1 để bổ sung.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-gray-100">
            <button onClick={step === 0 ? onCancel : () => setStep(s => s - 1)} className="px-5 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {step === 0 ? "Huỷ" : "Quay lại"}
            </button>
            <div className="flex gap-2">
              <button className="px-5 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Lưu nháp</button>
              {step < 2 ? <button onClick={goNext} className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg shadow-sm transition-colors">Tiếp tục</button> : <button onClick={submit} disabled={isLateSubmission && (!form.urgent || !form.urgentReason.trim())} className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Gửi yêu cầu duyệt</button>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmpSuccess({ user, onLogout, onBack }: { user: User; onLogout: () => void; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <main className="flex flex-col items-center justify-center px-4 py-20 gap-8 max-w-xl mx-auto">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1b2f35] mb-2">Đã gửi yêu cầu duyệt</h1>
            <p className="text-sm text-gray-500">Yêu cầu đã được tạo và chuyển đến Manager phê duyệt.</p>
          </div>
        </div>
        <div className="w-full bg-[#1b2f35] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center">
            {["Nộp đơn", "Manager", "Admin (nếu >20M)", "Duyệt"].map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 min-w-[56px]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : "bg-[#2a3f4a] text-gray-500 border border-gray-600"}`}>{i + 1}</div>
                  <span className="text-xs font-semibold tracking-wide text-gray-400 text-center leading-snug">{s}</span>
                </div>
                {i < 3 && <div className={`flex-1 h-px mx-1 mb-5 ${i === 0 ? "bg-amber-400" : "bg-gray-600"}`} />}
              </div>
            ))}
          </div>
        </div>
        <button onClick={onBack} className="px-8 py-3 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-xl shadow-sm transition-colors">Về Dashboard</button>
      </main>
    </div>
  );
}

function EmpItinerary({ user, onLogout, trip, onBack }: { user: User; onLogout: () => void; trip: Trip; onBack: () => void }) {
  const readOnly = trip.status === "CLOSED";
  const [items, setItems] = useState<BackendItineraryItem[]>([]);
  const [itinLoading, setItinLoading] = useState(true);
  const [itinError, setItinError] = useState("");

  const reloadItin = async () => {
    try {
      const r = await getItinerary(trip.id);
      setItems(r.items);
    } catch {
      setItinError("Không thể tải lịch trình.");
    } finally {
      setItinLoading(false);
    }
  };

  useEffect(() => { void reloadItin(); }, [trip.id]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title={`${trip.from} — ${trip.to}`} subtitle={`${trip.departDate} – ${trip.returnDate} · Lịch trình`} action={<ExportBtn />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Về Dashboard</button></div>
        <Card className="p-6 sm:p-8 max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-5">Lịch trình chuyến đi</p>
          {readOnly && <p className="text-xs text-gray-400 mb-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">Hồ sơ đã đóng — dữ liệu lịch trình ở chế độ chỉ đọc.</p>}
          {itinLoading && <p className="text-sm text-gray-400 py-8 text-center">Đang tải lịch trình...</p>}
          {itinError && <p className="text-sm text-red-500 py-4 text-center">{itinError}</p>}
          {!itinLoading && !itinError && (
            <ItineraryListServer
              items={items}
              tripId={trip.id}
              departDate={trip.departDate}
              readOnly={readOnly}
              onAdd={async (input) => { await addItineraryItem(trip.id, input); await reloadItin(); }}
              onUpdate={async (itemId, input) => { await updateItineraryItem(trip.id, itemId, input); await reloadItin(); }}
              onDelete={async (itemId) => { await deleteItineraryItem(trip.id, itemId); await reloadItin(); }}
            />
          )}
        </Card>
      </main>
    </div>
  );
}

function EmpStatus({ user, onLogout, trip, onBack }: { user: User; onLogout: () => void; trip: Trip; onBack: () => void }) {
  const flow = [
    { label: "Đã nộp", desc: `Nộp lúc ${trip.submittedAt}`, done: true },
    { label: "Duyệt cấp 1 (Manager)", desc: trip.managerNote || "Chờ Manager phê duyệt", done: !!trip.managerApproved, rejected: trip.status === "REJECTED" && !trip.adminApproved },
    { label: "Duyệt cấp 2 (Admin)", desc: trip.adminNote || (needsAdminApproval(trip) ? "Cần phê duyệt cấp 2" : "Không bắt buộc"), done: !!trip.adminApproved, skipped: trip.status === "APPROVED" && !needsAdminApproval(trip) },
    { label: "Đã duyệt", desc: ["APPROVED","TRIP_IN_PROGRESS"].includes(trip.status) ? "Chuyến đi được phê duyệt" : "Chờ hoàn tất phê duyệt", done: ["APPROVED","TRIP_IN_PROGRESS","EXPENSE_SUBMITTED","PENDING_MANAGER_ADDITIONAL_APPROVAL","EXPENSE_APPROVED","CLOSED"].includes(trip.status) },
    { label: "Quyết toán chi phí", desc: ["EXPENSE_SUBMITTED","PENDING_MANAGER_ADDITIONAL_APPROVAL","EXPENSE_APPROVED","CLOSED"].includes(trip.status) ? "Đã nộp báo cáo chi phí" : "Sau chuyến đi nộp chi phí thực tế", done: ["EXPENSE_SUBMITTED","PENDING_MANAGER_ADDITIONAL_APPROVAL","EXPENSE_APPROVED","CLOSED"].includes(trip.status) },
    { label: "Đóng hồ sơ", desc: trip.financeNote || "Finance xem xét và đóng hồ sơ", done: trip.status === "CLOSED" },
  ];
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title={`${trip.from} — ${trip.to}`} subtitle="Theo dõi trạng thái phê duyệt" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Về Dashboard</button></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-6 lg:col-span-2">
            <div className="flex flex-col gap-0">
              {flow.map((s, i) => (
                <div key={s.label} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.rejected ? "bg-red-100 text-red-500 border-2 border-red-300" : s.skipped ? "bg-gray-100 text-gray-400 border border-dashed border-gray-300" : s.done ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                      {s.rejected ? "×" : s.skipped ? "—" : s.done ? "✓" : i + 1}
                    </div>
                    {i < flow.length - 1 && <div className={`w-0.5 h-8 mt-1 ${s.done ? "bg-emerald-400" : "bg-gray-200"}`} />}
                  </div>
                  <div className="pb-5">
                    <p className={`text-sm font-semibold ${s.rejected ? "text-red-500" : s.skipped ? "text-gray-400" : s.done ? "text-emerald-700" : "text-gray-400"}`}>
                      {s.label}{s.skipped ? " (bỏ qua)" : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex flex-col gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Trạng thái</p>
              <StatusBadge status={trip.status} violations={trip.policyViolations} />
            </Card>
            {trip.policyViolations && trip.policyViolations.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Cảnh báo chính sách</p>
                <PolicyBanner violations={trip.policyViolations} />
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmpExpense({ user, onLogout, trip, onBack, onSave }: {
  user: User; onLogout: () => void; trip: Trip; onBack: () => void; onSave: () => Promise<void>;
}) {
  const readOnly = trip.status === "CLOSED" || trip.status === "EXPENSE_APPROVED" || trip.status === "EXPENSE_SUBMITTED" || trip.status === "PENDING_MANAGER_ADDITIONAL_APPROVAL";
  const [expense, setExpense] = useState<BackendExpense | null>(null);
  const [expLoading, setExpLoading] = useState(true);
  const [saveErr, setSaveErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reload expense from server
  const reloadExpense = async () => {
    try {
      const data = await getExpense(trip.id);
      setExpense(data);
    } catch {
      // No expense yet — that's fine for APPROVED/TRIP_IN_PROGRESS
      setExpense(null);
    } finally {
      setExpLoading(false);
    }
  };

  useEffect(() => { void reloadExpense(); }, [trip.id]);

  // Map backend items to UI ExpenseItem shape
  const items: ExpenseItem[] = (expense?.items ?? []).map(i => ({
    id: i.id,
    date: new Date(i.expenseDate).toLocaleDateString("vi-VN"),
    category: mapBackendCategory(i.category),
    label: i.description,
    description: i.description,
    budgeted: 0,            // backend expense model has no per-item budget
    actual: i.amount,
    receipt: i.receiptUrl ?? "",
  }));

  const totalActual = expense?.totalActual ?? 0;
  const totalBudgeted = expense?.estimatedBudgetSnapshot ?? trip.budget;
  const diff = totalActual - totalBudgeted;
  const overPct = totalBudgeted > 0 ? (diff / totalBudgeted) * 100 : 0;

  async function handleSave() {
    setSaveErr("");
    setSubmitting(true);
    try {
      // Ensure expense header exists
      let exp = expense;
      if (!exp) {
        exp = await createExpense(trip.id);
        setExpense(exp);
      }
      // Submit
      await submitExpense(trip.id);
      await onSave();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Không thể nộp báo cáo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (expLoading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Nav user={user} onLogout={onLogout} />
        <main className="flex items-center justify-center py-20">
          <p className="text-sm text-gray-400">Đang tải chi phí...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title="Khai báo chi phí thực tế" subtitle={`${trip.from} — ${trip.to} · ${trip.departDate} – ${trip.returnDate}`} action={<ExportBtn />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Về Dashboard</button></div>
        {readOnly && (
          <div className="max-w-3xl mb-4 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">
            {trip.status === "CLOSED" ? "Hồ sơ đã đóng — dữ liệu ở chế độ chỉ đọc." : trip.status === "EXPENSE_APPROVED" ? "Finance đã phê duyệt chi phí — đang chờ đóng hồ sơ." : "Báo cáo đã nộp — đang chờ Finance xem xét."}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card className="p-6">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4">Từng khoản chi phí</p>
              {items.length === 0 && !readOnly && (
                <p className="text-sm text-gray-400 mb-4">Chưa có khoản chi nào. Hãy thêm chi phí bên dưới.</p>
              )}
              <div className="flex flex-col gap-3">
                {items.map(item => (
                  <div key={item.id} className="border rounded-xl p-4 border-gray-100 bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{item.category}</span>
                      <span className="text-sm font-bold text-[#1b2f35]">{item.actual.toLocaleString("vi-VN")}đ</span>
                    </div>
                    <p className="text-sm text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.date}</p>
                  </div>
                ))}
              </div>
              {!readOnly && <ExpenseItemForm tripId={trip.id} onAdded={reloadExpense} />}
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Tóm tắt</p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Dự toán</span><span className="font-medium">{totalBudgeted.toLocaleString("vi-VN")}đ</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Thực tế</span><span className="font-bold text-[#1b2f35]">{totalActual.toLocaleString("vi-VN")}đ</span></div>
                <div className={`flex justify-between border-t border-gray-100 pt-2 font-bold ${diff > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  <span>{diff > 0 ? "Vượt ngân sách" : "Tiết kiệm"}</span>
                  <span>{Math.abs(diff).toLocaleString("vi-VN")}đ</span>
                </div>
                {overPct !== 0 && (
                  <p className={`text-xs text-right ${overPct > 10 ? "text-red-500" : "text-gray-400"}`}>
                    {overPct > 0 ? "+" : ""}{overPct.toFixed(1)}%
                    {overPct > 10 && " — Finance yêu cầu giải trình"}
                  </p>
                )}
              </div>
            </Card>
            {!readOnly && (
              <>
                {saveErr && <p className="text-xs text-red-500 text-center font-medium px-2">{saveErr}</p>}
                <button onClick={handleSave} disabled={submitting || items.length === 0} className="w-full py-3 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-xl shadow-sm transition-colors disabled:opacity-50">
                  {submitting ? "Đang gửi..." : "Gửi báo cáo chi phí"}
                </button>
              </>
            )}
            <button onClick={onBack} className="w-full py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Quay lại</button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ManagerApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { trips, reload } = useTrips();
  // BUG-10: Lấy dashboard stats từ backend API thay vì tự tính
  const { data: dash, reload: reloadDash } = useDashboard<ManagerDashboard>();
  const [selected, setSelected] = useState<Trip | null>(null);

  const queue      = trips.filter(t => t.status === "SUBMITTED");
  const addlQueue  = trips.filter(t => t.status === "PENDING_MANAGER_ADDITIONAL_APPROVAL");
  const recent     = trips.filter(t => ["PENDING_ADMIN_APPROVAL","APPROVED","REJECTED"].includes(t.status));

  async function approve(note: string) {
    if (!selected) return;
    try { await approveTrip(selected.id, note || "Đã phê duyệt"); await reload(); void reloadDash(); }
    catch (err) { alert(err instanceof Error ? err.message : "Lỗi phê duyệt."); }
    setSelected(null);
  }

  async function reject(note: string) {
    if (!selected || !note.trim()) return;
    try { await rejectTrip(selected.id, note); await reload(); void reloadDash(); }
    catch (err) { alert(err instanceof Error ? err.message : "Lỗi từ chối."); }
    setSelected(null);
  }

  const [addlSelected, setAddlSelected] = useState<Trip | null>(null);

  async function approveAdditional(note: string) {
    if (!addlSelected || !note.trim()) return;
    try { await reapproveExpense(addlSelected.id, note); await reload(); void reloadDash(); }
    catch (err) { alert(err instanceof Error ? err.message : "Lỗi phê duyệt bổ sung."); }
    setAddlSelected(null);
  }

  if (selected) return <ApprovalDetail user={user} onLogout={onLogout} trip={selected} level={1} onApprove={approve} onReject={reject} onBack={() => setSelected(null)} />;
  if (addlSelected) return <ApprovalDetail user={user} onLogout={onLogout} trip={addlSelected} level={1} onApprove={approveAdditional} onReject={async (note) => { try { await rejectExpense(addlSelected.id, note); await reload(); void reloadDash(); } catch(err) { alert(err instanceof Error ? err.message : "Lỗi."); } setAddlSelected(null); }} onBack={() => setAddlSelected(null)} additionalApproval />;

  // Stats từ dashboard API
  const teamTotal   = dash?.teamTrips.total ?? trips.filter(t => t.employeeId !== user.id).length;
  const pendingCount = dash?.pendingApprovals.count ?? queue.length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label="Manager Dashboard" title="Phê duyệt yêu cầu cấp 1" subtitle="Ghi chú là bắt buộc khi duyệt hoặc từ chối." />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Stats từ /dashboard API — BUG-10 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["Chờ duyệt cấp 1", pendingCount, "text-amber-600"],
            ["Tổng team trips",  teamTotal,    "text-teal-700"],
            ["Thông báo chưa đọc", dash?.notifications.unreadCount ?? "—", "text-violet-600"],
          ].map(([k, v, c]) => (
            <Card key={String(k)} className="p-4"><p className="text-xs text-gray-400 mb-1">{k}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></Card>
          ))}
        </div>
        {addlQueue.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-semibold text-orange-700">Duyệt bổ sung chi phí (BR-TR-05)</p>
              <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{addlQueue.length}</span>
            </div>
            <div className="mb-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">Chi phí thực tế vượt dự toán &gt;10% — Finance đang chờ Manager phê duyệt bổ sung trước khi đóng hồ sơ.</div>
            <div className="flex flex-col gap-3">{addlQueue.map(t => <TripCard key={t.id} trip={t} cta="Duyệt bổ sung" onClick={() => setAddlSelected(t)} />)}</div>
          </section>
        )}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-base font-semibold text-[#1b2f35]">Chờ phê duyệt Cấp 1</p>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{queue.length}</span>
          </div>
          {queue.length === 0 && <div className="text-sm text-gray-400 py-8 text-center bg-white rounded-xl border border-gray-200">Không có yêu cầu nào đang chờ.</div>}
          <div className="flex flex-col gap-3">{queue.map(t => <TripCard key={t.id} trip={t} cta="Xem & duyệt" onClick={() => setSelected(t)} />)}</div>
        </section>
        {recent.length > 0 && (
          <section>
            <p className="text-sm font-bold text-[#1b2f35] mb-3">Đã xử lý gần đây</p>
            <div className="flex flex-col gap-3">{recent.map(t => <TripCard key={t.id} trip={t} />)}</div>
          </section>
        )}
      </main>
    </div>
  );
}

function ApprovalDetail({ user, onLogout, trip, level, onApprove, onReject, onBack, additionalApproval = false }: {
  user: User; onLogout: () => void; trip: Trip; level: 1 | 2;
  onApprove: (note: string) => void; onReject: (note: string) => void; onBack: () => void;
  additionalApproval?: boolean;
}) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");

  function tryApprove() { setNoteError(""); onApprove(note); }
  function tryReject()  { if (!note.trim()) { setNoteError("Lý do từ chối là bắt buộc."); return; } setNoteError(""); onReject(note); }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title={`${trip.from} — ${trip.to}`} subtitle={`${trip.departDate} – ${trip.returnDate} · ${trip.employeeName} · Duyệt cấp ${level}`} action={<ExportBtn />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Quay lại</button></div>
        {trip.policyViolations && trip.policyViolations.length > 0 && <div className="max-w-3xl mb-4"><PolicyBanner violations={trip.policyViolations} /></div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Thông tin chuyến đi</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {[
                  ["Nhân viên", trip.employeeName],
                  ["Từ", trip.from], ["Đến", trip.to],
                  ["Ngày đi", trip.departDate], ["Ngày về", trip.returnDate],
                  ["Ngân sách", `${trip.budget.toLocaleString("vi-VN")}đ${trip.budget > 20_000_000 ? " (>20M)" : ""}`],
                  ...(trip.urgent ? [["Loại", "Chuyến đi khẩn cấp"]] : []),
                  ...(trip.urgentReason ? [["Lý do khẩn cấp", trip.urgentReason]] : []),
                  ...(trip.managerNote ? [["Ghi chú Manager", trip.managerNote]] : []),
                ].map(([k, v]) => (
                  <div key={k}><span className="text-gray-400 text-xs">{k}</span>
                    <p className={`font-medium ${k === "Ngân sách" && trip.budget > 20_000_000 ? "text-amber-600" : k === "Loại" ? "text-red-600" : "text-[#1b2f35]"}`}>{v}</p>
                  </div>
                ))}
              </div>
              {needsAdminApproval(trip) && level === 1 && (
                <div className="mt-3 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg">
                  Sau khi Manager duyệt, yêu cầu này sẽ chuyển Travel Admin phê duyệt cấp 2.
                </div>
              )}
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Mục đích chuyến đi</p>
              <p className="text-sm text-gray-600 leading-relaxed">{trip.purpose}</p>
            </Card>
            {level === 1 && (
              <Card className="p-5">
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Lịch trình (xem trước)</p>
                <ApprovalItineraryPreview tripId={trip.id} />
              </Card>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">
                Quyết định cấp {level}
              </p>
              <div className="mb-3">
                <FieldLabel>Ghi chú / Lý do <span className="text-gray-400 font-normal text-xs">(bắt buộc khi từ chối)</span></FieldLabel>
                <textarea value={note} onChange={e => { setNote(e.target.value); setNoteError(""); }} rows={4} placeholder="Nhập ghi chú hoặc lý do từ chối..." className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] resize-none transition ${noteError ? "border-red-300" : "border-gray-200"}`} />
                {noteError && <p className="text-xs text-red-500 mt-1">{noteError}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={tryApprove} className={`w-full py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${additionalApproval ? "bg-orange-600 hover:bg-orange-700" : level === 1 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-violet-600 hover:bg-violet-700"}`}>
                  {additionalApproval ? "Duyệt bổ sung chi phí" : level === 1 ? "Phê duyệt cấp 1" : "Phê duyệt cấp 2"}
                </button>
                <button onClick={tryReject} className="w-full py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Từ chối</button>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Trạng thái</p>
              <StatusBadge status={trip.status} violations={trip.policyViolations} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { trips, reload } = useTrips();
  // BUG-10: Lấy dashboard stats từ backend API
  const { data: dash, reload: reloadDash } = useDashboard<TravelAdminDashboard>();
  const [selected, setSelected] = useState<Trip | null>(null);
  const [tab, setTab] = useState<"queue" | "all">("queue");

  const queue = trips.filter(t => t.status === "PENDING_ADMIN_APPROVAL");
  const all   = trips;

  async function approve(note: string) {
    if (!selected || !note.trim()) return;
    try { await approveTrip(selected.id, note); await reload(); void reloadDash(); }
    catch (err) { alert(err instanceof Error ? err.message : "Lỗi phê duyệt."); }
    setSelected(null);
  }
  async function reject(note: string) {
    if (!selected || !note.trim()) return;
    try { await rejectTrip(selected.id, note); await reload(); void reloadDash(); }
    catch (err) { alert(err instanceof Error ? err.message : "Lỗi từ chối."); }
    setSelected(null);
  }

  if (selected) return <ApprovalDetail user={user} onLogout={onLogout} trip={selected} level={2} onApprove={approve} onReject={reject} onBack={() => setSelected(null)} />;

  // Stats từ /dashboard API — BUG-10
  const pendingL2Count = dash?.pendingL2Approvals.count ?? queue.length;
  const totalAll = dash ? Object.values(dash.allTrips.byStatus).reduce((a, b) => a + b, 0) : all.length;

  const display = tab === "queue" ? queue : all;
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label="Travel Admin" title="Phê duyệt cấp 2" subtitle="Áp dụng khi ngân sách >20M hoặc có vi phạm chính sách." />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        {/* Stats từ /dashboard API — BUG-10 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["Chờ duyệt cấp 2",     pendingL2Count,  "text-violet-700"],
            ["Tổng trips hệ thống",  totalAll,        "text-[#1b2f35]"],
            ["Thông báo chưa đọc",   dash?.notifications.unreadCount ?? "—", "text-amber-600"],
          ].map(([k, v, c]) => (
            <Card key={String(k)} className="p-4"><p className="text-xs text-gray-400 mb-1">{k}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></Card>
          ))}
        </div>
        <div className="flex gap-0 border-b border-gray-200">
          {[["queue", `Chờ duyệt cấp 2 (${queue.length})`], ["all", `Tất cả (${all.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={`pb-3 px-4 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === k ? "border-violet-600 text-violet-700" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {display.length === 0 && <p className="text-sm text-gray-400 text-center py-10 bg-white rounded-xl border border-gray-200">Không có yêu cầu nào.</p>}
          {display.map(t => <TripCard key={t.id} trip={t} cta={t.status === "PENDING_ADMIN_APPROVAL" ? "Xem & duyệt" : undefined} onClick={t.status === "PENDING_ADMIN_APPROVAL" ? () => setSelected(t) : undefined} />)}
        </div>
      </main>
    </div>
  );
}

function FinanceApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { trips, reload } = useTrips();
  // BUG-10: Lấy dashboard stats từ backend API
  const { data: dash, reload: reloadDash } = useDashboard<FinanceDashboard>();
  const [selected, setSelected] = useState<Trip | null>(null);
  const [view, setView] = useState<"dashboard" | "expense" | "close">("dashboard");

  const settling = trips.filter(t => t.status === "EXPENSE_SUBMITTED");
  const pending  = trips.filter(t => t.status === "PENDING_MANAGER_ADDITIONAL_APPROVAL");
  const closed   = trips.filter(t => t.status === "CLOSED");
  // BUG-03: EXPENSE_APPROVED = Finance approve xong nhưng chưa gọi closeTrip()
  const readyToClose = trips.filter(t => t.status === "EXPENSE_APPROVED");
  const allFin   = trips.filter(t => ["APPROVED","TRIP_IN_PROGRESS","EXPENSE_SUBMITTED","PENDING_MANAGER_ADDITIONAL_APPROVAL","EXPENSE_APPROVED","CLOSED"].includes(t.status));

  async function handleCloseTrip(finNote: string) {
    if (!selected) return;
    try {
      await approveExpense(selected.id, finNote || undefined);
      await closeTrip(selected.id, finNote || undefined);
      await reload(); void reloadDash();
    } catch (err) { alert(err instanceof Error ? err.message : "Lỗi đóng hồ sơ."); }
    setSelected(null); setView("dashboard");
  }

  async function routeToManagerAdditional() {
    if (!selected) return;
    try {
      await rejectExpense(selected.id, "Chi phí vượt >10% — chuyển Manager phê duyệt bổ sung (BR-TR-05).");
      await reload(); void reloadDash();
    } catch (err) { alert(err instanceof Error ? err.message : "Lỗi chuyển Manager."); }
    setSelected(null); setView("dashboard");
  }

  if (view === "expense" && selected) return <FinExpense user={user} onLogout={onLogout} trip={selected} onClose={() => setView("close")} onRouteToManager={routeToManagerAdditional} onBack={() => { setSelected(null); setView("dashboard"); }} />;
  if (view === "close"   && selected) return <FinClose   user={user} onLogout={onLogout} trip={selected} onConfirm={handleCloseTrip} onBack={() => { setSelected(null); setView("dashboard"); }} />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label="Finance Dashboard" title="Quản lý chi phí công tác" subtitle="Xem xét, đối chiếu và đóng hồ sơ quyết toán." />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Chờ quyết toán",  dash?.pendingExpenses.count ?? settling.length,    "text-amber-600"],
            ["Chờ đóng hồ sơ",  dash?.pendingClose.count ?? readyToClose.length,   "text-indigo-600"],
            ["Đã đóng hồ sơ",   closed.length,      "text-emerald-600"],
            ["Thông báo",        dash?.notifications.unreadCount ?? "—",            "text-violet-600"],
          ].map(([k, v, c]) => (
            <Card key={String(k)} className="p-4"><p className="text-xs text-gray-400 mb-1">{k}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></Card>
          ))}
        </div>
        {pending.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-semibold text-orange-700">Chờ Manager duyệt bổ sung</p>
              <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{pending.length}</span>
            </div>
            <div className="mb-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">Chi phí vượt &gt;10% — đã gửi Manager xét duyệt bổ sung. Vui lòng chờ phản hồi.</div>
            <div className="flex flex-col gap-3">{pending.map(t => <TripCard key={t.id} trip={t} />)}</div>
          </section>
        )}
        {settling.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-semibold text-[#1b2f35]">Chờ xét duyệt chi phí</p>
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{settling.length}</span>
            </div>
            <div className="flex flex-col gap-3">{settling.map(t => <TripCard key={t.id} trip={t} cta="Xem chi phí" onClick={() => { setSelected(t); setView("expense"); }} />)}</div>
          </section>
        )}
        {/* BUG-03: EXPENSE_APPROVED là trạng thái riêng — Finance đã approve nhưng chưa gọi closeTrip() */}
        {readyToClose.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-semibold text-indigo-700">Sẵn sàng đóng hồ sơ</p>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">{readyToClose.length}</span>
            </div>
            <div className="mb-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">Finance đã phê duyệt chi phí — nhấn "Đóng hồ sơ" để hoàn tất quy trình.</div>
            <div className="flex flex-col gap-3">{readyToClose.map(t => <TripCard key={t.id} trip={t} cta="Đóng hồ sơ" onClick={() => { setSelected(t); setView("close"); }} />)}</div>
          </section>
        )}
        <section>
          <p className="text-sm font-bold text-[#1b2f35] mb-3">Tất cả hồ sơ</p>
          <div className="flex flex-col gap-3">
            {allFin.length === 0 && <p className="text-sm text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">Chưa có hồ sơ.</p>}
            {allFin.map(t => <TripCard key={t.id} trip={t} onClick={t.status === "EXPENSE_SUBMITTED" ? () => { setSelected(t); setView("expense"); } : t.status === "EXPENSE_APPROVED" ? () => { setSelected(t); setView("close"); } : undefined} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function FinExpense({ user, onLogout, trip, onClose, onRouteToManager, onBack }: {
  user: User; onLogout: () => void; trip: Trip; onClose: () => void; onRouteToManager: () => void; onBack: () => void;
}) {
  const [expense, setExpense] = useState<BackendExpense | null>(null);
  const [expLoading, setExpLoading] = useState(true);

  useEffect(() => {
    getExpense(trip.id).then(setExpense).catch(() => setExpense(null)).finally(() => setExpLoading(false));
  }, [trip.id]);

  const totalActual   = expense?.totalActual ?? 0;
  const totalBudgeted = expense?.estimatedBudgetSnapshot ?? trip.budget;
  const overPct = totalBudgeted > 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : 0;
  const overTolerance = overPct > 10;
  const alreadyApproved = expense?.managerReapproved ?? false;
  const needsExplanation = overTolerance && !alreadyApproved;

  // Map to ExpenseItem[] for VarianceTable display
  const items: ExpenseItem[] = (expense?.items ?? []).map(i => ({
    id: i.id, date: new Date(i.expenseDate).toLocaleDateString("vi-VN"),
    category: mapBackendCategory(i.category), label: i.description,
    description: i.description, budgeted: 0, actual: i.amount,
  }));

  if (expLoading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Nav user={user} onLogout={onLogout} />
        <main className="flex items-center justify-center py-20"><p className="text-sm text-gray-400">Đang tải...</p></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title="Chi phí thực tế" subtitle={`${trip.from} — ${trip.to} · ${trip.employeeName}`} action={<ExportBtn />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Quay lại</button></div>
        {overTolerance && alreadyApproved && (
          <div className="max-w-3xl mb-4 flex items-start gap-2.5 px-4 py-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 text-sm">
            <span className="text-xs font-bold bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded shrink-0 mt-0.5">BR-TR-05</span>
            <div>Chi phí vượt <strong>{overPct.toFixed(1)}%</strong> đã được Manager phê duyệt bổ sung — Finance có thể đóng hồ sơ.</div>
          </div>
        )}
        {needsExplanation && (
          <div className="max-w-3xl mb-4 flex items-start gap-2.5 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
            <span className="text-xs font-bold bg-red-200 text-red-700 px-1.5 py-0.5 rounded shrink-0 mt-0.5">BR-TR-05</span>
            <div>Chi phí thực tế vượt dự toán <strong>{overPct.toFixed(1)}%</strong> (vượt ngưỡng 10%) — phải chuyển Manager phê duyệt bổ sung trước khi Finance đóng hồ sơ.</div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4">Bảng so sánh chi phí</p>
              <VarianceTable items={items} />
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Tóm tắt</p>
              <div className="flex flex-col gap-2 text-sm">
                {[["Nhân viên", trip.employeeName], ["Tuyến", `${trip.from} — ${trip.to}`], ["Ngày", `${trip.departDate} – ${trip.returnDate}`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><span className="text-gray-400">{k}</span><span className="font-medium text-right">{v}</span></div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-400">Dự toán</span><span className="font-bold">{totalBudgeted.toLocaleString("vi-VN")}đ</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Thực tế</span><span className={`font-bold ${totalActual > totalBudgeted ? "text-red-600" : "text-emerald-700"}`}>{totalActual.toLocaleString("vi-VN")}đ</span></div>
                {overPct !== 0 && <p className={`text-xs text-right font-semibold ${needsExplanation ? "text-red-500" : "text-emerald-600"}`}>{overPct > 0 ? "+" : ""}{overPct.toFixed(1)}%</p>}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Thao tác</p>
              {needsExplanation && <p className="text-xs text-red-500 mb-3">Vượt &gt;10% — phải gửi Manager phê duyệt bổ sung (BR-TR-05).</p>}
              {needsExplanation ? (
                <button onClick={onRouteToManager} className="w-full py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
                  Gửi Manager duyệt bổ sung
                </button>
              ) : (
                <button onClick={onClose} className="w-full py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
                  Duyệt chi phí & Đóng hồ sơ
                </button>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function FinClose({ user, onLogout, trip, onConfirm, onBack }: {
  user: User; onLogout: () => void; trip: Trip; onConfirm: (note: string) => void; onBack: () => void;
}) {
  const [note, setNote] = useState("");
  const [expense, setExpense] = useState<BackendExpense | null>(null);
  const [expLoading, setExpLoading] = useState(true);

  useEffect(() => {
    getExpense(trip.id).then(setExpense).catch(() => setExpense(null)).finally(() => setExpLoading(false));
  }, [trip.id]);

  const totalActual   = expense?.totalActual ?? 0;
  const totalBudgeted = expense?.estimatedBudgetSnapshot ?? trip.budget;
  const overPct = totalBudgeted > 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : 0;
  const overTolerance = overPct > 10;
  const needsExplanation = overTolerance && !(expense?.managerReapproved ?? false);
  const hasExpenses = totalActual > 0;

  if (expLoading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Nav user={user} onLogout={onLogout} />
        <main className="flex items-center justify-center py-20"><p className="text-sm text-gray-400">Đang tải...</p></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader label={trip.tripCode} title="Đóng hồ sơ chuyến đi" subtitle="Xác nhận để hoàn tất và lưu trữ hồ sơ quyết toán." />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        <div className="mb-4"><button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Quay lại</button></div>
        <Card className="p-6 sm:p-8 max-w-xl">
          <div className="flex flex-col items-center text-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1b2f35]">Xác nhận đóng hồ sơ</h2>
              <p className="text-sm text-gray-400 mt-1">Hành động này không thể hoàn tác. Dữ liệu sẽ chuyển sang chỉ đọc (BR-TR-06).</p>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm flex flex-col gap-2 mb-5">
            {[ ["Mã chuyến", trip.id], ["Nhân viên", trip.employeeName], ["Tuyến", `${trip.from} — ${trip.to}`], ["Ngày", `${trip.departDate} – ${trip.returnDate}`], ["Dự toán", `${totalBudgeted.toLocaleString("vi-VN")}đ`], ["Thực tế", `${totalActual.toLocaleString("vi-VN")}đ`], ["Chênh lệch", `${overPct > 0 ? "+" : ""}${overPct.toFixed(1)}%`] ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><span className="text-gray-400">{k}</span><span className={`font-medium text-right ${k === "Chênh lệch" && overPct > 10 ? "text-red-500 font-bold" : ""}`}>{v}</span></div>
            ))}
          </div>
          {needsExplanation && (
            <div className="mb-4">
              <FieldLabel>Giải trình vượt ngân sách &gt;10% <span className="text-red-400">*</span></FieldLabel>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Lý do chấp thuận chi phí vượt mức dự toán >10%..." className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b2f35] resize-none transition ${!note.trim() ? "border-red-200" : "border-gray-200"}`} />
            </div>
          )}
          {!hasExpenses && (
            <div className="mb-4 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
              Chưa có chi phí thực tế nào được ghi nhận. Yêu cầu Employee cập nhật chi phí trước khi đóng hồ sơ.
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Huỷ</button>
            <button onClick={() => { if (!hasExpenses || (needsExplanation && !note.trim())) return; onConfirm(note || "Đã xét duyệt và đóng hồ sơ."); }} disabled={!hasExpenses || (needsExplanation && !note.trim())} className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors">Approve & Close</button>
          </div>
        </Card>
      </main>
    </div>
  );
}

function RegisterScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: (email: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", email: "", role: "" as Role | "", title: "", department: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (f: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(v => ({ ...v, [f]: e.target.value }));
  const DEPARTMENTS = ["Sales", "Marketing", "Operations", "Finance", "HR", "IT", "Legal", "Product"];

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
    if (!form.email.trim()) e.email = "Vui lòng nhập email.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Email không hợp lệ.";
    else if (USERS.find(u => u.email === form.email)) e.email = "Email này đã được đăng ký.";
    if (!form.role) e.role = "Vui lòng chọn vai trò.";
    if (!form.department) e.department = "Vui lòng chọn phòng ban.";
    setErrors(e); return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    if (form.password.length < 8) e.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    if (form.password !== form.confirm) e.confirm = "Xác nhận mật khẩu không khớp.";
    setErrors(e); return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;
    USERS.push({ email: form.email, password: form.password, name: form.name, role: form.role as Role, title: form.title || form.department });
    setDone(true);
  }

  const loginHeader = (
    <header className="bg-[#1b2f35]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500 text-white font-bold text-sm select-none">S</span>
          <span className="font-semibold text-sm text-white tracking-wide">Smart Travel</span>
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">Đăng nhập</button>
      </div>
    </header>
  );

  if (done) {
    const rc = ROLE_COLORS[form.role as Role];
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        {loginHeader}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl ${rc.logo} flex items-center justify-center shadow-lg`}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1b2f35] mb-1">Đăng ký thành công!</h2>
              <p className="text-sm text-gray-400">Tài khoản <span className="font-semibold text-[#1b2f35]">{form.email}</span> đã được tạo.</p>
            </div>
            <Card className="w-full p-5 text-left">
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Thông tin tài khoản</p>
              <div className="flex flex-col gap-2 text-sm">
                {[ ["Họ tên", form.name], ["Email", form.email], ["Vai trò", ROLE_LABEL[form.role as Role]], ["Phòng ban", form.department] ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><span className="text-gray-400">{k}</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            </Card>
            <button onClick={() => onSuccess(form.email)} className="w-full py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg transition-colors shadow-sm">Đăng nhập ngay</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {loginHeader}
      <div className="flex-1 flex items-start lg:items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="mb-7 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1b2f35] text-white font-bold text-xl mb-4 shadow-lg select-none">S</div>
            <h1 className="text-3xl font-bold text-[#1b2f35] mb-1">Tạo tài khoản mới</h1>
            <p className="text-sm text-gray-400">Điền thông tin để được cấp quyền truy cập hệ thống.</p>
          </div>
          <div className="flex items-center gap-2 mb-6 px-2">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${step >= s ? "bg-[#1b2f35] text-white" : "bg-gray-200 text-gray-400"}`}>{s}</div>
                <p className={`text-xs font-semibold flex-1 ${step >= s ? "text-[#1b2f35]" : "text-gray-400"}`}>{s === 1 ? "Thông tin cá nhân" : "Bảo mật"}</p>
                {s < 2 && <div className={`h-px flex-1 mx-1 ${step > s ? "bg-[#1b2f35]" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
          <Card className="p-7">
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1">Bước 1 — Thông tin cá nhân</p>
                <div><FieldLabel>Họ và tên <span className="text-red-400">*</span></FieldLabel><TextInput value={form.name} onChange={set("name")} placeholder="Nguyễn Văn A" />{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}</div>
                <div><FieldLabel>Email công ty <span className="text-red-400">*</span></FieldLabel><TextInput type="email" value={form.email} onChange={set("email")} placeholder="ten@smarttravel.vn" />{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Vai trò <span className="text-red-400">*</span></FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {(["employee","manager","admin","finance"] as Role[]).map(r => {
                        const rc = ROLE_COLORS[r]; const sel = form.role === r;
                        return (
                          <button key={r} type="button" onClick={() => setForm(v => ({ ...v, role: r }))} className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border-2 text-center transition-all ${sel ? `${rc.bg} ${rc.border}` : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white ${rc.logo}`}>S</div>
                            <span className={`text-xs font-semibold ${sel ? rc.text : "text-gray-500"}`}>{ROLE_LABEL[r]}</span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
                  </div>
                  <div>
                    <FieldLabel>Phòng ban <span className="text-red-400">*</span></FieldLabel>
                    <select value={form.department} onChange={set("department")} className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-[#1b2f35] bg-white focus:outline-none focus:ring-2 focus:ring-[#1b2f35] appearance-none cursor-pointer transition">
                      <option value="">Chọn phòng ban</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                    <div className="mt-3"><FieldLabel>Chức danh (tuỳ chọn)</FieldLabel><TextInput value={form.title} onChange={set("title")} placeholder="VD: Sales Executive" /></div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">Đã có tài khoản</button>
                  <button type="button" onClick={() => { if (validateStep1()) setStep(2); }} className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg shadow-sm transition-colors">Tiếp tục</button>
                </div>
              </div>
            )}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1">Bước 2 — Thiết lập mật khẩu</p>
                {form.role && (
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${ROLE_COLORS[form.role as Role].bg} ${ROLE_COLORS[form.role as Role].border}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0 ${ROLE_COLORS[form.role as Role].logo}`}>{form.name.charAt(0).toUpperCase() || "S"}</div>
                    <div><p className="text-sm font-semibold text-[#1b2f35] truncate">{form.name}</p><p className="text-xs text-gray-500">{form.email} · {ROLE_LABEL[form.role as Role]}</p></div>
                  </div>
                )}
                <div>
                  <FieldLabel>Mật khẩu <span className="text-red-400">*</span></FieldLabel>
                  <div className="relative"><TextInput type={showPass ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="Tối thiểu 8 ký tự" /><button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><EyeIcon open={showPass} /></button></div>
                  {form.password.length > 0 && <div className="mt-1.5 flex gap-1">{[1,2,3,4].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length >= i*3 ? i<=1?"bg-red-400":i<=2?"bg-amber-400":i<=3?"bg-emerald-400":"bg-emerald-600":"bg-gray-200"}`} />)}</div>}
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
                <div>
                  <FieldLabel>Xác nhận mật khẩu <span className="text-red-400">*</span></FieldLabel>
                  <div className="relative"><TextInput type={showConf ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Nhập lại mật khẩu" /><button type="button" onClick={() => setShowConf(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><EyeIcon open={showConf} /></button></div>
                  {form.confirm.length > 0 && <p className={`text-xs mt-1 ${form.password === form.confirm ? "text-emerald-600" : "text-red-500"}`}>{form.password === form.confirm ? "Mật khẩu khớp" : "Chưa khớp"}</p>}
                  {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600">Quay lại</button>
                  <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg shadow-sm transition-colors">Tạo tài khoản</button>
                </div>
              </form>
            )}
          </Card>
          <p className="text-center text-xs text-gray-400 mt-5">Đã có tài khoản? <button type="button" onClick={onBack} className="text-emerald-600 hover:underline font-semibold">Đăng nhập</button></p>
        </div>
      </div>
    </div>
  );
}

/**
 * SysAdminApp — BUG-17: Component riêng cho role ADMIN (System Admin)
 * Phân biệt với AdminApp (Travel Admin). System Admin xem thống kê toàn hệ thống,
 * không tham gia vào approval flow.
 */
function SysAdminApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { data: dash, loading } = useDashboard<AdminDashboard>();
  const { trips } = useTrips();

  const byStatus = trips.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Nav user={user} onLogout={onLogout} />
      <PageHeader
        label="System Admin"
        title="Tổng quan hệ thống"
        subtitle="Thống kê toàn bộ dữ liệu — chỉ đọc."
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Stats từ /dashboard API */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Tổng Trip Requests",  loading ? "…" : (dash?.stats.totalTrips  ?? "—"), "text-[#1b2f35]"],
            ["Người dùng hoạt động", loading ? "…" : (dash?.stats.totalUsers  ?? "—"), "text-emerald-700"],
            ["Tổng Expense Claims",  loading ? "…" : (dash?.stats.totalExpenses ?? "—"), "text-violet-700"],
            ["Thông báo chưa đọc",   loading ? "…" : (dash?.notifications.unreadCount ?? "—"), "text-amber-600"],
          ].map(([k, v, c]) => (
            <Card key={String(k)} className="p-4">
              <p className="text-xs text-gray-400 mb-1">{k}</p>
              <p className={`text-2xl font-bold ${c}`}>{v}</p>
            </Card>
          ))}
        </div>

        {/* Phân bổ theo status */}
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4">
            Phân bổ Trip theo trạng thái
          </p>
          {Object.keys(byStatus).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Chưa có dữ liệu.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium truncate">{STATUS_LABEL[status as TripStatus] ?? status}</span>
                  <span className="text-sm font-bold text-[#1b2f35] ml-2 shrink-0">{count}</span>
                </div>
              ))}
          </div>
        </Card>

        <div className="px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700">
          <span className="font-semibold">System Admin:</span> Tài khoản này chỉ có quyền xem thống kê toàn hệ thống.
          Mọi tác vụ phê duyệt, quản lý policy hoặc đóng hồ sơ thực hiện qua tài khoản Travel Admin hoặc Finance.
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "forgot" | "register">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [fpEmail, setFpEmail]   = useState("");
  const [fpNew, setFpNew]       = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpShowNew, setFpShowNew]   = useState(false);
  const [fpShowConf, setFpShowConf] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpDone, setFpDone]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const backendUser = await authApi.login(email, password);
      onLogin(toFrontendUser(backendUser));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setFpError("");
    const user = USERS.find(u => u.email === fpEmail);
    if (!user) { setFpError("Email này không tồn tại."); return; }
    if (fpNew.length < 8) { setFpError("Mật khẩu mới phải có ít nhất 8 ký tự."); return; }
    if (fpNew !== fpConfirm) { setFpError("Xác nhận mật khẩu không khớp."); return; }
    user.password = fpNew; setFpDone(true);
  }

  const loginHeader = (
    <header className="bg-[#1b2f35]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500 text-white font-bold text-sm select-none">S</span>
          <span className="font-semibold text-sm text-white tracking-wide">Smart Travel</span>
        </div>
      </div>
    </header>
  );

  if (mode === "register") return <RegisterScreen onBack={() => setMode("login")} onSuccess={email => { setEmail(email); setMode("login"); onLogin(USERS.find(u => u.email === email) ?? USERS[0]); }} />;
  if (mode === "forgot") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        {loginHeader}
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <Card className="w-full max-w-md p-7">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1b2f35] text-white font-bold text-xl mb-3">S</div>
              <h2 className="text-2xl font-bold text-[#1b2f35]">Khôi phục mật khẩu</h2>
            </div>
            {fpDone ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm text-gray-500">Mật khẩu mới đã được cập nhật thành công.</p>
                <button onClick={() => setMode("login")} className="w-full py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg">Quay lại đăng nhập</button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="flex flex-col gap-4">
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="ten@smarttravel.vn" />
                </div>
                <div>
                  <FieldLabel>Mật khẩu mới</FieldLabel>
                  <div className="relative"><TextInput type={fpShowNew ? "text" : "password"} value={fpNew} onChange={e => setFpNew(e.target.value)} placeholder="Tối thiểu 8 ký tự" /><button type="button" onClick={() => setFpShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><EyeIcon open={fpShowNew} /></button></div>
                </div>
                <div>
                  <FieldLabel>Xác nhận mật khẩu mới</FieldLabel>
                  <div className="relative"><TextInput type={fpShowConf ? "text" : "password"} value={fpConfirm} onChange={e => setFpConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" /><button type="button" onClick={() => setFpShowConf(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><EyeIcon open={fpShowConf} /></button></div>
                </div>
                {fpError && <p className="text-xs text-red-500">{fpError}</p>}
                <button type="submit" className="w-full py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg">Đặt lại mật khẩu</button>
                <button type="button" onClick={() => setMode("login")} className="text-xs text-gray-400 hover:text-gray-600">Quay lại đăng nhập</button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {loginHeader}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-7">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1b2f35] text-white font-bold text-xl mb-3">S</div>
            <h1 className="text-3xl font-bold text-[#1b2f35] mb-1">Đăng nhập</h1>
            <p className="text-sm text-gray-400">Smart Travel Business Trip Management</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ten@smarttravel.vn" />
            </div>
            <div>
              <FieldLabel>Mật khẩu</FieldLabel>
              <div className="relative">
                <TextInput type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-semibold text-white bg-[#1b2f35] hover:bg-[#243d45] rounded-lg transition-colors disabled:opacity-60">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
            <p className="text-xs text-center text-gray-400">Liên hệ quản trị viên để được cấp hoặc đặt lại tài khoản.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}

function getRoleRoute(role: Role): string {
  switch (role) {
    case "employee": return "/employee";
    case "manager":  return "/manager";
    case "admin":    return "/admin";
    case "sysadmin": return "/sysadmin";
    case "finance":  return "/finance";
    default: return "/";
  }
}

function toFrontendUser(user: BackendUser): User {
  // BUG-17 fix: TRAVEL_ADMIN → "admin", ADMIN → "sysadmin" (phân biệt quyền)
  const roleMap: Record<BackendUser['role'], Role> = {
    EMPLOYEE:     "employee",
    MANAGER:      "manager",
    TRAVEL_ADMIN: "admin",     // Travel Admin — phê duyệt L2, quản lý policy
    FINANCE:      "finance",
    ADMIN:        "sysadmin",  // System Admin — xem toàn hệ thống
  };
  const titleMap: Record<BackendUser['role'], string> = {
    EMPLOYEE:     "Nhân viên",
    MANAGER:      "Quản lý",
    TRAVEL_ADMIN: "Travel Admin",
    FINANCE:      "Finance",
    ADMIN:        "System Admin",
  };
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roleMap[user.role],
    title: user.department ?? titleMap[user.role],
  };
}

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    void authApi.restoreSession()
      .then((backendUser) => {
        if (mounted) setUser(toFrontendUser(backendUser));
      })
      .catch(() => {
        // Không có refresh cookie hợp lệ: hiển thị màn hình đăng nhập.
      })
      .finally(() => {
        if (mounted) setIsRestoringSession(false);
      });
    return () => { mounted = false; };
  }, []);

  const handleLogin = (nextUser: User) => {
    setUser(nextUser);
    navigate(getRoleRoute(nextUser.role));
  };

  const handleLogout = () => {
    void authApi.logout();
    setUser(null);
    navigate("/");
  };

  if (isRestoringSession) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Đang kiểm tra phiên đăng nhập...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={getRoleRoute(user.role)} replace /> : <LoginScreen onLogin={handleLogin} />} />
      <Route path="/employee" element={user?.role === "employee" ? <EmployeeApp user={user} onLogout={handleLogout} /> : <Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
      <Route path="/manager" element={user?.role === "manager" ? <ManagerApp user={user} onLogout={handleLogout} /> : <Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
      <Route path="/admin" element={user?.role === "admin" ? <AdminApp user={user} onLogout={handleLogout} /> : <Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
      <Route path="/sysadmin" element={user?.role === "sysadmin" ? <SysAdminApp user={user} onLogout={handleLogout} /> : <Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
      <Route path="/finance" element={user?.role === "finance" ? <FinanceApp user={user} onLogout={handleLogout} /> : <Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
      <Route path="*" element={<Navigate to={user ? getRoleRoute(user.role) : "/" } replace />} />
    </Routes>
  );
}

export default App;
