# Story Spec

## Story ID
`US-07`

## Requirement IDs
`REQ-TR-07`, `REQ-TR-08`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log), `NFR-TR-05` (transaction)

## Design link
Figma: _[Prototype URL]_ → Screen: **Expense Claim Form** + **Variance Summary Table**

## Goal
Cho phép Employee tạo Expense Claim sau chuyến đi, thêm từng khoản chi tiết, xem bảng đối chiếu dự toán vs thực tế tự động, nộp claim với giải trình nếu vượt chi ≤ 10% (BR-TR-05).

---

## Preconditions
- Employee đã đăng nhập (role = `EMPLOYEE`), là chủ sở hữu trip.
- `trip.status IN ('APPROVED', 'ONGOING')`.
- Chưa có expense claim cho trip này (1:1).

---

## Happy Path

### Tạo Expense Claim
1. Employee vào trang Trip Detail → bấm **"Tạo quyết toán"**.
2. Client gọi `POST /api/v1/trips/:tripId/expense`.
3. Server tạo `expenses` với `estimatedBudgetSnapshot = trip.estimatedBudget`, `totalActual = 0`, `status = DRAFT`.
4. Client chuyển sang form Expense Claim.

### Thêm khoản chi
1. Employee bấm **"+ Thêm khoản chi"**, nhập ngày chi, danh mục, số tiền, mô tả, đính kèm receipt (mock URL).
2. Client gọi `POST /api/v1/trips/:tripId/expense/items`.
3. Server INSERT item, cập nhật `expenses.totalActual = SUM(items.amount)`.
4. Client cập nhật bảng items và variance summary ngay lập tức.

### Xem bảng đối chiếu (AC 7.2)
- Client hiển thị: `Dự toán: X VNĐ | Thực tế: Y VNĐ | Chênh lệch: +Z VNĐ (+P%)`
- `variancePct` tính từ `(totalActual - estimatedBudgetSnapshot) / estimatedBudgetSnapshot × 100`.

### Nộp Claim (variance = 0 hoặc âm)
1. Employee bấm **"Nộp quyết toán"**.
2. Client gọi `POST /api/v1/trips/:tripId/expense/submit`.
3. Server tính variance, không có vi phạm, `expense.status = SUBMITTED`, `trip.status = EXPENSE_SUBMITTED`.
4. Client toast "Đã nộp quyết toán thành công.".

### Nộp Claim (variance 0–10%, AC 7.3)
1. Employee bấm "Nộp" khi `0 < variancePct ≤ 10`.
2. Server check `justification` → nếu rỗng → `422 JUSTIFICATION_REQUIRED`.
3. Employee quay lại điền `PATCH /api/v1/trips/:tripId/expense` với `justification`.
4. Employee nộp lại → thành công.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Tạo expense khi trip chưa APPROVED | `409 INVALID_STATE` |
| E-02 | Tạo expense khi đã có expense claim | `409` "Expense claim đã tồn tại cho chuyến đi này" |
| E-03 | `amount ≤ 0` | `400 VALIDATION_ERROR`: "Số tiền phải > 0 VNĐ" |
| E-04 | Nộp khi không có items | `422` "Cần ít nhất 1 khoản chi trước khi nộp" |
| E-05 | `variance > 0 ≤ 10%` nhưng thiếu justification | `422 JUSTIFICATION_REQUIRED` |
| E-06 | `variance > 10%` | Submit thành công nhưng `managerReapprovalRequired = true`; Finance bị block cho đến khi Manager reapprove |
| E-07 | Thêm item khi expense đã SUBMITTED | `409 INVALID_STATE` |
| E-08 | Trip CLOSED → thêm item | `409 TRIP_IMMUTABLE` |
| E-09 | Token hết hạn | Auto refresh → retry |
| E-10 | Lỗi mạng | Toast lỗi, form giữ nguyên |

---

## Data Read / Write

### Read
- `GET /api/v1/trips/:tripId/expense` — lấy expense claim + items + variance.
- `GET /api/v1/auth/me` — xác minh ownership.

### Write
- `POST /api/v1/trips/:tripId/expense` — tạo expense (server set `estimatedBudgetSnapshot`).
- `POST /api/v1/trips/:tripId/expense/items` — thêm item (server cập nhật `totalActual`).
- `PATCH /api/v1/trips/:tripId/expense/items/:itemId` — sửa item (server cập nhật `totalActual`).
- `DELETE /api/v1/trips/:tripId/expense/items/:itemId` — xóa item (server cập nhật `totalActual`).
- `PATCH /api/v1/trips/:tripId/expense` — cập nhật `justification`.
- `POST /api/v1/trips/:tripId/expense/submit` — nộp claim.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `expenses` | INSERT / UPDATE | `estimatedBudgetSnapshot` server set |
| `expense_items` | INSERT / UPDATE / DELETE | Trigger cập nhật `totalActual` |
| `trips` | UPDATE | `status = EXPENSE_SUBMITTED` khi submit |
| `audit_logs` | INSERT | `EXPENSE_CREATED`, `EXPENSE_SUBMITTED` |
| `notifications` | INSERT | → FINANCE sau submit |

> **Computed fields không nhận từ client:** `totalActual`, `variancePct`, `varianceAmount`, `estimatedBudgetSnapshot`, `managerReapprovalRequired`.

---

## API Contract

### `POST /api/v1/trips/:tripId/expense`
**Request Body:** Không cần.
**Response 201:**
```json
{
  "id": "uuid", "tripId": "uuid",
  "totalActual": 0, "estimatedBudgetSnapshot": 8500000,
  "variancePct": null, "status": "DRAFT",
  "createdAt": "2026-09-25T09:00:00Z"
}
```

### `POST /api/v1/trips/:tripId/expense/items`
**Request:**
```json
{
  "expenseDate": "2026-09-20", "category": "TRANSPORT",
  "amount": 1600000, "description": "Vé máy bay HN-ĐN khứ hồi",
  "receiptUrl": "/uploads/receipt-001.jpg"
}
```
**Response 201:** ExpenseItem object.

### `POST /api/v1/trips/:tripId/expense/submit`
**Response 200:**
```json
{
  "id": "uuid", "status": "SUBMITTED",
  "totalActual": 9200000, "estimatedBudgetSnapshot": 8500000,
  "variancePct": 8.24, "varianceAmount": 700000,
  "managerReapprovalRequired": false,
  "submittedAt": "2026-09-25T11:00:00Z"
}
```
**Response 422 (thiếu justification):**
```json
{
  "error": "JUSTIFICATION_REQUIRED",
  "message": "Variance 8.24% > 0. Bắt buộc nhập lý do vượt chi (BR-TR-05).",
  "requestId": "req_abc123"
}
```

---

## Authorization

| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ CRUD items, tạo/nộp expense — trip của mình |
| `FINANCE` | ✅ xem expense (GET) |
| Khác | ❌ 403 |

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| `amount > 0` | data-model CHECK | Server | 400 |
| `variancePct = 0` | BR-TR-05 | Server | Finance approve bình thường |
| `0 < variancePct ≤ 10` | BR-TR-05 | Server trước submit | 422 nếu thiếu `justification` |
| `variancePct > 10` | BR-TR-05 | Server khi submit | `managerReapprovalRequired = true` |
| 1:1 expense per trip | data-model UNIQUE | DB | 409 nếu tạo lại |
| `estimatedBudgetSnapshot` server-set | data-model | Server | Strip nếu client gửi |
| `totalActual` server-computed | data-model | Server | Recalc sau mỗi item change |
| Expense DRAFT để sửa items | Logic | Service layer | 409 nếu SUBMITTED |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| Expense tạo | `info` | `{ action: "EXPENSE_CREATED", tripId, expenseId, budgetSnapshot }` |
| Item thêm | `info` | `{ action: "EXPENSE_ITEM_ADDED", expenseId, amount, category }` |
| totalActual cập nhật | `info` | `{ expenseId, totalActual, variancePct }` |
| Expense nộp | `info` | `{ action: "EXPENSE_SUBMITTED", expenseId, variance, managerReapprovalRequired }` |
| Justification required blocked | `warn` | `{ action: "JUSTIFICATION_REQUIRED", expenseId, variancePct }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T7.1 | Happy path | Tạo expense sau trip APPROVED | 201, `estimatedBudgetSnapshot` = trip.estimatedBudget |
| T7.2 | AC 7.1 | Thêm 3 items, query GET expense | Items danh sách đúng, `totalActual` = tổng |
| T7.3 | AC 7.2 | Sau T7.2, `variancePct` hiển thị | `variancePct = (totalActual - snapshot) / snapshot × 100` đúng |
| T7.4 | AC 7.3 | variance = 5% thiếu justification → submit | 422 JUSTIFICATION_REQUIRED |
| T7.5 | AC 7.3 | variance = 5%, có justification → submit | 200 SUBMITTED |
| T7.6 | BR-TR-05 | variance = 15% → submit | 200 nhưng `managerReapprovalRequired=true` |
| T7.7 | BR-TR-05 | variance = 0% → submit | 200, `managerReapprovalRequired=false` |
| T7.8 | Error E-01 | Tạo expense khi trip DRAFT | 409 INVALID_STATE |
| T7.9 | Error E-03 | `amount = 0` | 400 |
| T7.10 | Error E-04 | Submit không có items | 422 |
| T7.11 | Error E-07 | Thêm item khi expense SUBMITTED | 409 INVALID_STATE |
| T7.12 | Computed | Client cố gửi `estimatedBudgetSnapshot` | Server bỏ qua, dùng giá trị đã lưu |
| T7.13 | Computed | Sau xóa item, `totalActual` cập nhật | Số liệu khớp |
| T7.14 | Audit | Sau submit, query `audit_logs` | Record `EXPENSE_SUBMITTED` |
| T7.15 | Notification | Sau submit, FINANCE nhận SSE | `type=EXPENSE_SUBMITTED` |

**AC Coverage:** AC 7.1 → T7.1, T7.2 ✅ | AC 7.2 → T7.3 ✅ | AC 7.3 → T7.4, T7.5 ✅

---

## Definition of Done

- [ ] `POST /expense` tạo claim với `estimatedBudgetSnapshot` server-set
- [ ] CRUD expense items, `totalActual` luôn được sync
- [ ] `variancePct`, `varianceAmount` server-computed, không nhận từ client
- [ ] BR-TR-05 enforce: justification required khi 0 < variance ≤ 10%
- [ ] `managerReapprovalRequired = true` khi variance > 10%
- [ ] Notification FINANCE sau submit (REQ-TR-11)
- [ ] `audit_logs` đầy đủ (NFR-TR-04)
- [ ] 15 test cases T7.1–T7.15 pass
- [ ] Response ≤ 1s (NFR-TR-01)

> **⚠️ Cần xác nhận trước khi code:**
> 1. Nếu Finance reject và Employee submit lại, `estimatedBudgetSnapshot` có thay đổi không? (Hiện tại: không — snapshot bất biến)
> 2. Receipt upload là mock URL hay có file upload thật trong MVP này?
