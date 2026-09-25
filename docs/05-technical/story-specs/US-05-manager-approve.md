# Story Spec

## Story ID
`US-05`

## Requirement IDs
`REQ-TR-04`, `NFR-TR-01`, `NFR-TR-03`, `NFR-TR-04`, `NFR-TR-05`

## Design link
Figma: _[Prototype URL]_ → Screen: **Manager Approval Queue** + **Trip Detail — Approval Panel**

## Goal
Manager xem danh sách Trip Request đang chờ duyệt (`status=SUBMITTED`), xem lý do duyệt 2 cấp nếu có (`ApprovalReasonsBanner`), rồi Approve hoặc Reject. Hệ thống tự định tuyến sang cấp 2 nếu `requiresLevel2 = true` (BR-TR-04).

---

## Preconditions
- Manager đã đăng nhập (role = `MANAGER`).
- Trip có `status = 'SUBMITTED'` và `trip.employee.managerId = req.user.id`.
- `trip.approvalReasons[]` đã được tính tại lúc submit (snapshot).

---

## Happy Path — Approve (Cấp 1 kết thúc)

1. Manager mở Trip Detail → thấy `ApprovalReasonsBanner` nếu `requiresLevel2 = true`:
   - Banner hiển thị từng lý do (title + detail đầy đủ).
   - Dòng phụ: "Sau khi bạn duyệt, yêu cầu sẽ chuyển sang Travel Admin/Director (cấp 2)."
2. Manager bấm **"Phê duyệt cấp 1"**.
3. Server: `requiresLevel2 = false` → `status = APPROVED`; `requiresLevel2 = true` → `status = PENDING_ADMIN_APPROVAL`.

---

## Happy Path — Approve (Cần Cấp 2)

- Sau khi Manager approve, nếu `approvalReasons.length > 0` → `status = PENDING_ADMIN_APPROVAL`.
- Travel Admin nhận notification.

---

## Danh sách chờ duyệt — TwoLevelBadge

Trong danh sách trip chờ duyệt, mỗi trip có `requiresLevel2 = true` hiển thị nhãn **"Duyệt 2 cấp"** kèm tooltip tóm tắt lý do (ví dụ: "Khẩn cấp · Vượt hạn mức · Ngân sách > 20 triệu").

---

## API Contract

### `GET /api/v1/trips/:tripId`
Trả thêm:
```json
{
  "requiresLevel2": true,
  "approvalReasons": [
    { "code": "COMBINED_COST_LIMIT_EXCEEDED", "title": "...", "detail": "...", "data": {} }
  ],
  "level1Approval": null
}
```

### `POST /api/v1/trips/:tripId/approve`
**Response 200 (→ PENDING_ADMIN_APPROVAL):**
```json
{
  "id": "uuid",
  "status": "PENDING_ADMIN_APPROVAL",
  "approvalRecord": { "approvalLevel": "LEVEL_1", "action": "APPROVED" }
}
```

---

## Validation / Business Rules (D-16)

| Rule | Logic | Hành vi |
|---|---|---|
| `requiresLevel2 = approvalReasons.length > 0` | nguồn sự thật duy nhất | `PENDING_ADMIN_APPROVAL` nếu true |
| Manager chỉ approve trip của subordinates | `trip.employee.managerId === approverId` | 403 nếu không match |
| Reject bắt buộc `comment` | server check | 400 nếu thiếu |

---

## Test Plan (cập nhật D-16)

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T5.1 | L1 kết thúc | Budget=8M, `approvalReasons=[]` → approve | `status=APPROVED` |
| T5.2 | L1 → L2 | `approvalReasons=[BUDGET_OVER_THRESHOLD]` → approve | `status=PENDING_ADMIN_APPROVAL` |
| T5.3 | L1 → L2 | `approvalReasons=[COMBINED_COST_LIMIT_EXCEEDED]` → approve | `status=PENDING_ADMIN_APPROVAL` |
| T5.4 | L1 → L2 | `approvalReasons=[URGENT_TRIP]` → approve | `status=PENDING_ADMIN_APPROVAL` |
| T5.5 | Reject | Manager reject với comment | `status=REJECTED` |
| T5.6 | Error | Reject không có comment | `400 VALIDATION_ERROR` |
| T5.7 | Auth | Manager approve trip không phải subordinate | `403 FORBIDDEN` |
| T5.8 | ApprovalReasons | GET trip → `approvalReasons` đầy đủ | snapshot đúng |
| T5.9 | Banner | Manager thấy ApprovalReasonsBanner với lý do | UI hiển thị đúng |
| T5.10 | TwoLevelBadge | Danh sách: trip L2 có badge | badge + tooltip |


## FIX-08 transaction/concurrency contract

Current SQLite implementation uses [runMutation writer reservation](../concurrency.md). Read/current-state validation/dependent writes/audit/notification persistence share one transaction. SSE follows commit. Expected stale transitions return 409 INVALID_STATUS_TRANSITION, CLOSED returns 409 TRIP_IMMUTABLE, exhausted lock retries return 409 CONCURRENT_MODIFICATION; authorization remains 403. A deleted resource is 404. Tests: `src/backend/src/__tests__/concurrency.test.ts` (independent real connections + HTTP + rollback faults). No claim of production load verification.
