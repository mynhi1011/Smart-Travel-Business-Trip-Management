# Story Spec

## Story ID
`US-09`

## Requirement IDs
`REQ-TR-10`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-03` (RBAC)

## Design link
Figma: _[Prototype URL]_ → Screen: **Dashboard — Employee View** + **Manager/Admin/Finance View**

## Goal
Cung cấp Dashboard phân quyền — mỗi role thấy đúng dữ liệu liên quan đến mình. Employee thấy trip cá nhân theo trạng thái; Manager/Admin/Finance thấy các yêu cầu đang chờ xử lý. Filtering và sorting thực hiện server-side.

---

## Preconditions
- Người dùng đã đăng nhập (JWT hợp lệ, bất kỳ role nào).
- DB có dữ liệu trips/expenses liên quan đến user.

---

## Happy Path

### Employee Dashboard
1. Employee đăng nhập, client gọi `GET /api/v1/dashboard`.
2. Server lọc theo `employeeId = req.user.id`, trả về:
   - `myTrips.total`, `byStatus` (DRAFT, SUBMITTED, APPROVED, ONGOING, EXPENSE_*, CLOSED)
   - `myTrips.recentTrips` — 5 trips gần nhất
   - `myExpenses.pendingSubmission` (trip APPROVED, chưa có expense)
   - `myExpenses.pendingApproval` (expense SUBMITTED)
   - `notifications.unreadCount`
3. Client render tabs trạng thái, số đếm, danh sách trips.

### Manager Dashboard
1. Manager đăng nhập, `GET /api/v1/dashboard`.
2. Server lọc trips của subordinates (`trip.employee.managerId = req.user.id`):
   - `pendingApprovals.count + trips[]` (status=SUBMITTED)
   - `teamTrips.byStatus`
3. Client hiển thị widget "Chờ duyệt của tôi" nổi bật ở đầu.

### Finance Dashboard
1. Finance đăng nhập, `GET /api/v1/dashboard`.
2. Server trả:
   - `pendingExpenses` (status=EXPENSE_SUBMITTED)
   - `pendingClose` (status=EXPENSE_APPROVED)
3. Client hiển thị 2 widget riêng biệt.

### Travel Admin Dashboard
1. Hiển thị `pendingAdminApprovals` (status=PENDING_ADMIN_APPROVAL).
2. Hiển thị tổng hợp tất cả trips theo trạng thái.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Token không hợp lệ | `401 UNAUTHORIZED` |
| E-02 | Token hết hạn | Auto refresh → retry |
| E-03 | Không có data | Hiển thị empty state ("Chưa có chuyến đi nào") |
| E-04 | Lỗi mạng | Toast lỗi, skeleton loading biến thành error state |
| E-05 | Employee cố gọi với query `?employeeId=otherUUID` | Server ignore param, chỉ trả trip của `req.user.id` |

---

## Data Read / Write

### Read Only
- `GET /api/v1/dashboard` — tổng hợp stats theo role.
- Server query nhiều bảng: `trips`, `expenses`, `notifications`.

### Write
- Không có write trong story này.

---

## API Contract

### `GET /api/v1/dashboard`
**Response 200 — EMPLOYEE:**
```json
{
  "role": "EMPLOYEE",
  "myTrips": {
    "total": 8,
    "byStatus": { "DRAFT": 1, "SUBMITTED": 2, "APPROVED": 3, "CLOSED": 2 },
    "recentTrips": [{ "id": "uuid", "destination": "ĐN", "status": "APPROVED", "departureDate": "2026-09-20" }]
  },
  "myExpenses": { "pendingSubmission": 1, "pendingApproval": 0 },
  "notifications": { "unreadCount": 3 }
}
```

**Response 200 — MANAGER:**
```json
{
  "role": "MANAGER",
  "pendingApprovals": {
    "count": 4,
    "trips": [{ "id": "uuid", "employee": { "name": "..." }, "estimatedBudget": 5000000, "submittedAt": "..." }]
  },
  "teamTrips": { "total": 23, "byStatus": { "APPROVED": 10, "ONGOING": 3, "CLOSED": 8, "REJECTED": 2 } },
  "notifications": { "unreadCount": 2 }
}
```

**Response 200 — FINANCE:**
```json
{
  "role": "FINANCE",
  "pendingExpenses": { "count": 6, "expenses": [{ "tripId": "uuid", "variancePct": 5.2, "totalActual": 8950000 }] },
  "pendingClose": { "count": 2, "trips": [{ "id": "uuid", "closedAt": null }] },
  "notifications": { "unreadCount": 1 }
}
```

---

## Authorization

| Role | Dữ liệu thấy |
|---|---|
| `EMPLOYEE` | Chỉ trip của mình |
| `MANAGER` | Trip của subordinates |
| `TRAVEL_ADMIN` | Tất cả trips |
| `FINANCE` | Expense claims cần xử lý |

**Server-side filtering tuyệt đối — client không thể override bằng query params.**

---

## Validation / Business Rules

| Rule | Nguồn | Hành vi |
|---|---|---|
| Role-based data isolation | NFR-TR-03 | Server filter theo role trước khi trả response |
| EMPLOYEE không thấy trip người khác | REQ-TR-10 | `WHERE employee_id = req.user.id` |
| MANAGER chỉ thấy subordinates | REQ-TR-10 | `JOIN users WHERE manager_id = req.user.id` |
| `BR-TR-06` CLOSED trips hiển thị read-only | BR-TR-06 | Client disable mọi action button với trip CLOSED |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| Dashboard query | `info` | `{ action: "DASHBOARD_LOADED", userId, role, durationMs }` |
| Slow query > 500ms | `warn` | `{ action: "DASHBOARD_SLOW_QUERY", durationMs, role }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T9.1 | AC 9.1 | Employee đăng nhập, load dashboard | Chỉ thấy trip của mình, đúng byStatus |
| T9.2 | AC 9.1 | Employee có 1 trip DRAFT, 1 SUBMITTED | `byStatus.DRAFT=1, SUBMITTED=1` |
| T9.3 | AC 9.2 | Manager có 3 subordinates trips đang SUBMITTED | `pendingApprovals.count=3` |
| T9.4 | AC 9.2 | Finance có 2 expenses SUBMITTED | `pendingExpenses.count=2` |
| T9.5 | AC 9.2 | Travel Admin thấy PENDING_ADMIN_APPROVAL | `pendingAdminApprovals` hiển thị đúng |
| T9.6 | Error E-03 | Employee chưa có trip | Empty state, không lỗi |
| T9.7 | Auth E-05 | Employee gửi `?employeeId=otherUUID` | Server trả đúng trip của mình, không leak |
| T9.8 | RBAC | EMPLOYEE không thấy trips của người khác trong response | Confirmed: chỉ `employee_id = req.user.id` |
| T9.9 | Perf | GET /dashboard với 50+ trips | Response ≤ 1s (NFR-TR-01) |
| T9.10 | Perf | `byStatus` count chính xác | Không cần N+1 query |

**AC Coverage:** AC 9.1 → T9.1, T9.2, T9.7, T9.8 ✅ | AC 9.2 → T9.3, T9.4, T9.5 ✅

---

## Definition of Done

- [ ] `GET /dashboard` trả đúng shape theo role
- [ ] Server-side filtering tuyệt đối — không leak dữ liệu cross-role
- [ ] Client render đúng tabs/widgets theo role
- [ ] Empty state khi không có data
- [ ] Response ≤ 1s ngay cả khi có nhiều trips (NFR-TR-01)
- [ ] RBAC isolation đúng (NFR-TR-03)
- [ ] 10 test cases T9.1–T9.10 pass

> **⚠️ Cần xác nhận trước khi code:**
> 1. `recentTrips` list — lấy 5 hay 10 bản ghi gần nhất?
> 2. Dashboard có auto-refresh theo SSE hay chỉ load khi user vào trang?
