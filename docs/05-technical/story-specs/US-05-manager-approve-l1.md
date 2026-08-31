# Story Spec

## Story ID
`US-05`

## Requirement IDs
`REQ-TR-04`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-03` (RBAC), `NFR-TR-04` (audit log), `NFR-TR-05` (transaction)

## Design link
Figma: _[Prototype URL]_ → Screen: **Manager Approval Queue** + **Trip Detail — Approval Panel**

## Goal
Manager xem danh sách Trip Request đang chờ duyệt của nhân viên dưới quyền, xem xét tóm tắt (mục đích, dự toán, policy result), rồi Approve hoặc Reject kèm lý do. Hệ thống tự định tuyến sang cấp 2 nếu cần (BR-TR-04).

---

## Preconditions
- Manager đã đăng nhập (role = `MANAGER`).
- Trip có `status = 'SUBMITTED'` và `trip.employee.managerId = req.user.id`.
- Policy Check đã chạy (có `policy_check_results`).

---

## Happy Path — Approve (Cấp 1 kết thúc)

1. Manager vào **Dashboard** → tab "Chờ duyệt của tôi".
2. Client gọi `GET /api/v1/dashboard` → hiển thị danh sách trips `status=SUBMITTED`.
3. Manager click vào Trip → `GET /api/v1/trips/:tripId` — xem chi tiết đầy đủ.
4. Manager xem `policyCheckResult`, `estimatedBudget`, mục đích, lịch trình.
5. Manager bấm **"Phê duyệt"**, tuỳ chọn nhập comment.
6. Client gọi `POST /api/v1/trips/:tripId/approve`.
7. Server (transaction):
   a. `SELECT FOR UPDATE` trên trip.
   b. Chạy `ApprovalRouter`: nếu `budget ≤ 20M AND no violations` → `status = APPROVED`.
   c. INSERT `approval_records` (LEVEL_1, APPROVED, budgetSnapshot, hadViolationsSnapshot).
   d. UPDATE `trips.status = APPROVED`, `approvedAt = now()`.
   e. INSERT `audit_logs`.
   f. Emit notification → Employee.
8. Server trả 200 `{ status: "APPROVED" }`.
9. Client hiển thị toast "Đã phê duyệt thành công", trip biến khỏi danh sách chờ.

---

## Happy Path — Approve (Cần Cấp 2)

- Bước 1–6 như trên.
- Bước 7: `ApprovalRouter` nhận `budget > 20M OR has violations` → `status = PENDING_ADMIN_APPROVAL`.
- Server emit notification → Travel Admin.
- Client hiển thị "Đã chuyển lên Travel Admin để duyệt cấp 2.".

---

## Happy Path — Reject

1. Manager xem trip detail.
2. Manager bấm **"Từ chối"**, nhập lý do (bắt buộc).
3. Client gọi `POST /api/v1/trips/:tripId/reject` với `{ comment: "..." }`.
4. Server: `status = REJECTED`, INSERT `approval_records` (action=REJECTED), INSERT audit_log, emit → Employee.
5. Client hiển thị toast "Đã từ chối yêu cầu.".

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Reject không có `comment` | `400 VALIDATION_ERROR`: "Lý do từ chối là bắt buộc" |
| E-02 | `trip.status` không phải `SUBMITTED` | `409 INVALID_STATE` |
| E-03 | Manager approve trip của người khác (không phải subordinate) | `403 FORBIDDEN` (resource-level check) |
| E-04 | Double approve — 2 Manager bấm cùng lúc | `SELECT FOR UPDATE` + `UNIQUE INDEX` chặn → 409 DUPLICATE_APPROVAL |
| E-05 | Token hết hạn | Auto refresh → retry |
| E-06 | Lỗi mạng | Toast lỗi, trạng thái trip không thay đổi |
| E-07 | Role EMPLOYEE gọi `/approve` | `403 FORBIDDEN` (NFR-TR-03) |

---

## Data Read / Write

### Read
- `GET /api/v1/dashboard` — danh sách chờ duyệt.
- `GET /api/v1/trips/:tripId` — chi tiết + policyCheckResult + approvalRecords.

### Write — Approve
- `trips`: UPDATE `status`, `approved_at` (hoặc sang PENDING_ADMIN_APPROVAL).
- `approval_records`: INSERT (LEVEL_1, APPROVED, budgetSnapshot).
- `audit_logs`: INSERT `MANAGER_APPROVED` hoặc `MANAGER_ESCALATED_L2`.
- `notifications`: INSERT → SSE emit → Employee (hoặc Travel Admin nếu escalate).

### Write — Reject
- `trips`: UPDATE `status = REJECTED`.
- `approval_records`: INSERT (LEVEL_1, REJECTED, comment bắt buộc).
- `audit_logs`: INSERT `MANAGER_REJECTED`.
- `notifications`: INSERT → SSE emit → Employee.

| Bảng | Operation | Ghi chú |
|---|---|---|
| `trips` | UPDATE | `status`, `approved_at` |
| `approval_records` | INSERT | snapshot fields |
| `audit_logs` | INSERT | `MANAGER_APPROVED / MANAGER_REJECTED` |
| `notifications` | INSERT | → SSE |

---

## API Contract

### `POST /api/v1/trips/:tripId/approve`
**Request:**
```json
{ "comment": "Phê duyệt chuyến công tác — mục tiêu rõ ràng" }
```

**Response 200 (APPROVED):**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvalRecord": {
    "approvalLevel": "LEVEL_1",
    "action": "APPROVED",
    "budgetSnapshot": 8500000,
    "hadViolationsSnapshot": false,
    "actedAt": "2026-08-29T09:00:00Z"
  },
  "approvedAt": "2026-08-29T09:00:00Z"
}
```

**Response 200 (→ PENDING_ADMIN_APPROVAL):**
```json
{
  "id": "uuid",
  "status": "PENDING_ADMIN_APPROVAL",
  "approvalRecord": { "approvalLevel": "LEVEL_1", "action": "APPROVED", ... }
}
```

### `POST /api/v1/trips/:tripId/reject`
**Request:**
```json
{ "comment": "Ngân sách vượt kế hoạch phòng ban Q3. Đề nghị điều chỉnh." }
```
**Response 200:** `{ "id": "uuid", "status": "REJECTED" }`

**Errors:** `400`, `401`, `403`, `404`, `409 INVALID_STATE`, `409 DUPLICATE_APPROVAL`

---

## Authorization

| Role | Quyền |
|---|---|
| `MANAGER` | ✅ approve/reject trip của subordinates |
| `EMPLOYEE` | ❌ 403 |
| `TRAVEL_ADMIN` | ❌ dùng endpoint approve riêng khi PENDING_ADMIN_APPROVAL |
| `FINANCE` | ❌ 403 |

**Resource-level:** `trip.employee.managerId === req.user.id` — kiểm tra trong ApprovalService.

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| `comment` bắt buộc khi Reject | data-model CHECK | Server | 400 |
| `budget ≤ 20M AND no violations` → APPROVED (L1 kết thúc) | BR-TR-04 | ApprovalRouter | `status = APPROVED` |
| `budget > 20M OR violations` → L2 | BR-TR-04 | ApprovalRouter | `status = PENDING_ADMIN_APPROVAL` |
| SELECT FOR UPDATE trước transition | NFR-TR-05 | DB transaction | Chặn race condition |
| UNIQUE INDEX: 1 APPROVED per (tripId, approvalLevel) | data-model | DB | 409 DUPLICATE_APPROVAL |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| Manager approve (kết thúc L1) | `info` | `{ action: "MANAGER_APPROVED", tripId, approverId, budgetSnapshot, newStatus: "APPROVED" }` |
| Manager escalate L2 | `info` | `{ action: "MANAGER_ESCALATED_L2", tripId, reason: "budget>20M OR violations" }` |
| Manager reject | `info` | `{ action: "MANAGER_REJECTED", tripId, approverId }` |
| Double approve blocked | `warn` | `{ action: "DUPLICATE_APPROVAL_BLOCKED", tripId, approvalLevel: "LEVEL_1" }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T5.1 | AC 5.1 | Budget=8M, no violations → approve | `status=APPROVED`, `approvalLevel=LEVEL_1` |
| T5.2 | AC 5.2 | Budget=25M → approve | `status=PENDING_ADMIN_APPROVAL` |
| T5.3 | AC 5.2 | Budget=15M, có 1 violation → approve | `status=PENDING_ADMIN_APPROVAL` |
| T5.4 | AC 5.3 | Manager reject với comment | `status=REJECTED`, `approval_records.action=REJECTED` |
| T5.5 | Error E-01 | Reject không có comment | `400 VALIDATION_ERROR` |
| T5.6 | Error E-02 | Approve trip đang APPROVED | `409 INVALID_STATE` |
| T5.7 | Error E-03 | Manager approve trip của employee không dưới quyền | `403 FORBIDDEN` |
| T5.8 | Error E-04 | 2 managers gửi approve đồng thời | 1 thành công, 1 nhận 409 |
| T5.9 | Auth | EMPLOYEE gọi POST /approve | `403 FORBIDDEN` (NFR-TR-03) |
| T5.10 | Audit | Sau T5.1, query `audit_logs` | Record `MANAGER_APPROVED` tồn tại |
| T5.11 | Audit | Sau T5.4, query `audit_logs` | Record `MANAGER_REJECTED` với comment |
| T5.12 | Notification | Sau T5.1, Employee nhận SSE | `type=TRIP_APPROVED` |
| T5.13 | Notification | Sau T5.2, Travel Admin nhận SSE | `type=PENDING_LEVEL2_APPROVAL` |
| T5.14 | Snapshot | `approval_records.budget_snapshot` | = `trip.estimated_budget` tại thời điểm approve |
| T5.15 | Perf | Approve response time | ≤ 1s (NFR-TR-01) |

**AC Coverage:** AC 5.1 → T5.1 ✅ | AC 5.2 → T5.2, T5.3 ✅ | AC 5.3 → T5.4, T5.5 ✅

---

## Definition of Done

- [ ] `POST /trips/:tripId/approve` hoạt động đúng theo ApprovalRouter (BR-TR-04)
- [ ] `POST /trips/:tripId/reject` bắt buộc `comment`
- [ ] `approval_records` INSERT đúng với snapshot fields
- [ ] Race condition được xử lý bằng `SELECT FOR UPDATE` + UNIQUE INDEX (NFR-TR-05)
- [ ] Notification SSE gửi đến đúng người
- [ ] `audit_logs` có record đầy đủ (NFR-TR-04)
- [ ] 15 test cases T5.1–T5.15 pass
- [ ] Response ≤ 1s (NFR-TR-01)
