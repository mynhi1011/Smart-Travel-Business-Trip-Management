# Story Spec

## Story ID
`US-01`

## Requirement IDs
`REQ-TR-01`, `REQ-TR-03` (Policy Check trigger), `NFR-TR-01` (response ≤ 1s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL — xem `docs/04-design/prototype-link.md`]_ → Screen: **Create Trip Request Form**

## Goal
Cho phép Employee tạo một Trip Request mới với đầy đủ thông tin chuyến đi, lưu ở trạng thái `DRAFT`. Hệ thống tự suy `destinationType` từ tên điểm đến và gắn cờ khẩn cấp nếu ngày đi < 3 ngày làm việc (D-16).

---

## Preconditions
- Employee đã đăng nhập (JWT access token hợp lệ, role = `EMPLOYEE`).
- Employee có `manager_id` được gán trong hệ thống.
- Ngày hiện tại đã biết (server clock UTC).

---

## Happy Path

1. Employee mở form **Create Trip Request**.
2. Employee nhập: Điểm xuất phát, Điểm đến, Ngày đi, Ngày về, Mục đích (≥ 10 ký tự), Ngân sách dự kiến tổng chuyến đi (`estimatedBudget`).
3. **Không còn** các ô: `hotelCostPerNight`, `hotelNights`, `perDiemBudget`, `transportBudget`, `otherBudget`, `destinationType` (D-16).
4. Client tính preview hạn mức BR-TR-08 realtime dựa trên ngày đi/về + điểm đến + jobTitle user.
5. Employee bấm **Lưu nháp** → `POST /api/v1/trips`.
6. Server: tự tính `destinationType = resolveDestinationType(destination)`, lưu `status = DRAFT`, trả 201.
7. Client redirect đến trang chi tiết Trip.

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | Thiếu field bắt buộc | `400 VALIDATION_ERROR` |
| E-02 | `returnDate < departureDate` | `400 VALIDATION_ERROR` |
| E-03 | `departureDate` trong quá khứ | `400 VALIDATION_ERROR` |
| E-04 | `estimatedBudget ≤ 0` | `400 VALIDATION_ERROR` |
| E-05 | `plannedBudget > Combined_Limit` (BR-TR-08) | Preview cảnh báo tổng hợp realtime ở FE; không chặn submit |
| E-06 | `departureDate` < 3 ngày làm việc (BR-TR-03) | Checkbox "Chuyến đi khẩn cấp" + `urgencyReason` bắt buộc |
| E-07 | Token hết hạn | Auto refresh → retry |

---

## API Contract (D-16)

### `POST /api/v1/trips`
**Request Body:**
```json
{
  "origin": "Hà Nội",
  "destination": "Đà Nẵng",
  "departureDate": "2026-10-01",
  "returnDate": "2026-10-03",
  "purpose": "Triển khai hệ thống tại chi nhánh miền Trung",
  "estimatedBudget": 8500000
}
```
*Ghi chú: `destinationType` không gửi — server tự suy. Không có `hotelCostPerNight`, `hotelNights`, `perDiemBudget`, `transportBudget`, `otherBudget` — client chỉ gửi một `estimatedBudget` duy nhất cho cả chuyến đi (D-16).*

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
| Hạn mức lưu trú + phụ cấp tham chiếu: `Combined_Limit = Hotel_Limit[jobGrade]×hotelNights + Per_Diem_Rate[destinationType]×tripDays` | BR-TR-01, BR-TR-02, BR-TR-08 | Dùng làm hạn mức tổng hợp so với `estimatedBudget`; cảnh báo duy nhất theo BR-TR-08 | Không cảnh báo riêng, không yêu cầu lý do |
| `departureDate < 3 ngày làm việc` → urgent | BR-TR-03 | Server (tính working days) | `is_urgent = true`; UI bắt nhập `urgencyReason` |
| `urgencyReason` bắt buộc khi `is_urgent = true` | BR-TR-03 | Server (CHECK constraint) | 400 nếu thiếu |
| `tripDays` = generated column, không nhận từ client | data-model | Server (strip) | Bỏ qua nếu client gửi |

**Công thức working days:** không tính Thứ 7, Chủ nhật. Không tính ngày lễ (MVP: chỉ tính T2–T6).

---

## Ma Trận Validation Chi Tiết — Ngày & Per Diem (BR-TR-02, BR-TR-03)

### Quy tắc kiểm tra chi phí (BR-TR-01, BR-TR-02, BR-TR-08)

BR-TR-01 và BR-TR-02 chỉ cung cấp các mức thành phần để tính tổng hạn mức; chúng không tự phát sinh cảnh báo và không yêu cầu nhập lý do. Việc kiểm tra duy nhất đối với hai khoản này được thực hiện theo BR-TR-08 tại Policy Check:

- `Combined_Actual = estimatedBudget` (client chỉ nhập một ngân sách tổng, không tách hotelCostPerNight/perDiemBudget riêng — D-16)
- `Combined_Limit = (Hotel_Limit[jobGrade] × hotelNights) + (tripDays × Per_Diem_Rate[destinationType])`
- Chỉ hiển thị một cảnh báo tổng hợp nếu `Combined_Actual > Combined_Limit`; không yêu cầu nhập lý do.

### Bảng 1 — Ma trận validation NGÀY (BR-TR-03, Advance Notice Rule)

**Quy ước:** `workingDaysRemaining` = số ngày làm việc (T2–T6) trong khoảng `[today+1, departureDate]` (tính cả ngày khởi hành). Nếu `>= 3` → không khẩn cấp; nếu `0 <= ... < 3` → khẩn cấp, bắt buộc `urgencyReason`.

| STT | Điều kiện đầu vào (`departureDate`, `today`, ngày làm việc) | `workingDaysRemaining` | `is_urgent` | Yêu cầu UI / Form Fields | Response Code | Message hiển thị / Xử lý hệ thống |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-D01** | `departureDate` trong quá khứ (`departureDate < today`) | N/A (< 0) | N/A | Highlight đỏ ô `departureDate`. Disable Submit. | `400 Bad Request` | *"Ngày khởi hành không được nằm trong quá khứ."* |
| **TC-D02** | `returnDate < departureDate` | N/A | N/A | Highlight đỏ ô `returnDate`. Disable Submit. | `400 Bad Request` | *"Ngày kết thúc chuyến đi phải lớn hơn hoặc bằng ngày khởi hành."* |
| **TC-D03** | Nộp Thứ 2, đi Thứ 5 cùng tuần | `workingDaysRemaining = 3` (Thứ 3, 4, 5) | `false` | Checkbox "Đi công tác khẩn cấp" bỏ chọn/ẩn. `urgencyReason` optional. | `201 Created` | Tạo yêu cầu thành công, quy trình phê duyệt tiêu chuẩn. |
| **TC-D04** | Nộp trước đúng 3 ngày làm việc (Boundary Case) | `workingDaysRemaining = 3` | `false` | Không yêu cầu `urgencyReason`. | `201 Created` | Tạo yêu cầu thành công (Normal Notice). |
| **TC-D05** | Nộp trước 1–2 ngày làm việc, CÓ nhập `urgencyReason` (≥10 ký tự) | `1 <= ... < 3` | `true` | Checkbox `is_urgent` tự bật/khóa. `urgencyReason` bắt buộc, badge đỏ `*`. | `201 Created` | Tạo thành công, `is_urgent=true`, thông báo khẩn tới Manager L1. |
| **TC-D06** | Nộp trước 1–2 ngày làm việc, KHÔNG nhập `urgencyReason` (hoặc <10 ký tự) | `1 <= ... < 3` | `true` | Lỗi inline tại `urgencyReason`. Submit bị chặn client. | `400 Bad Request` | *"Chuyến đi khởi hành dưới 3 ngày làm việc được coi là khẩn cấp. Vui lòng nhập lý do khẩn cấp (tối thiểu 10 ký tự)."* |
| **TC-D07** | Đi ngay trong ngày (`departureDate == today`), CÓ `urgencyReason` | `workingDaysRemaining = 0` | `true` | Banner "Chuyến đi cùng ngày". `urgencyReason` bắt buộc. | `201 Created` | Tạo thành công, `is_urgent=true`. |
| **TC-D08** | Đi ngay trong ngày, KHÔNG `urgencyReason` | `workingDaysRemaining = 0` | `true` | Lỗi inline. Submit bị chặn. | `400 Bad Request` | *"Yêu cầu công tác trong ngày bắt buộc phải có lý do khẩn cấp."* |
| **TC-D09** | Nộp Thứ 6, đi Thứ 2 tuần kế tiếp (xen T7 & CN) | `workingDaysRemaining = 1` (chỉ Thứ 2 tính; T7, CN không tính) | `true` | Checkbox `is_urgent` tự bật. `urgencyReason` bắt buộc. | `201 Created` (có reason) / `400` (thiếu) | *"Chỉ có 1 ngày làm việc trước khi khởi hành (T7, CN không phải ngày làm việc). Vui lòng điền lý do khẩn cấp."* |
| **TC-D10** | Nộp Thứ 5, đi Thứ 2 tuần kế tiếp (cách 4 ngày lịch, xen T7 & CN) | `workingDaysRemaining = 2` (Thứ 6 & Thứ 2) | `true` | Kích hoạt cờ khẩn cấp vì < 3. `urgencyReason` bắt buộc. | `201 Created` (có reason) / `400` (thiếu) | *"Số ngày làm việc còn lại: 2 (< 3). Yêu cầu thuộc diện công tác khẩn cấp."* |
| **TC-D11** | Nộp Thứ 4, đi Thứ 3 tuần kế tiếp | `workingDaysRemaining = 4` (Thứ 5, 6, T2, T3 — tính cả ngày khởi hành) | `false` | Không khẩn cấp (vượt ngưỡng 3). | `201 Created` | Tạo yêu cầu thành công, luồng thông thường. |

### Kiểm tra Per Diem (BR-TR-02)

`Max_Per_Diem = tripDays × Daily_Rate`, trong đó `TIER1_CITY` = 400.000 VNĐ/ngày và `OTHER` = 300.000 VNĐ/ngày. Đây là thành phần của phép tính BR-TR-08, không phải một kiểm tra cảnh báo độc lập.

| Trường hợp | Hành vi |
|---|---|
| `estimatedBudget` (Combined_Actual) ≤ `Combined_Limit` | Không cảnh báo. |
| Per diem vượt mức thành phần nhưng tổng hợp (`estimatedBudget`) không vượt `Combined_Limit` | Không cảnh báo. |
| Tổng chi phí lưu trú và per diem (`estimatedBudget`) vượt tổng hạn mức BR-TR-08 | Policy Check hiển thị đúng một cảnh báo tổng hợp; không yêu cầu lý do. |
| `estimatedBudget` âm, bằng 0, hoặc sai kiểu dữ liệu | Validation dữ liệu thông thường trả `400`; đây không phải cảnh báo policy. |

### Tóm tắt Hard Validation và Policy Warning

| Loại kiểm tra | Tiêu chí | Cơ chế xử lý |
|---|---|---|
| Hard Validation | Ngày không hợp lệ, thiếu field bắt buộc, số tiền âm/sai kiểu, sai ENUM, hoặc thiếu lý do khẩn cấp theo BR-TR-03 | Chặn gửi dữ liệu và trả lỗi validation. |
| Policy warning | Tổng chi phí lưu trú và per diem vượt hạn mức kết hợp BR-TR-08 | Hiển thị một cảnh báo tổng hợp khi Policy Check chạy; không yêu cầu nhập lý do. |

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
| T1.2 | Happy path | Submit với `estimatedBudget` ≤ `Combined_Limit` (BR-TR-08) | 201, không cảnh báo |
| T1.3 | AC 1.2 | Submit với `estimatedBudget` > `Combined_Limit` (BR-TR-08) | 201, Policy Check tạo đúng một cảnh báo tổng hợp `COMBINED_COST_LIMIT_EXCEEDED`; không yêu cầu lý do |
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
- [ ] Không hiển thị cảnh báo per diem riêng; cảnh báo tổng hợp theo BR-TR-08 khi tổng vượt hạn mức
- [ ] `audit_logs` có record `TRIP_CREATED` sau mỗi tạo thành công (NFR-TR-04)
- [ ] Tất cả 13 test cases T1.1–T1.13 pass
- [ ] Response time ≤ 1s (NFR-TR-01)
- [ ] Code review approved

> ✅ 2 câu hỏi mở trước đây (tính ngày lễ, per diem client/server) đã được chốt tại mục **"Ma Trận Validation Chi Tiết — Ngày & Per Diem"** ở trên. Còn 1 điểm cần **PO xác nhận** trước khi code TSK-102: ràng buộc `urgencyReason ≥ 10 ký tự` (xem callout ⚠️ trong mục đó).
