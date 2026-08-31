# Story Spec

## Story ID
`US-03`

## Requirement IDs
`REQ-TR-06`, `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL]_ → Screen: **Itinerary Builder** (table/timeline view theo ngày)

## Goal
Cho phép Employee xem, thêm, sửa, xóa các mốc hoạt động trong lịch trình công tác. Hệ thống cảnh báo khi chi phí khách sạn vượt hạn mức theo cấp bậc (BR-TR-01). Toàn bộ bị chặn khi trip ở trạng thái `CLOSED`.

---

## Preconditions
- Employee đã đăng nhập (role = `EMPLOYEE`).
- Trip tồn tại, thuộc về Employee.
- `trip.status` không phải `CLOSED` (mọi write bị `immutableGuard` chặn).

---

## Happy Path

### Thêm item thủ công
1. Employee mở trang **Itinerary Builder** của trip.
2. Client gọi `GET /api/v1/trips/:tripId/itinerary` → render timeline theo ngày.
3. Employee bấm **"+ Thêm hoạt động"**, chọn ngày, buổi, nhập địa điểm, hoạt động, danh mục, chi phí ước tính.
4. Employee bấm **Lưu** → `POST /api/v1/trips/:tripId/itinerary`.
5. Server trả 201, client thêm item vào timeline và cập nhật `totalEstimatedCost`.

### Sửa item
1. Employee click vào item → form edit hiện ra (pre-filled).
2. Employee sửa và bấm **Lưu** → `PATCH /api/v1/trips/:tripId/itinerary/:itemId`.
3. Client cập nhật item trên UI.

### Xóa item
1. Employee click **Xóa** trên một item.
2. Client hiển thị confirm dialog.
3. Confirm → `DELETE /api/v1/trips/:tripId/itinerary/:itemId`.
4. Client xóa item khỏi timeline, cập nhật `totalEstimatedCost`.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | `itemDate` nằm ngoài `[departureDate, returnDate]` | `422`: "Ngày hoạt động phải nằm trong thời gian chuyến đi" |
| E-02 | `hotelCostPerNight` vượt hạn mức job_grade (BR-TR-01) | Client cảnh báo đỏ inline: "Chi phí khách sạn vượt hạn mức [X] VNĐ/đêm theo cấp bậc của bạn. Vui lòng nhập giải trình." — vẫn cho phép lưu nếu có giải trình |
| E-03 | `estimatedCost < 0` | `400 VALIDATION_ERROR` |
| E-04 | Trip đã CLOSED | `409 TRIP_IMMUTABLE`: "Chuyến đi đã đóng hồ sơ, không thể chỉnh sửa." |
| E-05 | Trip không phải DRAFT (đã SUBMITTED, APPROVED...) | Tuỳ thiết kế: vẫn cho chỉnh sửa itinerary (chỉ CLOSED mới block) |
| E-06 | Xóa item không tồn tại | `404 NOT_FOUND` |
| E-07 | Token hết hạn | Auto refresh → retry |
| E-08 | `itemId` thuộc trip của người khác | `403 NOT_OWNER` |
| E-09 | Lỗi mạng | Toast lỗi, thao tác không được thực hiện |

---

## Data Read / Write

### Read
- `GET /api/v1/trips/:tripId/itinerary` — lấy danh sách items, `totalEstimatedCost`.
- `GET /api/v1/auth/me` — lấy `jobGrade` để tính hotel limit hint (BR-TR-01).

### Write
- `POST /api/v1/trips/:tripId/itinerary` — thêm item.
- `PATCH /api/v1/trips/:tripId/itinerary/:itemId` — sửa item.
- `DELETE /api/v1/trips/:tripId/itinerary/:itemId` — xóa item.
- `audit_logs`: INSERT `ITINERARY_ITEM_CREATED / UPDATED / DELETED`.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `itinerary_items` | INSERT / UPDATE / DELETE | Blocked khi trip CLOSED |
| `audit_logs` | INSERT | Mỗi mutation |

---

## API Contract

### `GET /api/v1/trips/:tripId/itinerary`
**Response 200:**
```json
{
  "tripId": "uuid",
  "totalEstimatedCost": 5200000,
  "items": [
    {
      "id": "uuid",
      "itemDate": "2026-09-20",
      "dayNumber": 1,
      "timeSlot": "MORNING",
      "location": "Sân bay Nội Bài",
      "activity": "Di chuyển HN → ĐN",
      "category": "TRANSPORT",
      "estimatedCost": 1500000,
      "notes": null,
      "isAiGenerated": false,
      "sortOrder": 0
    }
  ]
}
```

### `POST /api/v1/trips/:tripId/itinerary`
**Request:**
```json
{
  "itemDate": "2026-09-20",
  "timeSlot": "MORNING",
  "location": "Sân bay Nội Bài",
  "activity": "Di chuyển HN → ĐN",
  "category": "TRANSPORT",
  "estimatedCost": 1500000,
  "notes": "Chuyến bay VN-123 07:00",
  "sortOrder": 0
}
```
**Response 201:** `ItineraryItem` object.

### `PATCH /api/v1/trips/:tripId/itinerary/:itemId`
**Request:** Tất cả fields optional.  
**Response 200:** `ItineraryItem` object.

### `DELETE /api/v1/trips/:tripId/itinerary/:itemId`
**Response 204.**

**Errors chung:** `400`, `401`, `403`, `404`, `409 TRIP_IMMUTABLE`, `422`

---

## Authorization

| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ CRUD — chỉ trip của mình |
| `MANAGER` | ❌ (chỉ xem qua GET trip detail) |
| `TRAVEL_ADMIN` | ❌ |
| `FINANCE` | ❌ |

**immutableGuard:** Chặn POST/PATCH/DELETE khi `trip.status = CLOSED` (BR-TR-06).

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| `itemDate` trong `[departureDate, returnDate]` | Logic | Server | 422 |
| `estimatedCost >= 0` | data-model | Server (CHECK) | 400 |
| `hotelCostPerNight > limit[jobGrade]` | BR-TR-01 | Client (warning) + PolicyCheck | Warning cảnh báo đỏ |
| Trip CLOSED → block write | BR-TR-06 | immutableGuard middleware | 409 |
| `isAiGenerated` không nhận từ client | data-model | Server strip | Luôn `false` khi tạo thủ công |

**Hotel limit theo jobGrade (BR-TR-01):**
| jobGrade | Limit |
|---|---|
| `STAFF` | 1.000.000 VNĐ/đêm |
| `MANAGER_GRADE` | 1.800.000 VNĐ/đêm |
| `DIRECTOR` | 3.000.000 VNĐ/đêm |

---

## Observability / Logging

| Event | Log level | Nội dung |
|---|---|---|
| Item tạo thành công | `info` | `{ action: "ITINERARY_ITEM_CREATED", tripId, itemId, category, estimatedCost }` |
| Item cập nhật | `info` | `{ action: "ITINERARY_ITEM_UPDATED", tripId, itemId, changedFields }` |
| Item xóa | `info` | `{ action: "ITINERARY_ITEM_DELETED", tripId, itemId }` |
| Hotel cost warning | `info` | `{ action: "HOTEL_LIMIT_WARNING", jobGrade, limit, actual, tripId }` |
| CLOSED trip write attempt | `warn` | `{ action: "IMMUTABLE_GUARD_BLOCKED", tripId, status: "CLOSED" }` |

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T3.1 | Happy path | Thêm item hợp lệ | 201, item xuất hiện trong timeline |
| T3.2 | Happy path | Sửa item (đổi location) | 200, thay đổi phản ánh ngay |
| T3.3 | Happy path | Xóa item | 204, item biến mất, totalCost cập nhật |
| T3.4 | AC 3.1 | Thêm xong, `totalEstimatedCost` = tổng items | Số liệu khớp |
| T3.5 | AC 3.2 | `hotelCostPerNight = 1200000` với STAFF | Client hiển thị cảnh báo đỏ BR-TR-01 |
| T3.6 | AC 3.2 | `hotelCostPerNight = 2000000` với DIRECTOR (limit=3M) | Không cảnh báo |
| T3.7 | Error E-01 | `itemDate` = `departureDate - 1` | 422 |
| T3.8 | Error E-03 | `estimatedCost = -500` | 400 |
| T3.9 | Error E-04 | Trip CLOSED → POST item | 409 TRIP_IMMUTABLE |
| T3.10 | Auth E-08 | PATCH item của trip người khác | 403 NOT_OWNER |
| T3.11 | Auth | Token role=FINANCE gọi POST | 403 FORBIDDEN |
| T3.12 | Audit | Sau T3.1, query `audit_logs` | Record `ITINERARY_ITEM_CREATED` |
| T3.13 | Edge | DELETE item không tồn tại | 404 |
| T3.14 | Perf | GET itinerary 50 items | Response ≤ 1s (NFR-TR-01) |

**AC Coverage:** AC 3.1 → T3.1, T3.2, T3.3, T3.4 ✅ | AC 3.2 → T3.5, T3.6 ✅

---

## Definition of Done

- [ ] CRUD endpoints itinerary items hoạt động đúng
- [ ] `immutableGuard` chặn write khi trip CLOSED (BR-TR-06)
- [ ] Hotel limit warning hiển thị client-side theo `jobGrade` (BR-TR-01)
- [ ] `itemDate` được validate trong khoảng trip dates
- [ ] `isAiGenerated` luôn = false khi thêm thủ công
- [ ] `totalEstimatedCost` cập nhật đúng sau mỗi thay đổi
- [ ] `audit_logs` có record mỗi mutation (NFR-TR-04)
- [ ] 14 test cases T3.1–T3.14 pass
- [ ] Response ≤ 1s (NFR-TR-01)

> **⚠️ Cần xác nhận trước khi code:**
> 1. Khi trip ở trạng thái SUBMITTED/APPROVED (chưa CLOSED), employee có được sửa itinerary không?
> 2. Hotel cost warning: chỉ cảnh báo hay còn bắt nhập `justification` trước khi lưu?
