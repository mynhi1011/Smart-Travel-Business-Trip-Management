# Story Spec

## Story ID
`US-01`

## Requirement IDs
`REQ-TR-01`, `REQ-TR-03` (Policy Check trigger), `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL — xem `docs/04-design/prototype-link.md`]_ → Screen: **Create Trip Request Form**

## Goal
Cho phép Employee tạo một Trip Request mới với đầy đủ thông tin chuyến đi, lưu ở trạng thái `DRAFT`, đồng thời hệ thống tự động tính gợi ý per diem và gắn cờ khẩn cấp nếu ngày đi < 3 ngày làm việc.

---

## Preconditions
- Employee đã đăng nhập (JWT access token hợp lệ, role = `EMPLOYEE`).
- Employee có `manager_id` được gán trong hệ thống (ASM-TR-01).
- Ngày hiện tại đã biết (server clock UTC).

---

## Happy Path

1. Employee mở form **Create Trip Request**.
2. Employee nhập đầy đủ: Điểm xuất phát, Điểm đến, `destinationType` (TIER1_CITY | OTHER), Ngày đi, Ngày về, Mục đích (≥ 10 ký tự), Tổng dự toán.
3. Employee nhập tuỳ chọn: `hotelCostPerNight`, `hotelNights`, `perDiemBudget`, `transportBudget`, `otherBudget`.
4. Client tính hint per diem hiển thị: `Max_Per_Diem = tripDays × rate` (400.000 VNĐ nếu TIER1_CITY, 300.000 nếu OTHER) — chỉ là gợi ý, không block submit.
5. Employee bấm **Lưu nháp** → `POST /api/v1/trips`.
6. Server tạo bản ghi `trips` với `status = DRAFT`, trả về 201 với `tripId`.
7. Client redirect đến trang chi tiết Trip vừa tạo.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Thiếu field bắt buộc (origin, destination, departureDate, returnDate, purpose, estimatedBudget) | `400 VALIDATION_ERROR` — highlight field lỗi, không submit |
| E-02 | `returnDate < departureDate` | `400 VALIDATION_ERROR`: "Ngày về phải sau hoặc bằng ngày đi" |
| E-03 | `departureDate` là ngày trong quá khứ | `400 VALIDATION_ERROR`: "Ngày đi phải là ngày trong tương lai" |
| E-04 | `estimatedBudget ≤ 0` hoặc không phải số nguyên | `400 VALIDATION_ERROR`: "Dự toán phải là số nguyên dương (VND)" |
| E-05 | `perDiemBudget > tripDays × rate` (BR-TR-02) | Client hiển thị **cảnh báo vàng** inline: "Phụ cấp vượt hạn mức khoán. Vui lòng kiểm tra lại." — vẫn cho phép submit (cảnh báo, không block) |
| E-06 | `departureDate` < 3 ngày làm việc kể từ hôm nay (BR-TR-03) | Client hiển thị checkbox bắt buộc "Chuyến đi khẩn cấp" và field `urgencyReason` bắt buộc. Server gắn `is_urgent = true` |
| E-07 | Token hết hạn (401) | Axios interceptor tự refresh → retry. Nếu refresh thất bại → redirect `/login` |
| E-08 | Lỗi mạng / server 500 | Toast lỗi: "Không thể kết nối. Vui lòng thử lại." — không mất dữ liệu đã nhập (form giữ state) |
| E-09 | Role không phải EMPLOYEE (403) | `403 FORBIDDEN` — không hiển thị form tạo trip |

---

## Data Read / Write

### Read
- `GET /api/v1/auth/me` — lấy `jobGrade`, `managerId` để hiển thị hotel limit hint phía client.

### Write
- `POST /api/v1/trips` — tạo bản ghi `trips` với `status = DRAFT`.
- Server INSERT `audit_logs`: `{ action: "TRIP_CREATED", entityType: "TRIP", previousState: null, newState: "DRAFT" }`.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `trips` | INSERT | `status = DRAFT`, `employee_id = req.user.id` |
| `audit_logs` | INSERT | `action = TRIP_CREATED` |

---

## API Contract

### `POST /api/v1/trips`
**Request Body:**
```json
{
  "origin": "Hà Nội",
  "destination": "Đà Nẵng",
  "destinationType": "TIER1_CITY",
  "departureDate": "2026-09-20",
  "returnDate": "2026-09-22",
  "purpose": "Triển khai hệ thống tại chi nhánh miền Trung",
  "estimatedBudget": 5000000,
  "hotelCostPerNight": 800000,
  "hotelNights": 2,
  "perDiemBudget": 1200000,
  "transportBudget": 1500000,
  "otherBudget": 500000
}
```

**Fields bị server strip (không nhận từ client):** `tripDays`, `isUrgent`, `requiresLevel2`, `status`, `employeeId`.

**Response 201:**
```json
{
  "id": "uuid",
  "status": "DRAFT",
  "tripDays": 3,
  "isUrgent": false,
  "requiresLevel2": false,
  "createdAt": "2026-08-28T10:30:00Z"
}
```

**Error Responses:** `400`, `401`, `403`

---

## Authorization

| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ Được tạo trip cho chính mình |
| `MANAGER` | ❌ 403 |
| `TRAVEL_ADMIN` | ❌ 403 |
| `FINANCE` | ❌ 403 |

Resource-level: `employeeId` luôn được set bởi server = `req.user.id`, client không truyền được.

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| Tất cả field bắt buộc phải có | REQ-TR-01 | Client + Server | 400 nếu thiếu |
| `returnDate >= departureDate` | Logic | Client + Server | 400 nếu vi phạm |
| `departureDate >= today` | Logic | Client + Server | 400 nếu vi phạm |
| `estimatedBudget > 0`, integer | ASM-TR-02 | Client + Server | 400 nếu vi phạm |
| Per diem hint: `Max = tripDays × rate` | BR-TR-02 | Client (warning only) | Cảnh báo vàng, không block |
| `departureDate < 3 ngày làm việc` → urgent | BR-TR-03 | Server (tính working days) | `is_urgent = true`; UI bắt nhập `urgencyReason` |
| `urgencyReason` bắt buộc khi `is_urgent = true` | BR-TR-03 | Server (CHECK constraint) | 400 nếu thiếu |
| `tripDays` = generated column, không nhận từ client | data-model | Server (strip) | Bỏ qua nếu client gửi |

**Công thức working days:** không tính Thứ 7, Chủ nhật. Không tính ngày lễ (MVP: chỉ tính T2–T6).

---

## Observability / Logging

| Event | Log level | Nội dung |
|---|---|---|
| Trip tạo thành công | `info` | `{ action: "TRIP_CREATED", tripId, employeeId, status: "DRAFT", isUrgent }` |
| Validation thất bại | `warn` | `{ action: "VALIDATION_FAILED", endpoint: "POST /trips", errors: [...] }` |
| Trip urgent | `info` | `{ action: "URGENT_TRIP_FLAGGED", tripId, daysUntilDeparture }` |
| Server error 500 | `error` | Full error stack — `requestId` attach vào response |

**Audit Log bắt buộc:** INSERT vào `audit_logs` sau mỗi trip tạo thành công (NFR-TR-04).

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T1.1 | Happy path | Submit form hợp lệ, ngày đi > 3 ngày làm việc | 201, `status=DRAFT`, `isUrgent=false` |
| T1.2 | Happy path | Submit với `perDiemBudget` đúng hạn mức | 201, không cảnh báo |
| T1.3 | AC 1.2 | `perDiemBudget > tripDays × 400000` (TIER1_CITY) | 201 nhưng client hiển thị warning vàng |
| T1.4 | AC 1.3 | `departureDate` = ngày mai (< 3 ngày làm việc) | `is_urgent=true`; thiếu `urgencyReason` → 400 |
| T1.5 | AC 1.3 | Điền `urgencyReason` khi urgent | 201, `is_urgent=true` |
| T1.6 | Error E-01 | Thiếu `purpose` | 400, field `purpose` được highlight |
| T1.7 | Error E-02 | `returnDate` = `departureDate - 1` | 400 |
| T1.8 | Error E-04 | `estimatedBudget = -1000` | 400 |
| T1.9 | Auth | Gửi request với token của MANAGER | 403 |
| T1.10 | Auth | Gửi request không có token | 401 |
| T1.11 | Audit | Sau T1.1, query `audit_logs WHERE entity_id = tripId` | Có 1 record `action=TRIP_CREATED` |
| T1.12 | Edge | Mạng ngắt sau khi bấm submit | Toast lỗi, form giữ nguyên dữ liệu |
| T1.13 | Edge | Gửi `tripDays = 999` trong body | Server bỏ qua, tính đúng từ dates |

**AC Coverage:** AC 1.1 → T1.1 ✅ | AC 1.2 → T1.2, T1.3 ✅ | AC 1.3 → T1.4, T1.5 ✅

---

## Definition of Done

- [ ] `POST /api/v1/trips` hoạt động đúng, trả 201 với trip DRAFT
- [ ] Server strip `tripDays`, `isUrgent`, `requiresLevel2`, `status` từ client input
- [ ] `is_urgent` được tính server-side từ working days diff (BR-TR-03)
- [ ] `urgencyReason` bắt buộc khi `is_urgent = true`
- [ ] Per diem warning hiển thị client-side khi vượt BR-TR-02
- [ ] `audit_logs` có record `TRIP_CREATED` sau mỗi tạo thành công (NFR-TR-04)
- [ ] Tất cả 13 test cases T1.1–T1.13 pass
- [ ] Response time ≤ 1s (NFR-TR-01)
- [ ] Code review approved

> **⚠️ Cần xác nhận trước khi code:**
> 1. Cách tính "3 ngày làm việc" có bao gồm ngày lễ không? MVP hiện tại chỉ tính T2–T6.
> 2. Per diem warning là client-only hay cũng server-side validate?
