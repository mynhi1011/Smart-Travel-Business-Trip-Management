# Story Spec

## Story ID
`US-06`

## Requirement IDs
`REQ-TR-05`, `NFR-TR-01`, `NFR-TR-03`, `NFR-TR-04`, `NFR-TR-05`

## Design link
Figma: _[Prototype URL]_ → Screen: **Travel Admin Queue** + **Trip Detail — Level 2 Approval Panel**

## Goal
Travel Admin xem và xử lý Trip Request ở `PENDING_ADMIN_APPROVAL`. Màn hình hiển thị `ApprovalReasonsBanner` với lý do 2 cấp + thông tin Manager đã duyệt cấp 1.

---

## Preconditions
- Travel Admin đã đăng nhập (role = `TRAVEL_ADMIN`).
- Trip có `status = 'PENDING_ADMIN_APPROVAL'`.
- `trip.approvalReasons[]` có ít nhất 1 phần tử.
- `trip.level1Approval` không null (Manager đã approve LEVEL_1).

---

## Happy Path — Approve Cấp 2

1. Travel Admin mở Trip Detail → thấy `ApprovalReasonsBanner` (level=2):
   - Hiển thị từng lý do duyệt 2 cấp (snapshot từ lúc submit).
   - Dòng phụ: "Đã duyệt cấp 1 bởi **[tên Manager]**, lúc **[thời gian]**, ghi chú: **[comment]**."
2. Travel Admin bấm **"Phê duyệt Cấp 2"** + comment (tùy chọn).
3. Server: `status = APPROVED`, INSERT `approval_records` (LEVEL_2).

---

## Danh sách chờ duyệt cấp 2 — TwoLevelBadge

Trong danh sách `PENDING_ADMIN_APPROVAL`, mỗi trip hiển thị nhãn **"Duyệt 2 cấp"** + tooltip tóm tắt lý do.

---

## API Contract

### `GET /api/v1/trips/:tripId`
Khi `status = PENDING_ADMIN_APPROVAL`:
```json
{
  "requiresLevel2": true,
  "approvalReasons": [
    { "code": "URGENT_TRIP", "title": "Chuyến đi khẩn cấp", "detail": "Yêu cầu gửi dưới 3 ngày làm việc... Lý do khẩn cấp: ...", "data": {} }
  ],
  "level1Approval": {
    "approverName": "Trần Thị Lan",
    "approvedAt": "2026-09-24T09:00:00Z",
    "comment": "Đã xem xét, chuyển Admin duyệt"
  }
}
```

### `POST /api/v1/trips/:tripId/approve` (Travel Admin + PENDING_ADMIN_APPROVAL)
**Response 200:**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvalRecord": { "approvalLevel": "LEVEL_2", "action": "APPROVED" }
}
```

---

## Test Plan (cập nhật D-16)

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T6.1 | Approve L2 | Approve trip PENDING_ADMIN_APPROVAL | `status=APPROVED`, `approvalLevel=LEVEL_2` |
| T6.2 | Reject L2 | Reject với comment | `status=REJECTED`, comment lưu |
| T6.3 | Error | Reject không comment | 400 |
| T6.4 | ApprovalReasons | GET trip → `approvalReasons[]` + `level1Approval` | snapshot đầy đủ |
| T6.5 | Banner L2 | Travel Admin thấy ApprovalReasonsBanner (level=2) + level1Approval | UI đúng |
| T6.6 | TwoLevelBadge | Danh sách cấp 2 có badge + tooltip | badge hiển thị |
| T6.7 | Auth | MANAGER gọi approve PENDING_ADMIN_APPROVAL | 403 |
| T6.8 | Audit | Sau T6.1 | `ADMIN_APPROVED` trong audit_logs |
