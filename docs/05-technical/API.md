# API Contract — Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 — MIS3032_1
**Phiên bản:** v1.0
**Ngày tạo:** 2026-08-28
**Tác giả:** Engineering (Nguyễn Thị Ánh Tuyết)
**Tài liệu tham chiếu:** `architecture.md`, `data-model.md`, `business-rules.md`
**OpenAPI Spec:** `openapi.yaml`

---

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Cơ chế Authentication & Authorization](#2-cơ-chế-authentication--authorization)
3. [Cấu trúc Error Response chuẩn](#3-cấu-trúc-error-response-chuẩn)
4. [Nhóm API: Auth](#4-nhóm-api-auth)
5. [Nhóm API: Trips (CRUD)](#5-nhóm-api-trips-crud)
6. [Nhóm API: Trip Actions (State Transitions)](#6-nhóm-api-trip-actions-state-transitions)
7. [Nhóm API: Itinerary Items](#7-nhóm-api-itinerary-items)
8. [Nhóm API: Expenses](#8-nhóm-api-expenses)
9. [Nhóm API: Expense Items](#9-nhóm-api-expense-items)
10. [Nhóm API: AI](#10-nhóm-api-ai)
11. [Nhóm API: Notifications](#11-nhóm-api-notifications)
12. [Nhóm API: Dashboard](#12-nhóm-api-dashboard)
13. [Nhóm API: PDF Export](#13-nhóm-api-pdf-export)
14. [Nhóm API: System](#14-nhóm-api-system)
15. [Danh sách tổng hợp tất cả Endpoints](#15-danh-sách-tổng-hợp-tất-cả-endpoints)
16. [Security Self-Check](#16-security-self-check)

---

## 1. Quy ước chung

| Quy ước | Giá trị |
|---|---|
| **Base URL** | `http://localhost:3001/api/v1` |
| **API Version** | `v1` — nằm trong URL path |
| **Path style** | `kebab-case` |
| **JSON field style** | `camelCase` — ví dụ: `estimatedBudget`, `departureDate` |
| **ID format** | `UUID v4` |
| **Tiền tệ** | `integer` (VND nguyên) — ví dụ: `1500000` = 1.500.000 VNĐ. **Không dùng decimal.** |
| **Date** | `YYYY-MM-DD` cho Date, `ISO 8601 UTC` cho Timestamp |
| **Content-Type** | `application/json` cho tất cả trừ PDF export (`application/pdf`) |
| **Pagination** | `?page=1&limit=20` — max `limit=100` |
| **Sorting** | `?sortBy=createdAt&order=desc` |

### 1.1 Trường Server-Computed — Client KHÔNG được gửi

Server **bỏ qua hoàn toàn** nếu client cố gửi các trường này:

| Trường | Entity | Lý do |
|---|---|---|
| `tripDays` | Trip | `GENERATED ALWAYS AS (returnDate - departureDate + 1)` |
| `isUrgent` | Trip | Server tính từ working days diff (BR-TR-03) |
| `requiresLevel2` | Trip | PolicyCheckEngine set (BR-TR-04) |
| `policyCheckResult` | Trip | Kết quả PolicyCheckEngine — server-side only |
| `variancePct` | Expense | `(totalActual - budgetSnapshot) / budgetSnapshot × 100` |
| `varianceAmount` | Expense | `totalActual - budgetSnapshot` |
| `totalActual` | Expense | Aggregate từ expense items |
| `estimatedBudgetSnapshot` | Expense | Server copy từ `trip.estimatedBudget` khi tạo |
| `managerReapprovalRequired` | Expense | Server set khi `variancePct > 10` (BR-TR-05) |
| `status` | Trip / Expense | Chỉ thay đổi qua action endpoints |

---

## 2. Cơ chế Authentication & Authorization

### 2.1 JWT Access Token

Tất cả endpoints (trừ `POST /auth/login`, `POST /auth/refresh`, `GET /health`) yêu cầu header:

```
Authorization: Bearer <accessToken>
```

- **Loại:** JWT HS256, expires **15 phút**
- **Payload:** `{ sub: userId, role, name, iat, exp }`
- **Lưu trữ client:** In-memory (Zustand) — **KHÔNG localStorage** (tránh XSS)
- **Khi hết hạn:** Axios interceptor tự gọi `POST /auth/refresh` rồi retry

### 2.2 Refresh Token

- Gửi qua **httpOnly cookie** (`refreshToken`), `SameSite=Strict` (chống CSRF)
- Expires: **7 ngày**; hash SHA-256 lưu trong bảng `refresh_tokens`

### 2.3 Role Permission Matrix

| Nhóm Endpoint | EMP | MGR | TRAVEL_ADMIN | FINANCE | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trips — xem trip của mình | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trips — xem tất cả | ❌ | ✅ | ✅ | ✅ | ✅ |
| Trips — tạo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Trips — sửa/xóa (DRAFT) | ✅ owner | ❌ | ❌ | ❌ | ❌ |
| Trips — submit | ✅ owner | ❌ | ❌ | ❌ | ❌ |
| Trips — approve/reject L1 | ❌ | ✅ | ❌ | ❌ | ❌ |
| Trips — approve/reject L2 | ❌ | ❌ | ✅ | ❌ | ❌ |
| Trips — close | ❌ | ❌ | ❌ | ✅ | ❌ |
| Itinerary — CRUD | ✅ owner | ❌ | ❌ | ❌ | ❌ |
| Expense — tạo/sửa/items | ✅ owner | ❌ | ❌ | ❌ | ❌ |
| Expense — submit | ✅ owner | ❌ | ❌ | ❌ | ❌ |
| Expense — approve/reject | ❌ | ❌ | ❌ | ✅ | ❌ |
| Expense — reapprove | ❌ | ✅ | ❌ | ❌ | ❌ |
| AI generate itinerary | ✅ | ❌ | ❌ | ❌ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| PDF Export | ✅ owner | ❌ | ❌ | ✅ | ❌ |

### 2.4 Resource-Level Authorization (Service Layer)

Ngoài role, server còn kiểm tra ownership:

- `EMPLOYEE` chỉ thấy/sửa trip của mình
- `MANAGER` chỉ approve trip của subordinates (`trip.employee.managerId = req.user.id`)
- Mọi write trên trip có `status = CLOSED` → **409 TRIP_IMMUTABLE** (BR-TR-06)

---

## 3. Cấu trúc Error Response chuẩn

```json
{
  "error": "ERROR_CODE",
  "message": "Mô tả lỗi human-readable",
  "details": {},
  "requestId": "req_abc123"
}
```

### HTTP Status Code Mapping

| Status | Code | Trường hợp |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Input sai format, thiếu field bắt buộc |
| `401` | `UNAUTHORIZED` | Thiếu/sai/hết hạn token |
| `401` | `TOKEN_EXPIRED` | Access token hết hạn → client refresh |
| `403` | `FORBIDDEN` | Role không đủ quyền |
| `403` | `NOT_OWNER` | Không phải chủ sở hữu resource |
| `404` | `NOT_FOUND` | Resource không tồn tại |
| `409` | `TRIP_IMMUTABLE` | Trip đã CLOSED (BR-TR-06) |
| `409` | `INVALID_STATE` | Action không hợp lệ với trạng thái hiện tại |
| `409` | `DUPLICATE_APPROVAL` | Cấp duyệt này đã APPROVED rồi |
| `422` | `POLICY_VIOLATION` | Vi phạm business rule (hotel, per diem...) |
| `422` | `AI_BUDGET_GUARDRAIL_FAILED` | AI không thể sinh itinerary trong budget (BR-TR-07) |
| `422` | `EXPENSE_VARIANCE_EXCEEDED` | Variance >10%, cần manager re-approve (BR-TR-05) |
| `422` | `JUSTIFICATION_REQUIRED` | Variance 0–10%, cần điền justification |
| `500` | `INTERNAL_ERROR` | Lỗi server — không expose stack trace |

---

## 4. Nhóm API: Auth

**Base:** `/api/v1/auth`

### `POST /auth/login`

**Auth:** Public

**Request:**
```json
{ "email": "employee@company.com", "password": "SecureP@ss123" }
```

| Field | Validation |
|---|---|
| `email` | required, email format, max 255 |
| `password` | required, min 8, max 128 |

**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "uuid", "name": "Nguyễn Văn A", "email": "employee@company.com",
    "role": "EMPLOYEE", "jobGrade": "STAFF", "department": "IT",
    "managerId": "uuid"
  }
}
```
> `password_hash` **không bao giờ** xuất hiện trong response. Refresh token qua httpOnly cookie.

**Errors:** `400`, `401 UNAUTHORIZED`

---

### `POST /auth/refresh`

**Auth:** Public (httpOnly cookie `refreshToken`)
**Request Body:** Không cần

**Response 200:**
```json
{ "accessToken": "eyJ...", "tokenType": "Bearer", "expiresIn": 900 }
```

**Errors:** `401` (expired/revoked)

---

### `DELETE /auth/logout`

**Auth:** Bearer Token
**Response 204:** Server revoke refresh token trong DB.
**Errors:** `401`

---

### `GET /auth/me`

**Auth:** Bearer Token | **Roles:** ALL

**Response 200:**
```json
{
  "id": "uuid", "name": "Nguyễn Văn A", "email": "...",
  "role": "EMPLOYEE", "jobGrade": "STAFF", "department": "IT",
  "managerId": "uuid", "isActive": true, "createdAt": "2026-01-15T08:00:00Z"
}
```

---

## 5. Nhóm API: Trips (CRUD)

**Base:** `/api/v1/trips`

### `GET /trips`

**Auth:** Bearer | **Roles:** ALL (filtered server-side)

**Query Params:**

| Param | Type | Mô tả |
|---|---|---|
| `page` | int | default 1 |
| `limit` | int | default 20, max 100 |
| `status` | TripStatus | Lọc theo trạng thái |
| `employeeId` | UUID | Chỉ MANAGER+ dùng được |
| `departureFrom` | date | Lọc ngày đi >= |
| `departureTo` | date | Lọc ngày đi <= |
| `sortBy` | string | `createdAt` \| `departureDate` \| `estimatedBudget` |
| `order` | string | `asc` \| `desc` |

**Filtering theo role (server-side):**
- `EMPLOYEE` → chỉ trip của mình
- `MANAGER` → trip của subordinates
- `TRAVEL_ADMIN / FINANCE / ADMIN` → tất cả

**Response 200:**
```json
{
  "data": [{
    "id": "uuid", "employee": { "id": "uuid", "name": "...", "department": "IT", "jobGrade": "STAFF" },
    "origin": "Hà Nội", "destination": "TP. HCM", "destinationType": "TIER1_CITY",
    "departureDate": "2026-09-15", "returnDate": "2026-09-18", "tripDays": 4,
    "purpose": "Họp khách hàng Q3", "estimatedBudget": 8500000,
    "status": "SUBMITTED", "isUrgent": false, "requiresLevel2": false,
    "submittedAt": "2026-08-28T10:30:00Z", "createdAt": "2026-08-27T08:00:00Z"
  }],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

### `POST /trips`

**Auth:** Bearer | **Roles:** `EMPLOYEE`

**Request Body:**
```json
{
  "origin": "Hà Nội", "destination": "Đà Nẵng", "destinationType": "TIER1_CITY",
  "departureDate": "2026-09-20", "returnDate": "2026-09-22",
  "purpose": "Triển khai hệ thống tại chi nhánh",
  "estimatedBudget": 5000000,
  "hotelCostPerNight": 800000, "hotelNights": 2,
  "perDiemBudget": 1200000, "transportBudget": 1500000, "otherBudget": 500000
}
```

| Field | Validation |
|---|---|
| `origin` | required, string, 1–200 |
| `destination` | required, string, 1–200 |
| `destinationType` | required, enum `TIER1_CITY \| OTHER` |
| `departureDate` | required, date, >= today |
| `returnDate` | required, date, >= departureDate |
| `purpose` | required, string, 10–1000 |
| `estimatedBudget` | required, integer, > 0 |
| `hotelCostPerNight` | optional, integer, >= 0 |
| `hotelNights` | optional, integer, >= 0 |
| `perDiemBudget` | optional, integer, >= 0 |
| `transportBudget` | optional, integer, >= 0 |
| `otherBudget` | optional, integer, >= 0 |

> `tripDays`, `isUrgent`, `requiresLevel2`, `status` — server-computed, **bỏ qua nếu client gửi**.

**Response 201:** Trip object đầy đủ với `status: "DRAFT"`

**Errors:** `400`, `401`, `403`

---

### `GET /trips/:tripId`

**Auth:** Bearer | **Roles:** Owner, Manager của owner, TRAVEL_ADMIN, FINANCE

**Response 200:** Trip object đầy đủ gồm `employee`, `policyCheckResult`, `approvalRecords[]`

**Errors:** `401`, `403`, `404`

---

### `PATCH /trips/:tripId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `status === 'DRAFT'`

**Request Body:** Tất cả fields optional (tương tự POST). Server strip `status`, `isUrgent`, `requiresLevel2`, `tripDays`.

**Response 200:** Trip object cập nhật

**Errors:** `400`, `401`, `403 NOT_OWNER`, `404`, `409 INVALID_STATE`, `409 TRIP_IMMUTABLE`

---

### `DELETE /trips/:tripId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `status === 'DRAFT'`

**Response 204**

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`

---

## 6. Nhóm API: Trip Actions (State Transitions)

> Tất cả action dùng `POST`. Không dùng `PUT/PATCH` cho state transition.

### `POST /trips/:tripId/submit`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `status === 'DRAFT'`
**Request Body:** Không cần

**Hành vi server:**
1. Lock row (`SELECT FOR UPDATE`)
2. Chạy PolicyCheckEngine (BR-TR-01, 02, 03, 04)
3. Lưu `policy_check_results`, set `isUrgent`, `requiresLevel2`
4. Update `status = 'SUBMITTED'`, `submittedAt = now()`
5. Insert audit log (`TRIP_SUBMITTED`), emit notification → Manager

**Response 200:**
```json
{
  "id": "uuid", "status": "SUBMITTED",
  "isUrgent": false, "requiresLevel2": false,
  "submittedAt": "2026-08-28T10:31:00Z",
  "policyCheckResult": {
    "passed": true, "violations": [], "violationCount": 0,
    "requiresLevel2Approval": false, "checkedAt": "2026-08-28T10:31:00Z"
  }
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`

---

### `POST /trips/:tripId/approve`

**Auth:** Bearer
**Roles:**
- `MANAGER` → khi `status === 'SUBMITTED'` (Level 1)
- `TRAVEL_ADMIN` → khi `status === 'PENDING_ADMIN_APPROVAL'` (Level 2)

**Request Body:**
```json
{ "comment": "Phê duyệt chuyến công tác" }
```

| Field | Validation |
|---|---|
| `comment` | optional, string, max 1000 |

**Hành vi server (BR-TR-04):**
- MANAGER: nếu `budget ≤ 20M AND no violations` → `APPROVED`; ngược lại → `PENDING_ADMIN_APPROVAL`
- TRAVEL_ADMIN: → `APPROVED`
- Insert `approval_records` với budget/violation snapshot

**Response 200:**
```json
{
  "id": "uuid", "status": "APPROVED",
  "approvalRecord": {
    "id": "uuid", "approvalLevel": "LEVEL_1", "action": "APPROVED",
    "comment": "Phê duyệt", "budgetSnapshot": 5000000,
    "hadViolationsSnapshot": false, "actedAt": "2026-08-29T09:00:00Z"
  },
  "approvedAt": "2026-08-29T09:00:00Z"
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`, `409 DUPLICATE_APPROVAL`

---

### `POST /trips/:tripId/reject`

**Auth:** Bearer | **Roles:** `MANAGER` (L1), `TRAVEL_ADMIN` (L2)

**Request Body:**
```json
{ "comment": "Ngân sách vượt quá kế hoạch, đề nghị điều chỉnh." }
```

| Field | Validation |
|---|---|
| `comment` | **required**, string, 10–1000 |

**Response 200:** `{ "id": "uuid", "status": "REJECTED" }`

**Errors:** `400 VALIDATION_ERROR` (thiếu comment), `401`, `403`, `404`, `409 INVALID_STATE`

---

### `POST /trips/:tripId/close`

**Auth:** Bearer | **Roles:** `FINANCE`
**Điều kiện:** `trip.status === 'EXPENSE_APPROVED'` AND (nếu `managerReapprovalRequired` thì `managerReapproved = true`)

> **⚠️ UX vs API (fix L-05):** Frontend có thể hiển thị nút "Approve & Close" gộp, nhưng phải gọi **tuần tự 2 request riêng**:
> 1. `POST /trips/:tripId/expense/approve` → chờ response `{ status: "APPROVED" }`
> 2. `POST /trips/:tripId/close` → chỉ gọi sau khi bước 1 thành công
>
> Nút "Close" phải bị **disable** khi `expense.status ≠ APPROVED`. Không được gộp 2 call thành 1 request.

**Request Body:** Không cần

**Hành vi server (BR-TR-06):**
1. Kiểm tra `expense.status === 'APPROVED'` — trả `409 INVALID_STATE` nếu chưa approve
2. `trip.status = 'CLOSED'`, `trip.closedAt = now()`
3. `expense.status = 'CLOSED'`
4. Insert audit log (`TRIP_CLOSED`), emit notification → Employee

**Response 200:**
```json
{
  "id": "uuid",
  "status": "CLOSED",
  "closedAt": "2026-09-30T16:00:00Z",
  "expense": { "id": "uuid", "status": "CLOSED" }
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE` (expense chưa APPROVED), `422 EXPENSE_VARIANCE_EXCEEDED`

---

## 7. Nhóm API: Itinerary Items

**Base:** `/api/v1/trips/:tripId/itinerary`

> Mọi write đi qua `immutableGuard` — **409 TRIP_IMMUTABLE** nếu trip CLOSED.

### `GET /trips/:tripId/itinerary`

**Auth:** Bearer | **Roles:** Owner, Manager, TRAVEL_ADMIN, FINANCE

**Response 200:**
```json
{
  "tripId": "uuid",
  "totalEstimatedCost": 5200000,
  "items": [{
    "id": "uuid", "itemDate": "2026-09-20", "dayNumber": 1,
    "timeSlot": "MORNING", "location": "Sân bay Nội Bài",
    "activity": "Di chuyển HN → ĐN", "category": "TRANSPORT",
    "estimatedCost": 1500000, "notes": null,
    "isAiGenerated": false, "sortOrder": 0,
    "createdAt": "2026-08-28T10:30:00Z", "updatedAt": "2026-08-28T10:30:00Z"
  }]
}
```

---

### `POST /trips/:tripId/itinerary`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner

**Request Body:**
```json
{
  "itemDate": "2026-09-20", "timeSlot": "MORNING",
  "location": "Sân bay Nội Bài", "activity": "Di chuyển HN → ĐN",
  "category": "TRANSPORT", "estimatedCost": 1500000,
  "notes": "Chuyến bay VN-123 lúc 07:00", "sortOrder": 0
}
```

| Field | Validation |
|---|---|
| `itemDate` | required, date, trong khoảng `[departureDate, returnDate]` |
| `timeSlot` | required, enum `MORNING \| AFTERNOON \| EVENING \| ALL_DAY` |
| `location` | required, string, 1–300 |
| `activity` | required, string, 1–1000 |
| `category` | required, enum `MEETING \| ACCOMMODATION \| TRANSPORT \| MEAL \| OTHER` |
| `estimatedCost` | optional, integer >= 0, default 0 |
| `notes` | optional, string, max 2000 |
| `sortOrder` | optional, integer, default 0 |

> `isAiGenerated` — server luôn set `false` cho endpoint này. AI items đến qua `/ai/generate-itinerary`.

**Response 201:** ItineraryItem object

**Errors:** `400`, `401`, `403`, `404`, `409 TRIP_IMMUTABLE`, `422` (date ngoài range)

---

### `PATCH /trips/:tripId/itinerary/:itemId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Request Body:** Tất cả fields optional
**Response 200:** ItineraryItem object

---

### `DELETE /trips/:tripId/itinerary/:itemId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Response 204**

---

## 8. Nhóm API: Expenses

**Base:** `/api/v1/trips/:tripId/expense`

> Một trip chỉ có **một** expense claim (1:1).

### `GET /trips/:tripId/expense`

**Auth:** Bearer | **Roles:** Owner, FINANCE

**Response 200:**
```json
{
  "id": "uuid", "tripId": "uuid",
  "totalActual": 9200000,
  "estimatedBudgetSnapshot": 8500000,
  "variancePct": 8.24, "varianceAmount": 700000,
  "justification": "Giá khách sạn tăng do sự kiện địa phương",
  "managerReapprovalRequired": false, "managerReapproved": false,
  "status": "DRAFT",
  "items": [{
    "id": "uuid", "expenseDate": "2026-09-20", "category": "TRANSPORT",
    "amount": 1600000, "description": "Vé máy bay khứ hồi",
    "receiptUrl": "/uploads/receipt-001.pdf", "createdAt": "2026-09-25T10:00:00Z"
  }],
  "submittedAt": null, "approvedAt": null,
  "createdAt": "2026-09-25T09:00:00Z", "updatedAt": "2026-09-25T10:30:00Z"
}
```

> `variancePct`, `varianceAmount`, `totalActual`, `estimatedBudgetSnapshot` — **server-computed**, client không set.

**Errors:** `401`, `403`, `404`

---

### `POST /trips/:tripId/expense`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `trip.status IN ('APPROVED', 'ONGOING')` AND chưa có expense claim
**Request Body:** Không cần — server tự set `estimatedBudgetSnapshot = trip.estimatedBudget`

**Response 201:**
```json
{
  "id": "uuid", "tripId": "uuid",
  "totalActual": 0, "estimatedBudgetSnapshot": 8500000,
  "variancePct": null, "status": "DRAFT", "createdAt": "2026-09-25T09:00:00Z"
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`, `409` (expense đã tồn tại)

---

### `PATCH /trips/:tripId/expense`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `expense.status === 'DRAFT'`

**Request Body:** `{ "justification": "Lý do vượt chi..." }`

| Field | Validation |
|---|---|
| `justification` | optional, string, max 2000 |

> Chỉ `justification` được phép update. Mọi trường computed bị strip.

**Response 200:** Expense object

---

### `POST /trips/:tripId/expense/submit`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Điều kiện:** `expense.status === 'DRAFT'` AND có ≥ 1 expense item

**Request Body:** Không cần

**Hành vi server (BR-TR-05):**
1. Tính `variancePct = (totalActual - budgetSnapshot) / budgetSnapshot × 100`
2. Nếu `0 < variance ≤ 10`: kiểm tra `justification` không rỗng → `422 JUSTIFICATION_REQUIRED`
3. Nếu `variance > 10`: set `managerReapprovalRequired = true`, emit → Manager
4. Update `expense.status = 'SUBMITTED'`, `trip.status = 'EXPENSE_SUBMITTED'`
5. Insert audit log, emit → FINANCE

**Response 200:**
```json
{
  "id": "uuid", "status": "SUBMITTED",
  "totalActual": 9200000, "estimatedBudgetSnapshot": 8500000,
  "variancePct": 8.24, "varianceAmount": 700000,
  "managerReapprovalRequired": false, "submittedAt": "2026-09-25T11:00:00Z"
}
```

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`, `422 JUSTIFICATION_REQUIRED`

---

### `POST /trips/:tripId/expense/approve`

**Auth:** Bearer | **Roles:** `FINANCE`
**Điều kiện:** `expense.status === 'SUBMITTED'` AND (nếu `managerReapprovalRequired` thì `managerReapproved = true`)

**Request Body:** `{ "comment": "Chứng từ hợp lệ" }` (optional)

**Response 200:**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvedAt": "2026-09-28T14:00:00Z",
  "tripStatus": "EXPENSE_APPROVED"
}
```
> `tripStatus = EXPENSE_APPROVED` — frontend dùng giá trị này để enable nút **"Đóng hồ sơ"**.

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE`, `422 EXPENSE_VARIANCE_EXCEEDED`

---

### `POST /trips/:tripId/expense/reject`

**Auth:** Bearer | **Roles:** `FINANCE`

**Request Body:** `{ "comment": "Thiếu chứng từ khách sạn ngày 2" }`

| Field | Validation |
|---|---|
| `comment` | **required**, string, 10–1000 |

**Response 200:** `{ "id": "uuid", "status": "REJECTED" }`

Employee bổ sung items rồi submit lại.

**Errors:** `400`, `401`, `403`, `404`, `409 INVALID_STATE`

---

### `POST /trips/:tripId/expense/reapprove`

**Auth:** Bearer | **Roles:** `MANAGER` (manager của employee)
**Điều kiện:** `managerReapprovalRequired = true` AND `expense.status === 'SUBMITTED'`

**Request Body:**
```json
{ "action": "APPROVED", "comment": "Đồng ý với chi phí phát sinh" }
```

| Field | Validation |
|---|---|
| `action` | required, enum `APPROVED \| REJECTED` |
| `comment` | required khi `action = REJECTED`; optional khi APPROVED |

**Response 200:**
```json
{
  "id": "uuid", "managerReapproved": true,
  "managerReapproverId": "uuid", "managerReapprovedAt": "2026-09-27T10:00:00Z",
  "status": "SUBMITTED"
}
```

**Errors:** `400`, `401`, `403`, `404`, `409 INVALID_STATE`

---

## 9. Nhóm API: Expense Items

**Base:** `/api/v1/trips/:tripId/expense/items`

> Chỉ thao tác khi `expense.status IN ('DRAFT', 'REJECTED')`.
> Sau mỗi thay đổi, server tự cập nhật `expenses.totalActual = SUM(items.amount)`.

### `POST /trips/:tripId/expense/items`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner

**Request Body:**
```json
{
  "expenseDate": "2026-09-20", "category": "TRANSPORT",
  "amount": 1600000, "description": "Vé máy bay Hà Nội - Đà Nẵng khứ hồi",
  "receiptUrl": "/uploads/receipts/receipt-001.pdf"
}
```

| Field | Validation |
|---|---|
| `expenseDate` | required, date YYYY-MM-DD |
| `category` | required, enum `ACCOMMODATION \| TRANSPORT \| MEAL \| PER_DIEM \| OTHER` |
| `amount` | required, integer, **> 0** |
| `description` | required, string, 1–500 |
| `receiptUrl` | optional, string, max 500 |

**Response 201:** ExpenseItem object
**Errors:** `400`, `401`, `403`, `404`, `409 INVALID_STATE`

---

### `PATCH /trips/:tripId/expense/items/:itemId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Request Body:** Tất cả fields optional
**Response 200:** ExpenseItem object

---

### `DELETE /trips/:tripId/expense/items/:itemId`

**Auth:** Bearer | **Roles:** `EMPLOYEE` owner
**Response 204**

---

## 10. Nhóm API: AI

**Base:** `/api/v1/ai`

### `POST /ai/generate-itinerary`

**Auth:** Bearer | **Roles:** `EMPLOYEE`
**Timeout server:** 8 giây | **Target response ≤ 5s** (NFR-TR-02)

**Request Body:**
```json
{
  "tripId": "uuid",
  "destination": "Đà Nẵng",
  "days": 3,
  "budget": 5000000,
  "preferences": "Ưu tiên họp buổi sáng, tham quan buổi chiều"
}
```

| Field | Validation |
|---|---|
| `tripId` | required, UUID — validate trip thuộc về user |
| `destination` | required, string, 1–200 |
| `days` | required, integer, 1–30 |
| `budget` | required, integer, > 0 (VND) |
| `preferences` | optional, string, max 500 |

**Hành vi server (BR-TR-07 Guardrail):**
1. Gọi Gemini API với `budget_cap = budget` trong prompt
2. Kiểm tra `totalEstimatedCost ≤ budget`
3. Nếu vượt: retry tối đa 2 lần với constraint chặt hơn
4. Vẫn vượt sau 2 lần → `422 AI_BUDGET_GUARDRAIL_FAILED`

> API Key Gemini **không bao giờ** expose ra client. Mọi call qua server.

**Response 200:**
```json
{
  "destination": "Đà Nẵng", "days": 3,
  "totalEstimatedCost": 4850000, "budgetCap": 5000000, "guardrailPass": true,
  "items": [
    {
      "dayNumber": 1, "itemDate": "2026-09-20", "timeSlot": "MORNING",
      "location": "Sân bay Đà Nẵng", "activity": "Check-in khách sạn",
      "category": "ACCOMMODATION", "estimatedCost": 800000, "notes": null
    }
  ]
}
```

**Errors:** `400`, `401`, `403`, `422 AI_BUDGET_GUARDRAIL_FAILED`, `500` (Gemini timeout)

---

## 11. Nhóm API: Notifications

**Base:** `/api/v1/notifications`

### `GET /notifications`

**Auth:** Bearer | **Roles:** ALL (chỉ thấy notification của mình)

**Query Params:** `?isRead=false&page=1&limit=20`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid", "type": "TRIP_APPROVED",
    "message": "Chuyến công tác Đà Nẵng đã được phê duyệt",
    "referenceId": "uuid", "referenceType": "TRIP",
    "isRead": false, "readAt": null, "createdAt": "2026-08-29T09:00:00Z"
  }],
  "unreadCount": 3,
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

---

### `PATCH /notifications/:notificationId/read`

**Auth:** Bearer | **Roles:** ALL (chỉ notification của mình)
**Request Body:** Không cần

**Response 200:** `{ "id": "uuid", "isRead": true, "readAt": "2026-08-29T10:00:00Z" }`

---

### `PATCH /notifications/read-all`

**Auth:** Bearer | **Roles:** ALL

**Response 200:** `{ "updatedCount": 5 }`

---

### `GET /notifications/stream`

**Auth:** Bearer Token qua query param `?token=<accessToken>`
(EventSource API không hỗ trợ custom Authorization header)
**Roles:** ALL | **Protocol:** Server-Sent Events

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE Event format:**
```
event: notification
data: {"type":"TRIP_APPROVED","tripId":"uuid","message":"...","timestamp":"2026-08-29T09:00:00Z"}

event: ping
data: {"timestamp":"2026-08-29T09:00:30Z"}
```

Server gửi `ping` mỗi 30 giây để duy trì kết nối.

---

## 12. Nhóm API: Dashboard

### `GET /dashboard`

**Auth:** Bearer | **Roles:** ALL (data filtered server-side)

**Response 200 — EMPLOYEE:**
```json
{
  "role": "EMPLOYEE",
  "myTrips": {
    "total": 8,
    "byStatus": { "DRAFT": 1, "SUBMITTED": 2, "APPROVED": 3, "CLOSED": 2 },
    "recentTrips": []
  },
  "myExpenses": { "pendingSubmission": 1, "pendingApproval": 0 },
  "notifications": { "unreadCount": 3 }
}
```

**Response 200 — MANAGER:**
```json
{
  "role": "MANAGER",
  "pendingApprovals": { "count": 4, "trips": [] },
  "teamTrips": {
    "total": 23,
    "byStatus": { "APPROVED": 10, "ONGOING": 3, "CLOSED": 8, "REJECTED": 2 }
  },
  "notifications": { "unreadCount": 2 }
}
```

**Response 200 — FINANCE:**
```json
{
  "role": "FINANCE",
  "pendingExpenses": { "count": 6, "expenses": [] },
  "pendingClose": { "count": 2, "trips": [] },
  "notifications": { "unreadCount": 1 }
}
```

---

## 13. Nhóm API: PDF Export

### `GET /trips/:tripId/export-pdf`

**Auth:** Bearer | **Roles:** Owner (EMPLOYEE), FINANCE
**Điều kiện:** `trip.status IN ('APPROVED', 'ONGOING', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'CLOSED')`

**Response 200:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="trip-report-<tripId>.pdf"
```

**Nội dung PDF:** Thông tin nhân viên, lịch trình, bảng đối chiếu ngân sách, lịch sử phê duyệt.

**Errors:** `401`, `403`, `404`, `409 INVALID_STATE` (trip chưa được approve)

---

## 14. Nhóm API: System

### `GET /health`

**Auth:** Public

**Response 200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-08-28T10:00:00Z",
  "database": "connected"
}
```

---

## 15. Danh sách tổng hợp tất cả Endpoints

| # | Method | Path | Auth | Roles | Mô tả |
|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | Public | — | Đăng nhập |
| 2 | POST | `/auth/refresh` | Cookie | — | Làm mới access token |
| 3 | DELETE | `/auth/logout` | Bearer | ALL | Đăng xuất |
| 4 | GET | `/auth/me` | Bearer | ALL | Thông tin user hiện tại |
| 5 | GET | `/trips` | Bearer | ALL | Danh sách trips (filtered) |
| 6 | POST | `/trips` | Bearer | EMPLOYEE | Tạo trip mới |
| 7 | GET | `/trips/:id` | Bearer | Owner+approvers | Chi tiết trip |
| 8 | PATCH | `/trips/:id` | Bearer | EMPLOYEE owner | Sửa trip (DRAFT only) |
| 9 | DELETE | `/trips/:id` | Bearer | EMPLOYEE owner | Xóa trip (DRAFT only) |
| 10 | POST | `/trips/:id/submit` | Bearer | EMPLOYEE owner | Nộp trip request |
| 11 | POST | `/trips/:id/approve` | Bearer | MANAGER, TRAVEL_ADMIN | Phê duyệt trip |
| 12 | POST | `/trips/:id/reject` | Bearer | MANAGER, TRAVEL_ADMIN | Từ chối trip |
| 13 | POST | `/trips/:id/close` | Bearer | FINANCE | Đóng hồ sơ |
| 14 | GET | `/trips/:id/itinerary` | Bearer | Owner+viewers | Danh sách lịch trình |
| 15 | POST | `/trips/:id/itinerary` | Bearer | EMPLOYEE owner | Thêm mốc lịch trình |
| 16 | PATCH | `/trips/:id/itinerary/:itemId` | Bearer | EMPLOYEE owner | Sửa mốc lịch trình |
| 17 | DELETE | `/trips/:id/itinerary/:itemId` | Bearer | EMPLOYEE owner | Xóa mốc lịch trình |
| 18 | GET | `/trips/:id/expense` | Bearer | Owner, FINANCE | Chi tiết expense claim |
| 19 | POST | `/trips/:id/expense` | Bearer | EMPLOYEE owner | Tạo expense claim |
| 20 | PATCH | `/trips/:id/expense` | Bearer | EMPLOYEE owner | Sửa justification |
| 21 | POST | `/trips/:id/expense/submit` | Bearer | EMPLOYEE owner | Nộp expense claim |
| 22 | POST | `/trips/:id/expense/approve` | Bearer | FINANCE | Phê duyệt expense |
| 23 | POST | `/trips/:id/expense/reject` | Bearer | FINANCE | Từ chối expense |
| 24 | POST | `/trips/:id/expense/reapprove` | Bearer | MANAGER | Re-approve vượt chi |
| 25 | POST | `/trips/:id/expense/items` | Bearer | EMPLOYEE owner | Thêm khoản chi |
| 26 | PATCH | `/trips/:id/expense/items/:itemId` | Bearer | EMPLOYEE owner | Sửa khoản chi |
| 27 | DELETE | `/trips/:id/expense/items/:itemId` | Bearer | EMPLOYEE owner | Xóa khoản chi |
| 28 | POST | `/ai/generate-itinerary` | Bearer | EMPLOYEE | AI sinh lịch trình |
| 29 | GET | `/notifications` | Bearer | ALL | Danh sách notifications |
| 30 | PATCH | `/notifications/:id/read` | Bearer | ALL | Đánh dấu đã đọc |
| 31 | PATCH | `/notifications/read-all` | Bearer | ALL | Đánh dấu tất cả đã đọc |
| 32 | GET | `/notifications/stream` | Token (query) | ALL | SSE stream real-time |
| 33 | GET | `/dashboard` | Bearer | ALL | Dashboard stats |
| 34 | GET | `/trips/:id/export-pdf` | Bearer | Owner, FINANCE | Xuất PDF |
| 35 | GET | `/health` | Public | — | Health check |

---

## 16. Security Self-Check

### 16.1 Sensitive Data Exposure

| Kiểm tra | Kết quả |
|---|---|
| `password_hash` không xuất hiện trong bất kỳ response nào | ✅ Confirmed — không có field này trong bất kỳ response schema nào |
| `variancePct`, `totalActual` không nhận từ client | ✅ Server-computed, strip nếu client gửi |
| `estimatedBudgetSnapshot` không nhận từ client | ✅ Server set khi tạo expense |
| `tripDays` không nhận từ client | ✅ Generated column, ignore input |
| Gemini API key không bao giờ qua frontend | ✅ Chỉ AIService trên server gọi Gemini |
| Refresh token raw value không trong response body | ✅ Chỉ qua httpOnly cookie |
| JWT payload không chứa sensitive data | ✅ Chỉ `userId`, `role`, `name` |
| Error 500 không expose stack trace | ✅ Chỉ trả `INTERNAL_ERROR` + `requestId` |

### 16.2 Naming Convention

| Kiểm tra | Kết quả |
|---|---|
| Path: `kebab-case` | ✅ `/generate-itinerary`, `/read-all`, `/export-pdf` |
| JSON fields: `camelCase` | ✅ `estimatedBudget`, `departureDate`, `isUrgent` |
| Enum values: `SCREAMING_SNAKE_CASE` | ✅ `TIER1_CITY`, `MANAGER_GRADE`, `TRIP_IMMUTABLE` |
| Path params: `:tripId`, `:itemId` | ✅ Nhất quán, suffix `Id` |
| Action endpoints dùng `POST` | ✅ `/submit`, `/approve`, `/reject`, `/close`, `/reapprove` |
| Collection endpoints dùng plural | ✅ `/trips`, `/notifications` nhưng `/expense` là singular (1:1 relationship) — intentional |

### 16.3 Validation Gaps — Đã kiểm tra

| Endpoint | Validation risk | Cách xử lý |
|---|---|---|
| `POST /trips` | `departureDate` trong quá khứ | ✅ validate `>= today` |
| `POST /trips` | `returnDate < departureDate` | ✅ validate `>= departureDate` |
| `POST /trips/:id/itinerary` | `itemDate` ngoài trip range | ✅ validate trong `[departureDate, returnDate]` |
| `POST /trips/:id/expense/items` | `amount = 0` hoặc âm | ✅ validate `> 0` |
| `POST /trips/:id/expense/submit` | Không có items | ✅ check `items.count >= 1` |
| `POST /trips/:id/reject` | Thiếu `comment` | ✅ `comment` required |
| `POST /trips/:id/expense/reapprove` | `action = REJECTED` thiếu `comment` | ✅ conditional required |
| `PATCH /notifications/read-all` | Conflict với `PATCH /notifications/:id/read` | ✅ `read-all` đứng trước `:id` trong router để không bị shadow |
| `GET /notifications/stream` | Token trong query string (SSE limitation) | ⚠️ Accepted — server validate token, log warning nếu token trong URL |
| `POST /ai/generate-itinerary` | `days` không khớp trip duration | ✅ server validate `days <= trip.tripDays` |

---

*Mọi thay đổi API Contract phải cập nhật đồng thời `API.md` và `openapi.yaml`. Breaking changes cần ADR mới.*
