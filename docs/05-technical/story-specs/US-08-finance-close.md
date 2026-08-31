# Story Spec

## Story ID
`US-08`

## Requirement IDs
`REQ-TR-09`, `NFR-TR-01`, `NFR-TR-03` (RBAC), `NFR-TR-04` (audit log), `NFR-TR-05` (transaction)

## Design link
Figma: _[Prototype URL]_ → Screen: **Finance Review Queue** + **Expense Approval Panel**

## Goal
Finance xem xét Expense Claim, đối chiếu chi phí thực tế vs dự toán, phê duyệt hoặc từ chối. Khi variance > 10% chưa có Manager reapprove, nút Approve bị block (BR-TR-05). Sau khi Approve Expense, Finance Close Trip — toàn bộ hồ sơ trở thành read-only (BR-TR-06).

---

## Preconditions
- Finance đã đăng nhập (role = `FINANCE`).
- `expense.status = 'SUBMITTED'`.
- Trip `status = 'EXPENSE_SUBMITTED'`.

---

## Happy Path — Approve Expense & Close Trip (variance ≤ 10%)

> **⚠️ UX vs API (L-05 fix):** AC 8.1 trong user-story gốc mô tả nút "Approve Expense & Close" gộp. Tuy nhiên backend **bắt buộc tách thành 2 request tuần tự**. Frontend có thể hiển thị 1 nút nhưng phải gọi `POST /expense/approve` trước, chờ `expense.status = APPROVED`, sau đó mới gọi `POST /close`. Nút "Close" phải bị disabled khi `expense.status ≠ APPROVED`.

1. Finance vào Dashboard → **"Chờ duyệt quyết toán"**.
2. `GET /api/v1/dashboard` → expense list.
3. Finance mở Trip Detail + Expense Detail.
4. `GET /api/v1/trips/:tripId/expense` — xem bảng đối chiếu `dự toán vs thực tế vs variance`.
5. Finance kiểm tra chứng từ, `variancePct ≤ 10` + `justification` hợp lệ.
6. Finance bấm **"Phê duyệt quyết toán"** → `POST /api/v1/trips/:tripId/expense/approve`.
7. Server: `expense.status = APPROVED`, `approved_at = now()`, `trip.status = EXPENSE_APPROVED`, audit log, emit.
8. Nút **"Đóng hồ sơ"** được enable (lúc này `expense.status = APPROVED`). Finance bấm → `POST /api/v1/trips/:tripId/close`.
9. Server (1 transaction): `trip.status = CLOSED` + `trip.closedAt = now()` + `expense.status = CLOSED`, audit log (`TRIP_CLOSED`), emit notification → Employee.
10. Client hiển thị "Hồ sơ đã được đóng — Read-only." (BR-TR-06). Response trả về cả `trip.status` và `expense.status`.

---

## Happy Path — Reject Expense

1–4 như trên.
5. Finance bấm **"Yêu cầu chỉnh sửa"**, nhập lý do bắt buộc.
6. `POST /api/v1/trips/:tripId/expense/reject`.
7. Server: `expense.status = REJECTED`, `trip.status = EXPENSE_REJECTED`, emit → Employee.
8. Employee bổ sung items và nộp lại.

---

## Happy Path — Variance > 10% (Cần Manager reapprove trước)

1. Finance mở Expense Detail → thấy `managerReapprovalRequired = true`.
2. Nút **"Phê duyệt"** bị **disable** với tooltip "Đang chờ Manager phê duyệt phần vượt chi".
3. Sau khi Manager gọi `POST /expense/reapprove` (US-08 phụ) → `managerReapproved = true`.
4. Finance reload → nút Approve được enable.
5. Finance approve → Close như happy path trên.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Approve khi `managerReapprovalRequired=true` nhưng `managerReapproved=false` | `422 EXPENSE_VARIANCE_EXCEEDED`: "Cần Manager phê duyệt phần vượt chi trước." |
| E-02 | Close khi `expense.status` chưa APPROVED | `409 INVALID_STATE` |
| E-03 | Reject không có comment | `400 VALIDATION_ERROR` |
| E-04 | Bất kỳ write nào sau CLOSED | `409 TRIP_IMMUTABLE` (BR-TR-06) |
| E-05 | EMPLOYEE cố gọi `/expense/approve` | `403 FORBIDDEN` (NFR-TR-03) |
| E-06 | Double close đồng thời | `SELECT FOR UPDATE` + state check → `409 INVALID_STATE` (trip đã CLOSED) |
| E-07 | Token hết hạn | Auto refresh → retry |

---

## Data Read / Write

### Read
- `GET /api/v1/dashboard` — expense list chờ Finance.
- `GET /api/v1/trips/:tripId/expense` — chi tiết với `variancePct`, `managerReapprovalRequired`.

### Write — Approve Expense
- `expenses`: UPDATE `status = APPROVED`, `approved_at`.
- `trips`: UPDATE `status = EXPENSE_APPROVED`.
- `audit_logs`: INSERT `EXPENSE_APPROVED`.
- `notifications`: emit → Employee.

### Write — Close Trip
- `trips`: UPDATE `status = CLOSED`, `closed_at`.
- `expenses`: UPDATE `status = CLOSED`.
- `audit_logs`: INSERT `TRIP_CLOSED`.
- `notifications`: emit → Employee.

### Write — Reject Expense
- `expenses`: UPDATE `status = REJECTED`.
- `trips`: UPDATE `status = EXPENSE_REJECTED`.
- `audit_logs`: INSERT `EXPENSE_REJECTED`.
- `notifications`: emit → Employee.

| Bảng | Operation | Ghi chú |
|---|---|---|
| `expenses` | UPDATE | status transitions |
| `trips` | UPDATE | status + closedAt |
| `audit_logs` | INSERT | 3 actions |
| `notifications` | INSERT | SSE → Employee |

---

## API Contract

### `POST /api/v1/trips/:tripId/expense/approve`
**Request:** `{ "comment": "Chứng từ hợp lệ" }` (optional)
**Response 200:** `{ "id": "uuid", "status": "APPROVED", "approvedAt": "..." }`
**Response 422:** `{ "error": "EXPENSE_VARIANCE_EXCEEDED", "message": "..." }`

### `POST /api/v1/trips/:tripId/expense/reject`
**Request:** `{ "comment": "Thiếu chứng từ khách sạn ngày 2" }` (**required**)
**Response 200:** `{ "id": "uuid", "status": "REJECTED" }`

### `POST /api/v1/trips/:tripId/close`
**Request Body:** Không cần.
**Response 200:** `{ "id": "uuid", "status": "CLOSED", "closedAt": "2026-09-30T16:00:00Z" }`
**Response 422:** `{ "error": "EXPENSE_VARIANCE_EXCEEDED", ... }`
**Response 409:** `{ "error": "INVALID_STATE", ... }` (expense chưa APPROVED)

### `POST /api/v1/trips/:tripId/expense/reapprove` (Manager)
**Request:** `{ "action": "APPROVED", "comment": "Chấp thuận phần vượt chi" }`
**Response 200:** `{ "managerReapproved": true, "managerReapprovedAt": "...", "status": "SUBMITTED" }`

---

## Authorization

| Role | Endpoint | Quyền |
|---|---|---|
| `FINANCE` | `/expense/approve`, `/expense/reject`, `/close` | ✅ |
| `MANAGER` | `/expense/reapprove` | ✅ (manager của employee) |
| `EMPLOYEE` | `/expense/approve` | ❌ 403 |
| `TRAVEL_ADMIN` | `/close` | ❌ 403 |

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| Approve khi `managerReapprovalRequired=true && !managerReapproved` | BR-TR-05 | Service | 422 EXPENSE_VARIANCE_EXCEEDED |
| Close chỉ khi `expense.status = APPROVED` | State machine | Service | 409 |
| Reject bắt buộc comment | data-model | Server | 400 |
| CLOSED trip → tất cả write bị block | BR-TR-06 | immutableGuard | 409 TRIP_IMMUTABLE |
| SELECT FOR UPDATE cho Close | NFR-TR-05 | DB transaction | Race condition |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| Finance approve expense | `info` | `{ action: "EXPENSE_APPROVED", tripId, expenseId, variancePct }` |
| Finance reject expense | `info` | `{ action: "EXPENSE_REJECTED", tripId, expenseId, comment }` |
| Trip closed | `info` | `{ action: "TRIP_CLOSED", tripId, closedAt, financeId }` |
| Variance block | `warn` | `{ action: "FINANCE_APPROVE_BLOCKED_VARIANCE", expenseId, variancePct }` |
| Manager reapprove | `info` | `{ action: "MANAGER_REAPPROVED_EXPENSE", expenseId, action, approverId }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T8.1 | AC 8.1 | variance=5%, justification có, approve + close | `expense.APPROVED` → `trip.CLOSED` |
| T8.2 | AC 8.1 | CLOSED trip: mọi field readonly | 409 TRIP_IMMUTABLE khi cố thêm item |
| T8.3 | AC 8.2 | variance=15%, `managerReapproved=false` → Finance approve | 422 EXPENSE_VARIANCE_EXCEEDED |
| T8.4 | AC 8.2 | variance=15%, Manager reapprove → Finance approve | 200 APPROVED |
| T8.5 | AC 8.3 | Finance reject + comment | `expense.REJECTED`, Employee nhận notification |
| T8.6 | Error E-03 | Reject không có comment | 400 |
| T8.7 | Error E-02 | Close khi expense=SUBMITTED (chưa approve) | 409 INVALID_STATE |
| T8.8 | Auth E-05 | EMPLOYEE gọi `/expense/approve` | 403 FORBIDDEN |
| T8.9 | Immutable | POST /trips/:id/itinerary sau CLOSED | 409 TRIP_IMMUTABLE |
| T8.10 | Immutable | PATCH /trips/:id sau CLOSED | 409 TRIP_IMMUTABLE |
| T8.11 | Race | 2 Finance close đồng thời | 1 thành công, 1 nhận 409 |
| T8.12 | Audit | Sau T8.1, query `audit_logs` | Records: `EXPENSE_APPROVED`, `TRIP_CLOSED` |
| T8.13 | Notification | Sau CLOSED, Employee nhận SSE | `type=TRIP_CLOSED` |
| T8.14 | Perf | Approve + Close sequence | Mỗi request ≤ 1s |

**AC Coverage:** AC 8.1 → T8.1, T8.2 ✅ | AC 8.2 → T8.3, T8.4 ✅ | AC 8.3 → T8.5, T8.6 ✅

---

## Definition of Done

- [ ] `POST /expense/approve` enforce BR-TR-05 (block nếu variance > 10% chưa reapprove)
- [ ] `POST /expense/reject` bắt buộc comment
- [ ] `POST /close` → `trip.status = CLOSED`, `expense.status = CLOSED` trong 1 transaction
- [ ] Sau CLOSED: mọi write trên trip → `409 TRIP_IMMUTABLE` (BR-TR-06)
- [ ] Manager reapprove flow hoạt động đúng
- [ ] Notification Employee sau approve/reject/close (REQ-TR-11)
- [ ] `audit_logs` đầy đủ 3 actions (NFR-TR-04)
- [ ] 14 test cases T8.1–T8.14 pass
- [ ] Response ≤ 1s (NFR-TR-01)
