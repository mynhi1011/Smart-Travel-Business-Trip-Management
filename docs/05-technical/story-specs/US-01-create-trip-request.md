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

## Ma Trận Validation Chi Tiết — Ngày & Per Diem (BR-TR-02, BR-TR-03)

### Chốt câu hỏi mở

**1. "3 ngày làm việc" có tính ngày nghỉ lễ (Public Holidays) không?**
Giai đoạn MVP chỉ tính ngày làm việc thông thường Thứ Hai – Thứ Sáu (`DayOfWeek not in [Saturday, Sunday]`), **không** trừ động lịch ngày lễ quốc gia. Việc tích hợp lịch nghỉ lễ (kể cả nghỉ bù, hoán đổi ngày) đòi hỏi service quản lý lịch động riêng, dự kiến đưa vào Phase 2 qua bảng cấu hình `holiday_calendar`. Nếu chuyến đi rơi vào tuần có lễ khiến nộp gấp, Employee vẫn có thể tick `is_urgent = true` kèm `urgencyReason` — hệ thống không chặn nộp mà định tuyến cờ khẩn cấp tới Manager (L1).

**2. Per Diem warning là client-only hay có validate server-side?**
Áp dụng mô hình **Soft Validation đồng bộ cả Client và Server, không bao giờ block (không trả 400)**:
- **Client:** ngay khi nhập `perDiemBudget`, tính `Max_Per_Diem`; nếu vượt, hiển thị banner cảnh báo màu vàng cam, nút Submit vẫn bật.
- **Server (`POST /api/v1/trips`):** validate lại công thức để chống can thiệp dữ liệu từ client; nếu vượt, vẫn trả `201 Created` kèm `warnings: ["POLICY_VIOLATION_PER_DIEM_EXCEEDED"]` (dùng đúng mã đã định nghĩa trong `US-04-policy-check.md` và `data-model.md` để PolicyCheckEngine ở US-04 nhận diện cùng loại vi phạm khi Manager duyệt L1).

> **⚠️ Giả định mới — cần PO xác nhận:** Ma trận bên dưới áp dụng ràng buộc `urgencyReason` phải có **tối thiểu 10 ký tự**. Ràng buộc này chưa được định nghĩa ở `business-rules.md` hay `requirements.md` (vốn chỉ quy định `purpose` ≥ 10 ký tự) — cần Product Owner chốt trước khi Ánh Tuyết code validation này ở TSK-102.

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

### Bảng 2 — Ma trận validation PER DIEM (BR-TR-02)

**Định mức:** `TIER1_CITY` (Hà Nội, TP.HCM, Đà Nẵng) = **400.000 VNĐ/ngày**; `OTHER` = **300.000 VNĐ/ngày**. `tripDays = returnDate - departureDate + 1`. `Max_Per_Diem = tripDays × Daily_Rate`.

| STT | `destinationType` | Rate/ngày | `tripDays` | `Max_Per_Diem` | `perDiemBudget` nhập vào | Kết quả | Hành vi hệ thống (UI & API) | Mã lỗi/Cảnh báo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-P01** | `TIER1_CITY` | 400.000 | 3 | 1.200.000 | 1.000.000 (< Max) | **Pass** | UI text xanh "Trong định mức cho phép". Lưu DB. | `201 Created` |
| **TC-P02** | `TIER1_CITY` | 400.000 | 3 | 1.200.000 | 1.200.000 (= Max) | **Pass** (boundary) | UI hiển thị trạng thái hợp lệ. | `201 Created` |
| **TC-P03** | `TIER1_CITY` | 400.000 | 3 | 1.200.000 | 1.500.000 (> Max, vượt 300k) | **Warning** | KHÔNG BLOCK. Banner vàng cam: *"Vượt định mức tối đa 1.200.000 VNĐ. Cần Manager duyệt ngoại lệ."* | `201 Created` + `warnings: ["POLICY_VIOLATION_PER_DIEM_EXCEEDED"]` |
| **TC-P04** | `OTHER` | 300.000 | 4 | 1.200.000 | 1.000.000 (< Max) | **Pass** | Lưu bình thường. | `201 Created` |
| **TC-P05** | `OTHER` | 300.000 | 4 | 1.200.000 | 1.200.000 (= Max) | **Pass** (boundary) | Lưu bình thường. | `201 Created` |
| **TC-P06** | `OTHER` | 300.000 | 4 | 1.200.000 | 1.500.000 (> Max, vượt 300k) | **Warning** | KHÔNG BLOCK. Warning icon, highlight cho Manager L1. | `201 Created` + `warnings: ["POLICY_VIOLATION_PER_DIEM_EXCEEDED"]` |
| **TC-P07** | Bất kỳ | Bất kỳ | ≥1 | Theo công thức | Bỏ trống (`null`) | **Pass** (optional field) | `perDiemBudget` không bắt buộc lúc tạo, có thể để `null`. | `201 Created` |
| **TC-P08** | Bất kỳ | Bất kỳ | ≥1 | Theo công thức | Giá trị âm | **Fail** | BLOCK. Highlight đỏ, chặn submit. | `400 Bad Request` — *"Ngân sách công tác phí không được là số âm."* |
| **TC-P09** | Bất kỳ | Bất kỳ | `tripDays ≤ 0` | N/A | Bất kỳ | **Fail** (edge case) | BLOCK ngay từ tầng validation ngày (TC-D01/D02). `tripDays` luôn ≥ 1. | `400 Bad Request` — *"Khoảng thời gian công tác không hợp lệ."* |
| **TC-P10** | `destinationType` ngoài ENUM | N/A | Bất kỳ | N/A | Bất kỳ | **Fail** | BLOCK. Dropdown chỉ cho chọn TIER1_CITY/OTHER; API kiểm tra enum schema. | `400 Bad Request` — *"Loại điểm đến không hợp lệ."* |

### Tóm tắt Hard vs Soft Validation

| Loại kiểm tra | Tiêu chí | Cơ chế xử lý | HTTP Code | UI State |
| :--- | :--- | :--- | :--- | :--- |
| **Hard Validation** | Ngày quá khứ, `returnDate < departureDate`, thiếu `urgencyReason` khi `is_urgent=true`, số tiền âm, sai Enum. | Chặn gửi dữ liệu, báo lỗi cụ thể. | `400 Bad Request` | Viền đỏ, helper text, disable Submit. |
| **Soft Validation** | `perDiemBudget > Max_Per_Diem`. | Cho phép gửi, lưu kèm cờ cảnh báo policy để Manager L1 review. | `201 Created` (kèm warning payload) | Viền vàng/cam, Callout Warning, không khóa Submit. |

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

> ✅ 2 câu hỏi mở trước đây (tính ngày lễ, per diem client/server) đã được chốt tại mục **"Ma Trận Validation Chi Tiết — Ngày & Per Diem"** ở trên. Còn 1 điểm cần **PO xác nhận** trước khi code TSK-102: ràng buộc `urgencyReason ≥ 10 ký tự` (xem callout ⚠️ trong mục đó).
