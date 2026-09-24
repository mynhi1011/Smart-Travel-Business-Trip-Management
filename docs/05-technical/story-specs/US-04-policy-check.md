# Story Spec

## Story ID
`US-04`

## Requirement IDs
`REQ-TR-03`, `REQ-TR-01`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL]_ → Screen: **Trip Form — Policy Check Result Banner**

## Goal
Hệ thống tự động chạy PolicyCheckEngine khi Employee nộp Trip Request. Kiểm tra: tổng hạn mức kết hợp BR-TR-08, thời hạn gửi BR-TR-03, ngưỡng ngân sách BR-TR-04. Tính `approvalReasons[]` snapshot. Kết quả hiển thị trực quan.

---

## Preconditions
- Employee đã đăng nhập (role = `EMPLOYEE`), là chủ sở hữu trip.
- Trip ở trạng thái `DRAFT`.
- Trip có: `destination`, `departureDate`, `returnDate`, `estimatedBudget`.
- **Không cần** `hotelCostPerNight`, `perDiemBudget` (đã xóa theo D-16).

---

## Happy Path (Policy Check Pass)

1. Employee hoàn tất Trip Request và bấm **"Nộp yêu cầu"**.
2. Client gọi `POST /api/v1/trips/:tripId/submit`.
3. Server (trong 1 transaction):
   a. Khoá row trip.
   b. Lấy `user.jobGrade` từ DB (không từ client).
   c. Tự tính `destinationType = resolveDestinationType(destination)`.
   d. Chạy `PolicyCheckEngine` (BR-TR-03, BR-TR-04, BR-TR-08).
   e. Tính `approvalReasons = buildApprovalReasons(...)`.
   f. INSERT/UPSERT `policy_check_results`.
   g. UPDATE `trips`: `status = SUBMITTED`, `isUrgent`, `requiresLevel2`, `approvalReasons` (JSON).
   h. INSERT `audit_logs`.
4. Server trả 200 với `{ status, approvalReasons[], policyCheckResult, requiresLevel2 }`.
5. Client hiển thị **banner xanh** "Yêu cầu đã được gửi" hoặc banner cảnh báo nếu có vi phạm.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | `plannedBudget > Combined_Limit` (BR-TR-08) | Một cảnh báo `COMBINED_COST_LIMIT_EXCEEDED`; lý do trong `approvalReasons`; không chặn submit |
| E-02 | `is_urgent = true` (BR-TR-03) | Lý do `URGENT_TRIP` trong `approvalReasons`; `requiresLevel2 = true` |
| E-03 | `estimatedBudget > 20M` (BR-TR-04) | Lý do `BUDGET_OVER_THRESHOLD` trong `approvalReasons`; `requiresLevel2 = true` |
| E-04 | Nhiều điều kiện cùng lúc | Tất cả lý do trong `approvalReasons`; `requiresLevel2 = true` |
| E-05 | Trip không phải DRAFT | `409 INVALID_STATE` |
| E-06 | Trip không thuộc về user | `403 NOT_OWNER` |

---

## Data Read / Write

### Read
- `users` — lấy `jobGrade` (BE, không từ client).
- `trips` — lấy `destination`, `estimatedBudget`, `departureDate`, `returnDate`, `isUrgent`, `urgencyReason`.

### Write
- `trips`: UPDATE `status`, `isUrgent`, `requiresLevel2`, `approvalReasons`, `submittedAt`.
- `policy_check_results`: UPSERT (snapshot bất biến — UPSERT khi resubmit).
- `audit_logs`: INSERT `TRIP_SUBMITTED`.
- `notifications`: INSERT → emit SSE đến Manager.

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
  "approvalReasons": [],
  "submittedAt": "2026-09-24T10:31:00Z",
  "policyCheckResult": {
    "passed": true,
    "violations": [],
    "violationCount": 0,
    "requiresLevel2Approval": false
  }
}
```

**Response 200 — Vi phạm (vẫn submit được, cần L2):**
```json
{
  "id": "uuid",
  "status": "SUBMITTED",
  "isUrgent": false,
  "requiresLevel2": true,
  "approvalReasons": [
    {
      "code": "COMBINED_COST_LIMIT_EXCEEDED",
      "title": "Vượt tổng hạn mức lưu trú và phụ cấp",
      "detail": "Vi phạm chính sách: Ngân sách dự kiến 3.300.000 VNĐ vượt tổng hạn mức 3.200.000 VNĐ (Staff, 3 ngày / 2 đêm, Hà Nội / TP.HCM / Đà Nẵng).",
      "data": { "plannedBudget": 3300000, "combinedLimit": 3200000, "tripDays": 3, "hotelNights": 2, "jobGrade": "STAFF", "destinationType": "TIER1_CITY" }
    }
  ],
  "policyCheckResult": {
    "passed": false,
    "violations": [{ "code": "COMBINED_COST_LIMIT_EXCEEDED", "severity": "WARNING", "rule": "BR-TR-08", "limit": 3200000, "actual": 3300000 }],
    "violationCount": 1,
    "requiresLevel2Approval": true
  }
}
```

---

## Validation / Business Rules (D-16)

| Rule | Code | Logic | `requiresLevel2` |
|---|---|---|---|
| Advance notice | `URGENT_TRIP_NOTICE` | `workingDaysDiff < 3` | ✅ |
| Budget threshold | `POLICY_VIOLATION_BUDGET_THRESHOLD` | `estimatedBudget > 20_000_000` | ✅ |
| Combined cost | `COMBINED_COST_LIMIT_EXCEEDED` | `plannedBudget > (HOTEL_LIMIT[jobGrade] × hotelNights) + (tripDays × PER_DIEM_RATE[destType])` | ✅ |

`requiresLevel2 = approvalReasons.length > 0` — nguồn sự thật duy nhất.

---

## Test Plan (cập nhật D-16)

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T4.1 | Happy | Staff/TPHCM/3ngày/2M — không vi phạm | `passed=true`, `approvalReasons=[]`, `requiresLevel2=false` |
| T4.2 | BR-TR-08 | Staff/TPHCM/3ngày/3.3M — vượt 3.2M | `COMBINED_COST_LIMIT_EXCEEDED`, `requiresLevel2=true` |
| T4.3 | BR-TR-08 | Staff/TPHCM/3ngày/3.2M — đúng hạn mức | không cảnh báo |
| T4.4 | BR-TR-04 | `estimatedBudget=25M` | `POLICY_VIOLATION_BUDGET_THRESHOLD`, `requiresLevel2=true` |
| T4.5 | BR-TR-03 | `is_urgent=true` | `URGENT_TRIP_NOTICE`, `requiresLevel2=true` |
| T4.6 | Combo | Cả 3 điều kiện | 3 approvalReasons, `requiresLevel2=true` |
| T4.7 | Error | Submit trip đang SUBMITTED | `409 INVALID_STATE` |
| T4.8 | Auth | MANAGER submit trip của employee khác | `403` |
| T4.9 | Snapshot | Sau submit, sửa `estimatedBudget` | `policy_check_results` không thay đổi |
| T4.10 | Snapshot | Trip CLOSED: `approvalReasons` không thay đổi | Bất biến (BR-TR-06) |
