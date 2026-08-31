# Story Spec

## Story ID
`US-10`

## Requirement IDs
`REQ-TR-11` (In-app Notification), `REQ-TR-12` (PDF Export), `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit)

## Design link
Figma: _[Prototype URL]_ → Screen: **Notification Bell Dropdown** + **"Export PDF" Button on Trip Detail**

## Goal
**US-10A (Notification):** Người dùng nhận thông báo in-app real-time khi trạng thái Trip/Expense thay đổi. Badge số đếm cập nhật ngay qua SSE.  
**US-10B (PDF Export):** Người dùng xuất file PDF tóm tắt chuyến công tác khi trip ở trạng thái APPROVED hoặc CLOSED.

---

## Preconditions

### Notification (US-10A)
- Người dùng đã đăng nhập, đang có SSE connection active.
- Có action nghiệp vụ vừa xảy ra (approve, reject, close...).

### PDF Export (US-10B)
- Người dùng đã đăng nhập (role = `EMPLOYEE` owner hoặc `FINANCE`).
- `trip.status IN ('APPROVED', 'ONGOING', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'CLOSED')`.

---

## Happy Path — Notification (US-10A)

1. User đang online, browser giữ SSE connection tới `GET /api/v1/notifications/stream`.
2. Sự kiện nghiệp vụ xảy ra (VD: Manager approve trip).
3. Server `NotificationService.emit(userId, { type: 'TRIP_APPROVED', tripId, message })`.
4. Server INSERT `notifications` record, broadcast SSE event đến client của user.
5. Client nhận SSE event → tăng badge số đếm trên icon chuông.
6. User click chuông → dropdown hiển thị danh sách notifications.
7. User click 1 notification → `PATCH /api/v1/notifications/:id/read` → `isRead = true`, badge giảm.
8. User click **"Đánh dấu tất cả đã đọc"** → `PATCH /api/v1/notifications/read-all`.

---

## Happy Path — PDF Export (US-10B)

1. User mở trang Trip Detail (trip APPROVED hoặc CLOSED).
2. User bấm **"Xuất PDF"**.
3. Client gọi `GET /api/v1/trips/:tripId/export-pdf`.
4. Server dùng Puppeteer render HTML template → PDF binary.
5. Server trả response `Content-Type: application/pdf` + `Content-Disposition: attachment`.
6. Browser tự động download file `trip-report-<tripId>.pdf`.

---

## Alternate / Error Paths

### Notification
| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | SSE connection bị ngắt | Client auto-reconnect (native EventSource behavior), ping server mỗi 30s |
| E-02 | Token trong query string hết hạn | SSE trả 401, client reconnect với token mới sau refresh |
| E-03 | Đánh dấu đã đọc notification của người khác | `403 NOT_OWNER` |
| E-04 | Lỗi mạng khi mark read | Toast lỗi, badge không thay đổi |

### PDF Export
| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-05 | Trip ở trạng thái DRAFT/SUBMITTED | `409 INVALID_STATE`: "Trip chưa được phê duyệt" |
| E-06 | EMPLOYEE export trip của người khác | `403 NOT_OWNER` |
| E-07 | MANAGER gọi export-pdf | `403 FORBIDDEN` |
| E-08 | Puppeteer lỗi / timeout | `500`: "Không thể tạo PDF. Vui lòng thử lại." |
| E-09 | Token hết hạn | Auto refresh → retry |

---

## Data Read / Write

### Notification Read
- `GET /api/v1/notifications?isRead=false` — danh sách chưa đọc.
- `GET /api/v1/notifications/stream` — SSE stream.

### Notification Write
- `PATCH /api/v1/notifications/:id/read` — mark 1 đã đọc.
- `PATCH /api/v1/notifications/read-all` — mark tất cả.
- `notifications` table: UPDATE `is_read = true`, `read_at = now()`.

### PDF Export Read
- `GET /api/v1/trips/:tripId` — trip detail.
- `GET /api/v1/trips/:tripId/itinerary` — lịch trình.
- `GET /api/v1/trips/:tripId/expense` — expense items.
- `approval_records` — lịch sử phê duyệt.
- Không write vào DB.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `notifications` | UPDATE | `is_read`, `read_at` |
| Không write (PDF) | — | Read-only query |

---

## API Contract

### `GET /api/v1/notifications/stream`
```
GET /api/v1/notifications/stream?token=<accessToken>
Content-Type: text/event-stream

event: notification
data: {"type":"TRIP_APPROVED","tripId":"uuid","message":"Chuyến đi Đà Nẵng đã được phê duyệt","timestamp":"..."}

event: ping
data: {"timestamp":"2026-08-29T09:00:30Z"}
```
> Token qua query param vì EventSource không hỗ trợ Authorization header.

### `GET /api/v1/notifications?isRead=false`
**Response 200:**
```json
{
  "data": [{
    "id": "uuid", "type": "TRIP_APPROVED",
    "message": "Chuyến đi Đà Nẵng đã được phê duyệt",
    "referenceId": "uuid", "referenceType": "TRIP",
    "isRead": false, "readAt": null, "createdAt": "2026-08-29T09:00:00Z"
  }],
  "unreadCount": 3,
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

### `PATCH /api/v1/notifications/:id/read`
**Response 200:** `{ "id": "uuid", "isRead": true, "readAt": "2026-08-29T10:00:00Z" }`

### `PATCH /api/v1/notifications/read-all`
**Response 200:** `{ "updatedCount": 5 }`

### `GET /api/v1/trips/:tripId/export-pdf`
**Response 200:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="trip-report-<tripId>.pdf"
[binary PDF data]
```
**Nội dung PDF:**
- Header: Thông tin nhân viên, trip ID, ngày tạo báo cáo
- Lịch trình theo ngày (bảng)
- Bảng kê chi phí: Dự toán vs Thực tế vs Variance
- Lịch sử phê duyệt (người duyệt, ngày giờ, cấp duyệt)
- Footer: "Tài liệu được tạo bởi Smart Travel System"

---

## Authorization

### Notification
| Role | Quyền |
|---|---|
| ALL | ✅ xem/mark read notification của mình |
| Resource | Chỉ notification của `req.user.id` |

### PDF Export
| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ — trip của mình |
| `FINANCE` | ✅ — tất cả trips |
| `MANAGER` | ❌ 403 |
| `TRAVEL_ADMIN` | ❌ 403 |

---

## Validation / Business Rules

| Rule | Nguồn | Hành vi |
|---|---|---|
| SSE token validate | Architecture | Server check token query param |
| Notification chỉ thấy của mình | NFR-TR-03 | `WHERE recipient_id = req.user.id` |
| PDF chỉ từ APPROVED+ | Architecture | `409 INVALID_STATE` nếu DRAFT/SUBMITTED |
| BR-TR-06: CLOSED trip PDF vẫn xuất được | BR-TR-06 | CLOSED cho phép read; export OK |
| Ping 30s để duy trì SSE | ADR-07 | Server interval |

---

## Observability / Logging

| Event | Level | Nội dung |
|---|---|---|
| SSE connection mở | `info` | `{ action: "SSE_CONNECTED", userId, ip }` |
| SSE connection đóng | `info` | `{ action: "SSE_DISCONNECTED", userId }` |
| Notification emit | `info` | `{ action: "NOTIFICATION_EMITTED", recipientId, type, tripId }` |
| Mark read | `info` | `{ action: "NOTIFICATION_READ", notificationId, userId }` |
| PDF export | `info` | `{ action: "PDF_EXPORTED", tripId, userId, durationMs }` |
| PDF lỗi | `error` | `{ action: "PDF_GENERATION_FAILED", tripId, error }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T10.1 | AC 10.1 | Manager approve trip → Employee đang online | SSE event `TRIP_APPROVED` đến, badge +1 |
| T10.2 | AC 10.1 | Employee click chuông | Dropdown hiện notification list |
| T10.3 | AC 10.1 | Click mark read | `isRead=true`, badge -1 |
| T10.4 | AC 10.1 | "Đánh dấu tất cả đã đọc" | `updatedCount = N`, badge = 0 |
| T10.5 | AC 10.2 | Trip APPROVED → export PDF | File download, Content-Type = application/pdf |
| T10.6 | AC 10.2 | PDF có đủ 4 section | Kiểm tra nội dung file |
| T10.7 | AC 10.2 | Trip CLOSED → export PDF | 200, file download thành công |
| T10.8 | Error E-01 | Ngắt kết nối mạng 5s | EventSource auto-reconnect |
| T10.9 | Error E-05 | Trip DRAFT → export PDF | 409 INVALID_STATE |
| T10.10 | Error E-06 | EMPLOYEE export trip người khác | 403 NOT_OWNER |
| T10.11 | Error E-07 | MANAGER gọi export-pdf | 403 FORBIDDEN |
| T10.12 | Auth E-03 | Mark read notification của người khác | 403 NOT_OWNER |
| T10.13 | Edge | Khi không có unread | `unreadCount=0`, badge ẩn (không hiện "0") |
| T10.14 | Edge | `/notifications/read-all` trước `/notifications/:id/read` trong router | `read-all` không bị shadow bởi `:id` |
| T10.15 | Perf | `GET /notifications` response time | ≤ 1s (NFR-TR-01) |

**AC Coverage:** AC 10.1 → T10.1–T10.4 ✅ | AC 10.2 → T10.5–T10.7 ✅

---

## Definition of Done

- [ ] SSE stream `GET /notifications/stream` hoạt động, ping 30s
- [ ] Notification INSERT + SSE emit trong mọi action nghiệp vụ (approve, reject, close...)
- [ ] Mark read (đơn / tất cả) hoạt động đúng
- [ ] Badge số đếm cập nhật real-time qua SSE
- [ ] `GET /trips/:tripId/export-pdf` tạo PDF đúng nội dung
- [ ] PDF chỉ cho EMPLOYEE (owner) và FINANCE
- [ ] Chỉ export được khi trip APPROVED+
- [ ] Router order: `/read-all` trước `/:id/read` (tránh shadow)
- [ ] 15 test cases T10.1–T10.15 pass
- [ ] Response ≤ 1s cho notification list (NFR-TR-01)

> **⚠️ Cần xác nhận trước khi code:**
> 1. SSE token trong query string có timeout riêng không, hay dùng cùng 15 phút với access token?
> 2. PDF có cần phông chữ tiếng Việt đặc biệt trong Puppeteer (NotoSans) hay dùng font hệ thống?
> 3. Notification có lưu giữ tối đa bao lâu? (30 ngày? không giới hạn?)
