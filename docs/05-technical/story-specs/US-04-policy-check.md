# Story Spec

## Story ID
`US-04`

## Requirement IDs
`REQ-TR-03`, `REQ-TR-01`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL]_ → Screen: **Trip Form — Policy Check Result Banner**

## Goal
Hệ thống tự động chạy PolicyCheckEngine khi Employee nộp Trip Request, phát hiện vi phạm hạn mức lưu trú (BR-TR-01), phụ cấp (BR-TR-02), thời hạn gửi (BR-TR-03) và định tuyến duyệt cấp 2 nếu cần (BR-TR-04). Kết quả hiển thị trực quan trên giao diện.

---

## Preconditions
- Employee đã đăng nhập (role = `EMPLOYEE`), là chủ sở hữu trip.
- Trip ở trạng thái `DRAFT`.
- Trip có đủ thông tin: `destination`, `departureDate`, `returnDate`, `estimatedBudget`, `hotelCostPerNight`, `perDiemBudget`.

---

## Happy Path (Policy Check Pass)

1. Employee hoàn tất Trip Request và bấm **"Nộp yêu cầu"**.
2. Client gọi `POST /api/v1/trips/:tripId/submit`.
3. Server (trong 1 transaction):
   a. Khoá row trip (`SELECT FOR UPDATE`).
   b. Chạy `PolicyCheckEngine`:
      - BR-TR-01: `hotelCostPerNight ≤ HOTEL_LIMIT[employee.jobGrade]`
      - BR-TR-02: `perDiemBudget ≤ tripDays × RATE[destinationType]`
      - BR-TR-03: working days diff ≥ 3 hoặc `is_urgent = true`
      - BR-TR-04: `estimatedBudget ≤ 20M AND violations.length === 0`
   c. INSERT `policy_check_results` (snapshot bất biến).
   d. UPDATE `trips.status = 'SUBMITTED'`, set `isUrgent`, `requiresLevel2`.
   e. INSERT `audit_logs`.
4. Server trả 200 với `{ status: "SUBMITTED", policyCheckResult: { passed: true, violations: [] } }`.
5. Client hiển thị **banner xanh** "Policy Check: PASS — Yêu cầu đã được gửi đi.".

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | `hotelCostPerNight > limit` (BR-TR-01) | `violations` có `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET`, banner đỏ/vàng, `requiresLevel2 = true` |
| E-02 | `perDiemBudget > tripDays × rate` (BR-TR-02) | `violations` có `POLICY_VIOLATION_PER_DIEM_EXCEEDED`, banner cảnh báo |
| E-03 | `is_urgent = true` (BR-TR-03) | `violations` có `URGENT_TRIP_NOTICE`, severity WARNING |
| E-04 | `estimatedBudget > 20M` (BR-TR-04) | `requiresLevel2 = true`, `violations` có `POLICY_VIOLATION_BUDGET_THRESHOLD` |
| E-05 | Nhiều vi phạm cùng lúc | Tất cả violations hiển thị; `requiresLevel2 = true` |
| E-06 | Trip không phải DRAFT | `409 INVALID_STATE` |
| E-07 | Trip không thuộc về user | `403 NOT_OWNER` |
| E-08 | Token hết hạn | Auto refresh → retry |
| E-09 | Lỗi server trong PolicyCheck | `500`, audit log ghi lỗi; trip không thay đổi status |

---

## Data Read / Write

### Read
- `users` — lấy `jobGrade` để check BR-TR-01.
- `trips` — lấy `hotelCostPerNight`, `perDiemBudget`, `estimatedBudget`, `departure_date`, `trip_days`, `destinationType`.

### Write
- `trips`: UPDATE `status = SUBMITTED`, `isUrgent`, `requiresLevel2`, `submittedAt`.
- `policy_check_results`: INSERT (snapshot bất biến — không update sau đó).
- `audit_logs`: INSERT `TRIP_SUBMITTED`.
- Notification: INSERT → emit SSE đến Manager.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `trips` | UPDATE | `status`, `is_urgent`, `requires_level2`, `submitted_at` |
| `policy_check_results` | INSERT | Snapshot bất biến, UNIQUE trên `trip_id` (UPSERT nếu resubmit) |
| `audit_logs` | INSERT | `action = TRIP_SUBMITTED` |
| `notifications` | INSERT | → emit SSE → Manager |

---

## API Contract

### `POST /api/v1/trips/:tripId/submit`
**Request Body:** Không cần.

**Response 200 — Pass:**
```json
{
  "id": "uuid",
  "status": "SUBMITTED",
  "isUrgent": false,
  "requiresLevel2": false,
  "submittedAt": "2026-08-28T10:31:00Z",
  "policyCheckResult": {
    "passed": true,
    "violations": [],
    "violationCount": 0,
    "requiresLevel2Approval": false,
    "checkedAt": "2026-08-28T10:31:00Z"
  }
}
```

**Response 200 — Vi phạm (vẫn submit được, nhưng cần L2):**
```json
{
  "id": "uuid",
  "status": "SUBMITTED",
  "isUrgent": false,
  "requiresLevel2": true,
  "policyCheckResult": {
    "passed": false,
    "violations": [
      {
        "code": "POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET",
        "detail": "Hotel 2.000.000 VNĐ/đêm vượt hạn mức STAFF (1.000.000 VNĐ/đêm)",
        "severity": "WARNING",
        "rule": "BR-TR-01",
        "limit": 1000000,
        "actual": 2000000
      }
    ],
    "violationCount": 1,
    "requiresLevel2Approval": true
  }
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`, `500`

---

## Authorization

| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ Submit trip của mình |
| Khác | ❌ 403 |

---

## Validation / Business Rules

| Rule | Code | Logic | `requiresLevel2` |
|---|---|---|---|
| Hotel limit theo jobGrade | `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET` | `hotelCostPerNight > HOTEL_LIMIT[jobGrade]` | ✅ |
| Per Diem cap | `POLICY_VIOLATION_PER_DIEM_EXCEEDED` | `perDiemBudget > tripDays × RATE[destType]` | ✅ |
| Advance notice | `URGENT_TRIP_NOTICE` | `workingDaysDiff < 3` | ✅ |
| Budget threshold | `POLICY_VIOLATION_BUDGET_THRESHOLD` | `estimatedBudget > 20_000_000` | ✅ |

**Hotel Limits (BR-TR-01):**
```
STAFF         → 1.000.000 VNĐ/đêm
MANAGER_GRADE → 1.800.000 VNĐ/đêm
DIRECTOR      → 3.000.000 VNĐ/đêm
```

**Per Diem Rates (BR-TR-02):**
```
TIER1_CITY → 400.000 VNĐ/ngày
OTHER      → 300.000 VNĐ/ngày
```

**Transaction scope:** Toàn bộ PolicyCheck + UPDATE trips + INSERT policy_check_results + INSERT audit_logs nằm trong 1 `prisma.$transaction`.

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| PolicyCheck chạy | `info` | `{ tripId, employeeId, jobGrade, destinationType }` |
| PolicyCheck pass | `info` | `{ action: "POLICY_CHECK_PASS", tripId }` |
| PolicyCheck violation | `warn` | `{ action: "POLICY_CHECK_VIOLATION", tripId, violations: [...], requiresLevel2 }` |
| Trip submitted | `info` | `{ action: "TRIP_SUBMITTED", tripId, status: "SUBMITTED", requiresLevel2 }` |
| Notification sent | `info` | `{ action: "NOTIFICATION_SENT", recipientId: managerId, type: "PENDING_LEVEL1_APPROVAL" }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T4.1 | AC 4.1 | Không vi phạm (hotel=800k STAFF, per diem đúng, 7 ngày trước) | `passed=true`, banner xanh |
| T4.2 | AC 4.2 | `hotelCostPerNight=1500000`, `jobGrade=STAFF` (limit=1M) | `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET`, `requiresLevel2=true` |
| T4.3 | AC 4.2 | `perDiemBudget=2000000`, TIER1_CITY, `tripDays=3` (max=1.2M) | `POLICY_VIOLATION_PER_DIEM_EXCEEDED` |
| T4.4 | AC 4.2 | `estimatedBudget=25000000` (> 20M) | `POLICY_VIOLATION_BUDGET_THRESHOLD`, `requiresLevel2=true` |
| T4.5 | AC 4.2 | `is_urgent=true` | `URGENT_TRIP_NOTICE`, severity=WARNING |
| T4.6 | Combo | Hotel vượt + Budget > 20M | 2 violations, `requiresLevel2=true` |
| T4.7 | Error E-06 | Submit trip đang SUBMITTED | `409 INVALID_STATE` |
| T4.8 | Auth | MANAGER submit trip của employee khác | `403` |
| T4.9 | Transaction | PolicyCheck lỗi giữa chừng | Trip giữ nguyên DRAFT, không có policy_check_result |
| T4.10 | Audit | Sau T4.1, query `audit_logs` | Record `TRIP_SUBMITTED` tồn tại |
| T4.11 | Snapshot | Sau submit, sửa `estimatedBudget` của trip | `policy_check_results.violations` không thay đổi |
| T4.12 | Perf | Submit và nhận kết quả | ≤ 1s (NFR-TR-01) |

**AC Coverage:** AC 4.1 → T4.1 ✅ | AC 4.2 → T4.2–T4.6 ✅

---

## Definition of Done

- [ ] `POST /trips/:tripId/submit` chạy PolicyCheckEngine server-side
- [ ] 4 violation codes hoạt động đúng theo BR-TR-01, 02, 03, 04
- [ ] `requiresLevel2` được set đúng theo kết quả PolicyCheck + budget
- [ ] `policy_check_results` là snapshot bất biến sau submit
- [ ] Toàn bộ trong 1 DB transaction (NFR-TR-05)
- [ ] Notification gửi đến Manager sau submit (REQ-TR-11)
- [ ] `audit_logs` có record `TRIP_SUBMITTED` (NFR-TR-04)
- [ ] 12 test cases T4.1–T4.12 pass
- [ ] Response ≤ 1s (NFR-TR-01)

> **⚠️ Cần xác nhận trước khi code:**
> 1. Employee có thể submit trip dù có vi phạm không? (Hiện tại: có — vi phạm không block submit, chỉ route sang L2)
> 2. Nếu trip đã SUBMITTED, có cho phép submit lại (resubmit sau khi sửa DRAFT) không?
