# Story Spec

## Story ID
`US-06`

## Requirement IDs
`REQ-TR-05`, `NFR-TR-01`, `NFR-TR-03`, `NFR-TR-04`, `NFR-TR-05`

## Design link
Figma: _[Prototype URL]_ → Screen: **Travel Admin Queue** + **Trip Detail — Level 2 Approval Panel**

## Goal
Travel Admin xem và xử lý các Trip Request đã qua duyệt cấp 1 nhưng cần thẩm định cấp 2 (budget > 20M hoặc có vi phạm policy). Approve phát hành chuyến đi chính thức; Reject đóng yêu cầu.

---

## Preconditions
- Travel Admin đã đăng nhập (role = `TRAVEL_ADMIN`).
- Trip có `status = 'PENDING_ADMIN_APPROVAL'`.
- Manager cấp 1 đã có `approval_records` với `action=APPROVED, approvalLevel=LEVEL_1`.

---

## Happy Path — Approve Cấp 2

1. Travel Admin vào Dashboard → widget "Chờ duyệt cấp 2".
2. `GET /api/v1/dashboard` → trips với `status=PENDING_ADMIN_APPROVAL`.
3. Travel Admin mở Trip Detail, xem `policyCheckResult`, `approvalRecords[L1]`, itinerary, expense dự toán.
4. Travel Admin bấm **"Phê duyệt Cấp 2"** + nhập comment (tuỳ chọn).
5. Client gọi `POST /api/v1/trips/:tripId/approve`.
6. Server (transaction): `status = APPROVED`, INSERT `approval_records` (LEVEL_2, APPROVED), INSERT audit_log, emit → Employee.
7. Client toast "Chuyến đi đã được phát hành chính thức.".

---

## Happy Path — Reject Cấp 2

1–4 như trên, Travel Admin bấm **"Từ chối"** + nhập lý do bắt buộc.
5. Client gọi `POST /api/v1/trips/:tripId/reject`.
6. Server: `status = REJECTED`, INSERT `approval_records` (LEVEL_2, REJECTED, comment), emit → Employee.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Reject không có comment | `400 VALIDATION_ERROR` |
| E-02 | Trip không phải `PENDING_ADMIN_APPROVAL` | `409 INVALID_STATE` |
| E-03 | MANAGER cố gọi L2 approve | `403 FORBIDDEN` (server kiểm tra `trip.status`) |
| E-04 | Double approve đồng thời | UNIQUE INDEX chặn → `409 DUPLICATE_APPROVAL` |
| E-05 | Token hết hạn | Auto refresh → retry |
| E-06 | EMPLOYEE gọi approve | `403 FORBIDDEN` (NFR-TR-03) |

---

## Data Read / Write

### Read
- `GET /api/v1/dashboard` — danh sách PENDING_ADMIN_APPROVAL.
- `GET /api/v1/trips/:tripId` — full detail + L1 approval record.

### Write — Approve L2
- `trips`: UPDATE `status = APPROVED`, `approved_at`.
- `approval_records`: INSERT (LEVEL_2, APPROVED, budgetSnapshot, hadViolationsSnapshot).
- `audit_logs`: INSERT `ADMIN_APPROVED`.
- `notifications`: INSERT → SSE → Employee.

### Write — Reject L2
- `trips`: UPDATE `status = REJECTED`.
- `approval_records`: INSERT (LEVEL_2, REJECTED, comment).
- `audit_logs`: INSERT `ADMIN_REJECTED`.
- `notifications`: INSERT → SSE → Employee.

---

## API Contract

Dùng chung endpoint với US-05:

### `POST /api/v1/trips/:tripId/approve`
Server tự xác định đây là L2 dựa trên `trip.status = PENDING_ADMIN_APPROVAL` và `req.user.role = TRAVEL_ADMIN`.

**Response 200:**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvalRecord": {
    "approvalLevel": "LEVEL_2",
    "action": "APPROVED",
    "budgetSnapshot": 25000000,
    "hadViolationsSnapshot": true,
    "actedAt": "2026-08-30T10:00:00Z"
  },
  "approvedAt": "2026-08-30T10:00:00Z"
}
```

### `POST /api/v1/trips/:tripId/reject`
**Request:** `{ "comment": "Lịch trình không khả thi, quá nhiều điểm đến trong 2 ngày." }`

---

## Authorization

| Role | Quyền |
|---|---|
| `TRAVEL_ADMIN` | ✅ approve/reject khi `status=PENDING_ADMIN_APPROVAL` |
| `MANAGER` | ❌ — L2 endpoint dành riêng cho TRAVEL_ADMIN |
| `EMPLOYEE` | ❌ 403 |

Server check: `req.user.role === 'TRAVEL_ADMIN' && trip.status === 'PENDING_ADMIN_APPROVAL'`.

---

## Validation / Business Rules

| Rule | Nguồn | Hành vi |
|---|---|---|
| `comment` bắt buộc khi Reject | BR / data-model | 400 |
| Trip phải ở `PENDING_ADMIN_APPROVAL` | State machine | 409 INVALID_STATE |
| UNIQUE INDEX per (tripId, LEVEL_2) | DB | 409 DUPLICATE_APPROVAL |
| SELECT FOR UPDATE | NFR-TR-05 | Chặn race condition |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| Admin approve L2 | `info` | `{ action: "ADMIN_APPROVED", tripId, approverId, newStatus: "APPROVED" }` |
| Admin reject L2 | `info` | `{ action: "ADMIN_REJECTED", tripId, approverId, comment }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T6.1 | AC 6.1 | Approve trip PENDING_ADMIN_APPROVAL | `status=APPROVED`, `approvalLevel=LEVEL_2` |
| T6.2 | AC 6.2 | Reject với comment | `status=REJECTED`, comment lưu |
| T6.3 | Error E-01 | Reject không có comment | 400 |
| T6.4 | Error E-02 | Approve trip đang SUBMITTED (chưa qua L1) | 409 INVALID_STATE |
| T6.5 | Auth E-03 | MANAGER gọi approve PENDING_ADMIN_APPROVAL | 403 |
| T6.6 | Auth E-06 | EMPLOYEE gọi approve | 403 (NFR-TR-03) |
| T6.7 | Audit | Sau T6.1, query `audit_logs` | Record `ADMIN_APPROVED` |
| T6.8 | Notification | Sau T6.1, Employee nhận SSE | `type=TRIP_APPROVED` |
| T6.9 | Snapshot | `approval_records[LEVEL_2].budget_snapshot` | Đúng với trip.estimatedBudget |
| T6.10 | Race | 2 Admin approve đồng thời | 1 thành công, 1 nhận 409 |

**AC Coverage:** AC 6.1 → T6.1 ✅ | AC 6.2 → T6.2, T6.3 ✅

---

## Definition of Done

- [ ] `POST /trips/:tripId/approve` (TRAVEL_ADMIN + PENDING_ADMIN_APPROVAL) → `APPROVED`
- [ ] `POST /trips/:tripId/reject` bắt buộc comment
- [ ] `approval_records` INSERT LEVEL_2 với snapshot
- [ ] Race condition xử lý đúng (NFR-TR-05)
- [ ] Notification Employee nhận sau approve/reject (REQ-TR-11)
- [ ] `audit_logs` đầy đủ (NFR-TR-04)
- [ ] 10 test cases T6.1–T6.10 pass
