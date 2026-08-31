# Data Model — Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 — MIS3032_1
**Phiên bản:** v1.0
**Ngày tạo:** 2026-08-28
**Tác giả:** Engineering (Nguyễn Thị Ánh Tuyết)
**Tài liệu tham chiếu:** `architecture.md`, `business-rules.md`, `requirements.md`, `glossary.md`

---

## Mục lục

1. [Quy ước thiết kế](#1-quy-ước-thiết-kế)
2. [ERD — Sơ đồ quan hệ thực thể chi tiết](#2-erd--sơ-đồ-quan-hệ-thực-thể-chi-tiết)
3. [Mô tả chi tiết từng bảng](#3-mô-tả-chi-tiết-từng-bảng)
4. [Định nghĩa Enum Types](#4-định-nghĩa-enum-types)
5. [SQL DDL — Toàn bộ câu lệnh tạo bảng](#5-sql-ddl--toàn-bộ-câu-lệnh-tạo-bảng)
6. [Prisma Schema](#6-prisma-schema)
7. [Self-Check: Normalization, Race Condition, Business Logic Protection](#7-self-check-normalization-race-condition-business-logic-protection)

---

## 1. Quy ước thiết kế

| Quy ước | Chi tiết |
|---|---|
| **Primary Key** | `UUID v4` cho tất cả bảng — tránh sequential ID dễ đoán, an toàn hơn khi expose qua API |
| **Tiền tệ** | `BIGINT` (đồng VND nguyên, không có xu) — tránh hoàn toàn floating-point precision error. Ví dụ: 1.500.000 VNĐ = `1500000` |
| **Tỷ lệ phần trăm** | `NUMERIC(6,2)` — lưu dạng `10.50` = 10.5%; đủ range cho mọi tình huống variance |
| **Timestamp** | `TIMESTAMPTZ` (with time zone) — lưu UTC, hiển thị theo timezone client |
| **Enum** | PostgreSQL native `CREATE TYPE ... AS ENUM` — đảm bảo constraint ở DB level |
| **Tên bảng/cột** | `snake_case`, số ít cho entity chính, số nhiều cho bảng junction |
| **Soft delete** | Không dùng soft delete — dùng status transition và immutability guard thay thế |
| **Snapshot data** | Các trường `*_snapshot` lưu giá trị tại thời điểm xảy ra sự kiện, không thay đổi khi entity gốc thay đổi |
| **Audit trail** | Bảng `audit_logs` chỉ có `INSERT` — không bao giờ `UPDATE` hay `DELETE` |

---

## 2. ERD — Sơ đồ quan hệ thực thể chi tiết

```mermaid
erDiagram
    users {
        uuid id PK
        varchar(255) name
        varchar(255) email UK
        varchar(255) password_hash
        user_role role
        job_grade job_grade
        varchar(100) department
        uuid manager_id FK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        varchar(500) token_hash
        timestamptz expires_at
        boolean is_revoked
        varchar(45) ip_address
        timestamptz created_at
    }

    trips {
        uuid id PK
        uuid employee_id FK
        varchar(200) origin
        varchar(200) destination
        destination_type destination_type
        date departure_date
        date return_date
        int trip_days
        text purpose
        bigint estimated_budget
        bigint hotel_cost_per_night
        int hotel_nights
        bigint per_diem_budget
        bigint transport_budget
        bigint other_budget
        trip_status status
        boolean is_urgent
        text urgency_reason
        boolean requires_level2
        timestamptz submitted_at
        timestamptz approved_at
        timestamptz closed_at
        timestamptz created_at
        timestamptz updated_at
    }

    policy_check_results {
        uuid id PK
        uuid trip_id FK UK
        boolean passed
        jsonb violations
        int violation_count
        boolean requires_level2_approval
        timestamptz checked_at
    }

    itinerary_items {
        uuid id PK
        uuid trip_id FK
        date item_date
        int day_number
        time_slot time_slot
        varchar(300) location
        text activity
        itinerary_category category
        bigint estimated_cost
        text notes
        boolean is_ai_generated
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    approval_records {
        uuid id PK
        uuid trip_id FK
        uuid approver_id FK
        approval_level approval_level
        approval_action action
        text comment
        bigint budget_snapshot
        boolean had_violations_snapshot
        timestamptz acted_at
    }

    expenses {
        uuid id PK
        uuid trip_id FK UK
        bigint total_actual
        bigint estimated_budget_snapshot
        numeric_6_2 variance_pct
        bigint variance_amount
        text justification
        boolean manager_reapproval_required
        boolean manager_reapproved
        uuid manager_reapprover_id FK
        timestamptz manager_reapproved_at
        expense_status status
        timestamptz submitted_at
        timestamptz approved_at
        timestamptz created_at
        timestamptz updated_at
    }

    expense_items {
        uuid id PK
        uuid expense_id FK
        date expense_date
        expense_category category
        bigint amount
        text description
        varchar(500) receipt_url
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid recipient_id FK
        notification_type type
        text message
        uuid reference_id
        varchar(50) reference_type
        boolean is_read
        timestamptz read_at
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        audit_entity_type entity_type
        uuid entity_id
        varchar(100) action
        varchar(100) previous_state
        varchar(100) new_state
        jsonb metadata
        varchar(45) ip_address
        timestamptz timestamp
    }

    users ||--o{ trips : "employee_id: tạo yêu cầu"
    users ||--o{ users : "manager_id: quản lý trực tiếp"
    users ||--o{ refresh_tokens : "sở hữu token"
    users ||--o{ approval_records : "approver_id: thực hiện duyệt"
    users ||--o{ notifications : "recipient_id: nhận thông báo"
    users ||--o{ audit_logs : "user_id: thực hiện hành động"
    users ||--o| expenses : "manager_reapprover_id: duyệt lại"

    trips ||--|| policy_check_results : "trip_id: kết quả kiểm tra"
    trips ||--o{ itinerary_items : "trip_id: chứa mốc lịch trình"
    trips ||--o{ approval_records : "trip_id: lịch sử duyệt"
    trips ||--o| expenses : "trip_id: hồ sơ quyết toán"

    expenses ||--o{ expense_items : "expense_id: khoản chi tiết"
```

---

## 3. Mô tả chi tiết từng bảng

### 3.1 Bảng `users`

**Mục đích:** Lưu trữ toàn bộ người dùng hệ thống với vai trò (role) và cấp bậc (job_grade). Đây là nền tảng cho RBAC và kiểm tra hạn mức hotel theo BR-TR-01.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK`, `DEFAULT gen_random_uuid()` | Định danh duy nhất |
| `name` | `VARCHAR(255)` | NO | `NOT NULL` | Họ và tên đầy đủ |
| `email` | `VARCHAR(255)` | NO | `NOT NULL`, `UNIQUE` | Email đăng nhập — unique toàn hệ thống |
| `password_hash` | `VARCHAR(255)` | NO | `NOT NULL` | Mật khẩu đã hash bcrypt (cost=12) |
| `role` | `user_role` | NO | `NOT NULL` | Vai trò: `EMPLOYEE / MANAGER / TRAVEL_ADMIN / FINANCE / ADMIN` |
| `job_grade` | `job_grade` | NO | `NOT NULL` | Cấp bậc: `STAFF / MANAGER_GRADE / DIRECTOR` — dùng để tính trần hotel BR-TR-01 |
| `department` | `VARCHAR(100)` | YES | — | Phòng ban |
| `manager_id` | `UUID` | YES | `FK → users(id)` | Self-reference: quản lý trực tiếp. NULL nếu là cấp cao nhất |
| `is_active` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT true` | Tài khoản có hoạt động không |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm cập nhật cuối |

**Business Rules enforced:**
- `UNIQUE(email)` — mỗi email chỉ có một tài khoản.
- `job_grade` là input để PolicyCheckEngine tính hotel limit theo BR-TR-01: `STAFF → 1,000,000 VNĐ/đêm`, `MANAGER_GRADE → 1,800,000`, `DIRECTOR → 3,000,000`.
- `manager_id` tự tham chiếu: Employee có manager_id trỏ đến Manager của họ. Dùng để ApprovalRouter biết chuyển request cho ai.

---

### 3.2 Bảng `refresh_tokens`

**Mục đích:** Lưu Refresh Token (đã hash) để validate khi client xin cấp Access Token mới. Hỗ trợ logout và revoke token.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `user_id` | `UUID` | NO | `NOT NULL`, `FK → users(id) ON DELETE CASCADE` | Chủ sở hữu token |
| `token_hash` | `VARCHAR(500)` | NO | `NOT NULL`, `UNIQUE` | SHA-256 hash của refresh token string |
| `expires_at` | `TIMESTAMPTZ` | NO | `NOT NULL` | Thời điểm hết hạn (7 ngày từ lúc tạo) |
| `is_revoked` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Đã bị thu hồi (logout) chưa |
| `ip_address` | `VARCHAR(45)` | YES | — | IP tạo token (IPv6 max 45 chars) |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm cấp |

**Business Rules enforced:**
- `UNIQUE(token_hash)` — mỗi token là duy nhất.
- `ON DELETE CASCADE` — xóa user thì token cũng xóa.
- Server validate: `is_revoked = false AND expires_at > NOW()`.

---

### 3.3 Bảng `trips`

**Mục đích:** Entity trung tâm của hệ thống. Lưu toàn bộ thông tin Trip Request từ lúc DRAFT đến CLOSED. Là source-of-truth của trạng thái vòng đời chuyến công tác.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `employee_id` | `UUID` | NO | `NOT NULL`, `FK → users(id)` | Nhân viên tạo request |
| `origin` | `VARCHAR(200)` | NO | `NOT NULL` | Điểm xuất phát |
| `destination` | `VARCHAR(200)` | NO | `NOT NULL` | Điểm đến |
| `destination_type` | `destination_type` | NO | `NOT NULL` | `TIER1_CITY / OTHER` — dùng tính Per Diem BR-TR-02 |
| `departure_date` | `DATE` | NO | `NOT NULL` | Ngày khởi hành |
| `return_date` | `DATE` | NO | `NOT NULL`, `CHECK (return_date >= departure_date)` | Ngày về |
| `trip_days` | `INT` | NO | `NOT NULL`, `CHECK (trip_days >= 1)`, `GENERATED ALWAYS AS (return_date - departure_date + 1) STORED` | Số ngày công tác (tự tính) |
| `purpose` | `TEXT` | NO | `NOT NULL` | Mục đích chuyến đi |
| `estimated_budget` | `BIGINT` | NO | `NOT NULL`, `CHECK (estimated_budget > 0)` | Tổng dự toán (VND) |
| `hotel_cost_per_night` | `BIGINT` | YES | `CHECK (hotel_cost_per_night >= 0)` | Chi phí khách sạn/đêm — PolicyCheck so với BR-TR-01 |
| `hotel_nights` | `INT` | YES | `CHECK (hotel_nights >= 0)` | Số đêm lưu trú |
| `per_diem_budget` | `BIGINT` | YES | `CHECK (per_diem_budget >= 0)` | Dự toán phụ cấp — PolicyCheck so với BR-TR-02 |
| `transport_budget` | `BIGINT` | YES | `CHECK (transport_budget >= 0)` | Dự toán đi lại |
| `other_budget` | `BIGINT` | YES | `CHECK (other_budget >= 0)` | Chi phí khác |
| `status` | `trip_status` | NO | `NOT NULL`, `DEFAULT 'DRAFT'` | Trạng thái hiện tại — xem State Machine §9 architecture.md |
| `is_urgent` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Chuyến khẩn cấp (BR-TR-03) |
| `urgency_reason` | `TEXT` | YES | `CHECK (NOT is_urgent OR urgency_reason IS NOT NULL)` | Bắt buộc có nếu is_urgent=true |
| `requires_level2` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Cần duyệt cấp 2 (BR-TR-04) — set bởi PolicyCheckEngine |
| `submitted_at` | `TIMESTAMPTZ` | YES | — | Thời điểm nộp |
| `approved_at` | `TIMESTAMPTZ` | YES | — | Thời điểm được duyệt cuối cùng |
| `closed_at` | `TIMESTAMPTZ` | YES | — | Thời điểm đóng hồ sơ |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |

**Business Rules enforced:**

| Rule | Cơ chế |
|---|---|
| BR-TR-01 | `hotel_cost_per_night` lưu để PolicyCheckEngine so với limit theo `employee.job_grade` |
| BR-TR-02 | `per_diem_budget` lưu để PolicyCheckEngine so với `trip_days * PER_DIEM_RATE[destination_type]` |
| BR-TR-03 | `is_urgent = true` khi `departure_date - created_at < 3 working days`; `CHECK (NOT is_urgent OR urgency_reason IS NOT NULL)` đảm bảo có lý do |
| BR-TR-06 | `immutableGuard` middleware chặn write khi `status = 'CLOSED'`; `CHECK` constraint tùy chọn bổ sung qua trigger |
| Tính nhất quán budget | `CHECK (estimated_budget > 0)`, `CHECK (return_date >= departure_date)` |
| Generated column | `trip_days` tự tính từ dates, không cho client tự truyền vào |

**Indexes:**
```sql
CREATE INDEX idx_trips_employee_id    ON trips(employee_id);
CREATE INDEX idx_trips_status         ON trips(status);
CREATE INDEX idx_trips_departure_date ON trips(departure_date);
CREATE INDEX idx_trips_employee_status ON trips(employee_id, status);
```

---

### 3.4 Bảng `policy_check_results`

**Mục đích:** Lưu kết quả snapshot của PolicyCheckEngine tại thời điểm trip được submit. Quan hệ 1:1 với `trips`. Không được cập nhật sau khi tạo — là bằng chứng trạng thái chính sách tại thời điểm gửi.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `trip_id` | `UUID` | NO | `NOT NULL`, `FK → trips(id) ON DELETE CASCADE`, `UNIQUE` | 1:1 với trip |
| `passed` | `BOOLEAN` | NO | `NOT NULL` | True nếu không có violation nào |
| `violations` | `JSONB` | NO | `NOT NULL`, `DEFAULT '[]'` | Mảng JSON các violation: `[{code, detail, severity}]` |
| `violation_count` | `INT` | NO | `NOT NULL`, `CHECK (violation_count >= 0)`, `DEFAULT 0` | Số lượng vi phạm |
| `requires_level2_approval` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Có cần duyệt cấp 2 không (tổng hợp từ violations + budget) |
| `checked_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm chạy check |

**Snapshot design:** Bảng này là bản ghi bất biến. Nếu cần chạy lại policy check (ví dụ khi Employee chỉnh sửa trip ở trạng thái DRAFT), tạo record mới (replace), không update record cũ.

**Cấu trúc JSON `violations`:**
```json
[
  {
    "code": "POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET",
    "detail": "Hotel 2,000,000 VNĐ/đêm vượt hạn mức Staff (1,000,000 VNĐ/đêm)",
    "severity": "WARNING",
    "rule": "BR-TR-01",
    "limit": 1000000,
    "actual": 2000000
  }
]
```

---

### 3.5 Bảng `itinerary_items`

**Mục đích:** Lưu từng mốc hoạt động trong lịch trình công tác, phân theo ngày và buổi. Hỗ trợ cả mốc tự nhập và mốc AI sinh.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `trip_id` | `UUID` | NO | `NOT NULL`, `FK → trips(id) ON DELETE CASCADE` | Thuộc chuyến đi nào |
| `item_date` | `DATE` | NO | `NOT NULL` | Ngày diễn ra hoạt động |
| `day_number` | `INT` | NO | `NOT NULL`, `CHECK (day_number >= 1)` | Ngày thứ mấy của chuyến đi (1-based) |
| `time_slot` | `time_slot` | NO | `NOT NULL` | `MORNING / AFTERNOON / EVENING / ALL_DAY` |
| `location` | `VARCHAR(300)` | NO | `NOT NULL` | Địa điểm |
| `activity` | `TEXT` | NO | `NOT NULL` | Mô tả hoạt động |
| `category` | `itinerary_category` | NO | `NOT NULL` | `MEETING / ACCOMMODATION / TRANSPORT / MEAL / OTHER` |
| `estimated_cost` | `BIGINT` | NO | `NOT NULL`, `CHECK (estimated_cost >= 0)`, `DEFAULT 0` | Chi phí ước tính (VND) |
| `notes` | `TEXT` | YES | — | Ghi chú thêm |
| `is_ai_generated` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Do AI sinh hay người dùng tự nhập |
| `sort_order` | `INT` | NO | `NOT NULL`, `DEFAULT 0` | Thứ tự hiển thị trong cùng time_slot |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |

**Business Rules enforced:**
- Khi `trip.status = 'CLOSED'`: `immutableGuard` chặn mọi INSERT/UPDATE/DELETE vào bảng này.
- `item_date` nên nằm trong khoảng `[departure_date, return_date]` — validate ở Service layer.
- `estimated_cost >= 0` — không cho phép giá trị âm.

**Index:**
```sql
CREATE INDEX idx_itinerary_items_trip_id   ON itinerary_items(trip_id);
CREATE INDEX idx_itinerary_items_trip_date ON itinerary_items(trip_id, item_date);
```

---

### 3.6 Bảng `approval_records`

**Mục đích:** Lưu lịch sử từng hành động phê duyệt. Mỗi lần Manager hoặc Travel Admin approve/reject tạo ra một record. Snapshot budget tại thời điểm duyệt để đảm bảo truy vết.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `trip_id` | `UUID` | NO | `NOT NULL`, `FK → trips(id)` | Thuộc chuyến đi nào |
| `approver_id` | `UUID` | NO | `NOT NULL`, `FK → users(id)` | Người thực hiện duyệt |
| `approval_level` | `approval_level` | NO | `NOT NULL` | `LEVEL_1 / LEVEL_2 / MANAGER_REAPPROVE` |
| `action` | `approval_action` | NO | `NOT NULL` | `APPROVED / REJECTED` |
| `comment` | `TEXT` | YES | `CHECK (action != 'REJECTED' OR comment IS NOT NULL)` | Bắt buộc có lý do khi REJECTED |
| `budget_snapshot` | `BIGINT` | NO | `NOT NULL` | Snapshot `estimated_budget` tại thời điểm duyệt — bất biến |
| `had_violations_snapshot` | `BOOLEAN` | NO | `NOT NULL` | Snapshot có vi phạm policy hay không tại thời điểm duyệt |
| `acted_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm thực hiện |

**Constraint chống double-approve:**
```sql
CREATE UNIQUE INDEX uix_approval_records_trip_level_approved
  ON approval_records(trip_id, approval_level)
  WHERE action = 'APPROVED';
```
→ Mỗi cấp duyệt chỉ được có tối đa 1 record `APPROVED`. Nếu reject rồi approve lại (sau khi employee chỉnh sửa) thì trip_id thay đổi hoặc tạo record reject trước.

**Business Rules enforced:**
- BR-TR-04: ApprovalRouter quyết định `approval_level` dựa trên `budget_snapshot` và `had_violations_snapshot`.
- `comment IS NOT NULL` khi `action = 'REJECTED'` — enforce tại cả DB và Service.
- Snapshot fields đảm bảo audit trail chính xác dù trip.estimated_budget có thể thay đổi sau.

**Indexes:**
```sql
CREATE INDEX idx_approval_records_trip_id ON approval_records(trip_id);
CREATE INDEX idx_approval_records_approver_id ON approval_records(approver_id);
```

---

### 3.7 Bảng `expenses`

**Mục đích:** Header của Expense Claim. Quan hệ 1:1 với `trips` (một trip chỉ có một expense claim). Lưu tổng hợp và variance so với dự toán.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `trip_id` | `UUID` | NO | `NOT NULL`, `FK → trips(id)`, `UNIQUE` | 1:1 với trip |
| `total_actual` | `BIGINT` | NO | `NOT NULL`, `DEFAULT 0`, `CHECK (total_actual >= 0)` | Tổng chi phí thực tế (tính từ expense_items) |
| `estimated_budget_snapshot` | `BIGINT` | NO | `NOT NULL` | Snapshot `trip.estimated_budget` tại thời điểm tạo Expense Claim — không thay đổi |
| `variance_pct` | `NUMERIC(6,2)` | YES | — | `(total_actual - estimated_budget_snapshot) / estimated_budget_snapshot * 100`. NULL khi chưa submit. Tính bởi Service, không cho client truyền vào |
| `variance_amount` | `BIGINT` | YES | — | `total_actual - estimated_budget_snapshot` (VND). Tính bởi Service |
| `justification` | `TEXT` | YES | — | Giải trình bắt buộc khi `variance_pct BETWEEN 0 AND 10` |
| `manager_reapproval_required` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | True khi `variance_pct > 10` (BR-TR-05) |
| `manager_reapproved` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Manager đã duyệt lại chưa |
| `manager_reapprover_id` | `UUID` | YES | `FK → users(id)` | Manager đã duyệt phần vượt chi |
| `manager_reapproved_at` | `TIMESTAMPTZ` | YES | — | Thời điểm Manager duyệt lại |
| `status` | `expense_status` | NO | `NOT NULL`, `DEFAULT 'DRAFT'` | `DRAFT / SUBMITTED / APPROVED / REJECTED / CLOSED` |
| `submitted_at` | `TIMESTAMPTZ` | YES | — | Thời điểm nộp |
| `approved_at` | `TIMESTAMPTZ` | YES | — | Thời điểm Finance approve |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |

**Business Rules enforced (BR-TR-05):**

| Condition | Action |
|---|---|
| `variance_pct <= 0` | Finance có thể approve ngay |
| `0 < variance_pct <= 10` | Service kiểm tra `justification IS NOT NULL AND justification != ''` trước khi cho submit |
| `variance_pct > 10` | Service set `manager_reapproval_required = true`; Finance không thể close đến khi `manager_reapproved = true` |

**Tại sao `total_actual` lưu trực tiếp thay vì JOIN?** Để tránh tính toán lại mỗi lần query và để variance không thay đổi sau khi đã submit. Service cập nhật `total_actual` mỗi khi expense_item thay đổi (chỉ khi status = DRAFT).

---

### 3.8 Bảng `expense_items`

**Mục đích:** Từng khoản chi thành phần trong Expense Claim. Là dữ liệu chi tiết để Finance kiểm tra chứng từ.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `expense_id` | `UUID` | NO | `NOT NULL`, `FK → expenses(id) ON DELETE CASCADE` | Thuộc expense claim nào |
| `expense_date` | `DATE` | NO | `NOT NULL` | Ngày phát sinh chi phí |
| `category` | `expense_category` | NO | `NOT NULL` | `ACCOMMODATION / TRANSPORT / MEAL / PER_DIEM / OTHER` |
| `amount` | `BIGINT` | NO | `NOT NULL`, `CHECK (amount > 0)` | Số tiền (VND) — phải > 0 |
| `description` | `TEXT` | NO | `NOT NULL` | Mô tả khoản chi |
| `receipt_url` | `VARCHAR(500)` | YES | — | URL chứng từ/hóa đơn mock |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | |

**Business Rules enforced:**
- `CHECK (amount > 0)` — khoản chi không thể âm hoặc bằng 0.
- Chỉ cho phép INSERT/UPDATE/DELETE khi `expense.status = 'DRAFT'` — enforce ở Service layer.
- Sau mỗi INSERT/UPDATE/DELETE: Service cập nhật lại `expenses.total_actual`.

**Index:**
```sql
CREATE INDEX idx_expense_items_expense_id ON expense_items(expense_id);
```

---

### 3.9 Bảng `notifications`

**Mục đích:** Lưu các thông báo in-app (REQ-TR-11). NotificationService insert vào đây và emit SSE event đến client.

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `recipient_id` | `UUID` | NO | `NOT NULL`, `FK → users(id) ON DELETE CASCADE` | Người nhận |
| `type` | `notification_type` | NO | `NOT NULL` | `TRIP_APPROVED / TRIP_REJECTED / EXPENSE_APPROVED / EXPENSE_REJECTED / PENDING_APPROVAL / TRIP_CLOSED` |
| `message` | `TEXT` | NO | `NOT NULL` | Nội dung thông báo (human-readable) |
| `reference_id` | `UUID` | YES | — | ID của entity liên quan (tripId hoặc expenseId) |
| `reference_type` | `VARCHAR(50)` | YES | — | `TRIP` hoặc `EXPENSE` |
| `is_read` | `BOOLEAN` | NO | `NOT NULL`, `DEFAULT false` | Đã đọc chưa |
| `read_at` | `TIMESTAMPTZ` | YES | — | Thời điểm đánh dấu đã đọc |
| `created_at` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |

**Indexes:**
```sql
CREATE INDEX idx_notifications_recipient_id       ON notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_unread   ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_reference_id       ON notifications(reference_id);
```

---

### 3.10 Bảng `audit_logs`

**Mục đích:** Immutable audit trail cho tất cả hành động nhạy cảm (NFR-TR-04). **Chỉ INSERT, không bao giờ UPDATE hay DELETE.**

| Cột | Kiểu dữ liệu | Nullable | Constraint | Mô tả |
|---|---|---|---|---|
| `id` | `UUID` | NO | `PK` | Định danh |
| `user_id` | `UUID` | NO | `NOT NULL`, `FK → users(id)` | Người thực hiện (dùng SET DEFAULT cho system action) |
| `entity_type` | `audit_entity_type` | NO | `NOT NULL` | `TRIP / EXPENSE / ITINERARY / USER / AUTH` |
| `entity_id` | `UUID` | NO | `NOT NULL` | ID của entity bị tác động |
| `action` | `VARCHAR(100)` | NO | `NOT NULL` | Hành động: `TRIP_SUBMITTED`, `MANAGER_APPROVED`, `TRIP_CLOSED`... |
| `previous_state` | `VARCHAR(100)` | YES | — | Trạng thái trước khi thay đổi |
| `new_state` | `VARCHAR(100)` | YES | — | Trạng thái sau khi thay đổi |
| `metadata` | `JSONB` | YES | `DEFAULT '{}'` | Context thêm: budget, violation list, IP... |
| `ip_address` | `VARCHAR(45)` | YES | — | IP của request |
| `timestamp` | `TIMESTAMPTZ` | NO | `NOT NULL`, `DEFAULT NOW()` | Thời điểm xảy ra — KHÔNG có cột updated_at |

**Bảo vệ immutability:**
```sql
-- Trigger chặn UPDATE và DELETE trên audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs là immutable — không được UPDATE hoặc DELETE (NFR-TR-04)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

**Indexes:**
```sql
CREATE INDEX idx_audit_logs_entity        ON audit_logs(entity_id, entity_type);
CREATE INDEX idx_audit_logs_user_id       ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp     ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action        ON audit_logs(action);
```

---

## 4. Định nghĩa Enum Types

```sql
-- Vai trò người dùng (RBAC)
CREATE TYPE user_role AS ENUM (
    'EMPLOYEE',
    'MANAGER',
    'TRAVEL_ADMIN',
    'FINANCE',
    'ADMIN'
);

-- Cấp bậc — dùng để tính hotel limit BR-TR-01
CREATE TYPE job_grade AS ENUM (
    'STAFF',           -- Hotel max: 1,000,000 VNĐ/đêm
    'MANAGER_GRADE',   -- Hotel max: 1,800,000 VNĐ/đêm
    'DIRECTOR'         -- Hotel max: 3,000,000 VNĐ/đêm
);

-- Loại điểm đến — dùng để tính per diem BR-TR-02
CREATE TYPE destination_type AS ENUM (
    'TIER1_CITY',   -- Hà Nội, TP.HCM, Đà Nẵng: 400,000 VNĐ/ngày
    'OTHER'         -- Tỉnh thành khác: 300,000 VNĐ/ngày
);

-- Trạng thái vòng đời Trip (State Machine)
CREATE TYPE trip_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'MANAGER_REVIEWING',
    'PENDING_ADMIN_APPROVAL',
    'APPROVED',
    'ONGOING',
    'EXPENSE_DRAFT',
    'EXPENSE_SUBMITTED',
    'EXPENSE_APPROVED',
    'EXPENSE_REJECTED',
    'MANAGER_REAPPROVE',
    'CLOSED',
    'REJECTED'
);

-- Buổi trong ngày (lịch trình)
CREATE TYPE time_slot AS ENUM (
    'MORNING',
    'AFTERNOON',
    'EVENING',
    'ALL_DAY'
);

-- Danh mục mốc lịch trình
CREATE TYPE itinerary_category AS ENUM (
    'MEETING',
    'ACCOMMODATION',
    'TRANSPORT',
    'MEAL',
    'OTHER'
);

-- Cấp phê duyệt
CREATE TYPE approval_level AS ENUM (
    'LEVEL_1',           -- Manager duyệt cấp 1
    'LEVEL_2',           -- Travel Admin duyệt cấp 2
    'MANAGER_REAPPROVE'  -- Manager duyệt lại khi variance > 10%
);

-- Hành động phê duyệt
CREATE TYPE approval_action AS ENUM (
    'APPROVED',
    'REJECTED'
);

-- Trạng thái Expense Claim
CREATE TYPE expense_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'CLOSED'
);

-- Danh mục khoản chi
CREATE TYPE expense_category AS ENUM (
    'ACCOMMODATION',
    'TRANSPORT',
    'MEAL',
    'PER_DIEM',
    'OTHER'
);

-- Loại thông báo
CREATE TYPE notification_type AS ENUM (
    'TRIP_APPROVED',
    'TRIP_REJECTED',
    'PENDING_LEVEL1_APPROVAL',
    'PENDING_LEVEL2_APPROVAL',
    'EXPENSE_SUBMITTED',
    'EXPENSE_APPROVED',
    'EXPENSE_REJECTED',
    'MANAGER_REAPPROVAL_REQUIRED',
    'TRIP_CLOSED'
);

-- Loại entity trong audit log
CREATE TYPE audit_entity_type AS ENUM (
    'TRIP',
    'EXPENSE',
    'ITINERARY',
    'USER',
    'AUTH'
);
```

---

## 5. SQL DDL — Toàn bộ câu lệnh tạo bảng

> **Lưu ý:** Chạy theo thứ tự dưới đây để tránh lỗi FK constraint. Extension `pgcrypto` cần được bật để dùng `gen_random_uuid()`.

```sql
-- ============================================================
-- BOOTSTRAP
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES (chạy trước tất cả CREATE TABLE)
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'EMPLOYEE', 'MANAGER', 'TRAVEL_ADMIN', 'FINANCE', 'ADMIN'
);

CREATE TYPE job_grade AS ENUM (
    'STAFF', 'MANAGER_GRADE', 'DIRECTOR'
);

CREATE TYPE destination_type AS ENUM (
    'TIER1_CITY', 'OTHER'
);

CREATE TYPE trip_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'MANAGER_REVIEWING',
    'PENDING_ADMIN_APPROVAL', 'APPROVED', 'ONGOING',
    'EXPENSE_DRAFT', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED',
    'EXPENSE_REJECTED', 'MANAGER_REAPPROVE', 'CLOSED', 'REJECTED'
);

CREATE TYPE time_slot AS ENUM (
    'MORNING', 'AFTERNOON', 'EVENING', 'ALL_DAY'
);

CREATE TYPE itinerary_category AS ENUM (
    'MEETING', 'ACCOMMODATION', 'TRANSPORT', 'MEAL', 'OTHER'
);

CREATE TYPE approval_level AS ENUM (
    'LEVEL_1', 'LEVEL_2', 'MANAGER_REAPPROVE'
);

CREATE TYPE approval_action AS ENUM (
    'APPROVED', 'REJECTED'
);

CREATE TYPE expense_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED'
);

CREATE TYPE expense_category AS ENUM (
    'ACCOMMODATION', 'TRANSPORT', 'MEAL', 'PER_DIEM', 'OTHER'
);

CREATE TYPE notification_type AS ENUM (
    'TRIP_APPROVED', 'TRIP_REJECTED',
    'PENDING_LEVEL1_APPROVAL', 'PENDING_LEVEL2_APPROVAL',
    'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'EXPENSE_REJECTED',
    'MANAGER_REAPPROVAL_REQUIRED', 'TRIP_CLOSED'
);

CREATE TYPE audit_entity_type AS ENUM (
    'TRIP', 'EXPENSE', 'ITINERARY', 'USER', 'AUTH'
);

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            user_role       NOT NULL,
    job_grade       job_grade       NOT NULL DEFAULT 'STAFF',
    department      VARCHAR(100),
    manager_id      UUID,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_manager
        FOREIGN KEY (manager_id) REFERENCES users(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED  -- tránh lỗi khi insert manager trước employee
);

CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_role       ON users(role);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL,
    token_hash  VARCHAR(500) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- Partial index: chỉ index token còn hiệu lực
CREATE INDEX idx_refresh_tokens_active
    ON refresh_tokens(token_hash)
    WHERE is_revoked = FALSE;

-- ============================================================
-- TABLE: trips
-- ============================================================
CREATE TABLE trips (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    employee_id         UUID            NOT NULL,
    origin              VARCHAR(200)    NOT NULL,
    destination         VARCHAR(200)    NOT NULL,
    destination_type    destination_type NOT NULL,
    departure_date      DATE            NOT NULL,
    return_date         DATE            NOT NULL,
    -- Generated column: tự tính, không cho client truyền
    trip_days           INT             GENERATED ALWAYS AS
                            (return_date - departure_date + 1) STORED,
    purpose             TEXT            NOT NULL,
    -- Ngân sách — tất cả đơn vị VND (BIGINT)
    estimated_budget    BIGINT          NOT NULL,
    hotel_cost_per_night BIGINT,
    hotel_nights        INT,
    per_diem_budget     BIGINT,
    transport_budget    BIGINT,
    other_budget        BIGINT,
    -- Trạng thái
    status              trip_status     NOT NULL DEFAULT 'DRAFT',
    -- Urgent trip (BR-TR-03)
    is_urgent           BOOLEAN         NOT NULL DEFAULT FALSE,
    urgency_reason      TEXT,
    -- Approval routing (BR-TR-04)
    requires_level2     BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Timestamps quan trọng
    submitted_at        TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_trips PRIMARY KEY (id),
    CONSTRAINT fk_trips_employee
        FOREIGN KEY (employee_id) REFERENCES users(id),

    -- Validation constraints
    CONSTRAINT chk_trips_dates
        CHECK (return_date >= departure_date),
    CONSTRAINT chk_trips_budget_positive
        CHECK (estimated_budget > 0),
    CONSTRAINT chk_trips_hotel_cost
        CHECK (hotel_cost_per_night IS NULL OR hotel_cost_per_night >= 0),
    CONSTRAINT chk_trips_hotel_nights
        CHECK (hotel_nights IS NULL OR hotel_nights >= 0),
    CONSTRAINT chk_trips_per_diem
        CHECK (per_diem_budget IS NULL OR per_diem_budget >= 0),
    CONSTRAINT chk_trips_transport
        CHECK (transport_budget IS NULL OR transport_budget >= 0),
    CONSTRAINT chk_trips_other
        CHECK (other_budget IS NULL OR other_budget >= 0),

    -- BR-TR-03: urgent trip phải có lý do
    CONSTRAINT chk_trips_urgent_reason
        CHECK (NOT is_urgent OR urgency_reason IS NOT NULL),

    -- Timestamp consistency
    CONSTRAINT chk_trips_approved_after_submitted
        CHECK (approved_at IS NULL OR submitted_at IS NULL OR approved_at >= submitted_at),
    CONSTRAINT chk_trips_closed_after_approved
        CHECK (closed_at IS NULL OR approved_at IS NULL OR closed_at >= approved_at)
);

CREATE INDEX idx_trips_employee_id      ON trips(employee_id);
CREATE INDEX idx_trips_status           ON trips(status);
CREATE INDEX idx_trips_departure_date   ON trips(departure_date);
CREATE INDEX idx_trips_employee_status  ON trips(employee_id, status);
CREATE INDEX idx_trips_created_at       ON trips(created_at DESC);

-- ============================================================
-- TABLE: policy_check_results
-- ============================================================
CREATE TABLE policy_check_results (
    id                          UUID        NOT NULL DEFAULT gen_random_uuid(),
    trip_id                     UUID        NOT NULL,
    passed                      BOOLEAN     NOT NULL,
    violations                  JSONB       NOT NULL DEFAULT '[]',
    violation_count             INT         NOT NULL DEFAULT 0,
    requires_level2_approval    BOOLEAN     NOT NULL DEFAULT FALSE,
    checked_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policy_check_results PRIMARY KEY (id),
    CONSTRAINT uq_policy_check_trip UNIQUE (trip_id),  -- 1:1 với trip
    CONSTRAINT fk_policy_check_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_policy_violation_count
        CHECK (violation_count >= 0),
    -- Consistency: passed=true chỉ khi không có violation
    CONSTRAINT chk_policy_passed_consistent
        CHECK (
            (passed = TRUE AND violation_count = 0) OR
            (passed = FALSE AND violation_count >= 0)
        )
);

CREATE INDEX idx_policy_check_trip_id ON policy_check_results(trip_id);

-- ============================================================
-- TABLE: itinerary_items
-- ============================================================
CREATE TABLE itinerary_items (
    id              UUID                NOT NULL DEFAULT gen_random_uuid(),
    trip_id         UUID                NOT NULL,
    item_date       DATE                NOT NULL,
    day_number      INT                 NOT NULL,
    time_slot       time_slot           NOT NULL,
    location        VARCHAR(300)        NOT NULL,
    activity        TEXT                NOT NULL,
    category        itinerary_category  NOT NULL,
    estimated_cost  BIGINT              NOT NULL DEFAULT 0,
    notes           TEXT,
    is_ai_generated BOOLEAN             NOT NULL DEFAULT FALSE,
    sort_order      INT                 NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_itinerary_items PRIMARY KEY (id),
    CONSTRAINT fk_itinerary_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_itinerary_cost
        CHECK (estimated_cost >= 0),
    CONSTRAINT chk_itinerary_day_number
        CHECK (day_number >= 1)
);

CREATE INDEX idx_itinerary_trip_id   ON itinerary_items(trip_id);
CREATE INDEX idx_itinerary_trip_date ON itinerary_items(trip_id, item_date);

-- ============================================================
-- TABLE: approval_records
-- ============================================================
CREATE TABLE approval_records (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid(),
    trip_id                     UUID            NOT NULL,
    approver_id                 UUID            NOT NULL,
    approval_level              approval_level  NOT NULL,
    action                      approval_action NOT NULL,
    comment                     TEXT,
    -- Snapshot tại thời điểm duyệt (bất biến sau INSERT)
    budget_snapshot             BIGINT          NOT NULL,
    had_violations_snapshot     BOOLEAN         NOT NULL,
    acted_at                    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_approval_records PRIMARY KEY (id),
    CONSTRAINT fk_approval_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id),
    CONSTRAINT fk_approval_approver
        FOREIGN KEY (approver_id) REFERENCES users(id),

    -- BR-TR-04: REJECTED phải có comment
    CONSTRAINT chk_approval_reject_comment
        CHECK (action != 'REJECTED' OR comment IS NOT NULL),

    -- Budget snapshot phải dương
    CONSTRAINT chk_approval_budget_snapshot
        CHECK (budget_snapshot > 0)
);

-- Chặn double-approve: mỗi cấp chỉ có 1 APPROVED record cho 1 trip
CREATE UNIQUE INDEX uix_approval_one_per_level_approved
    ON approval_records(trip_id, approval_level)
    WHERE action = 'APPROVED';

CREATE INDEX idx_approval_trip_id     ON approval_records(trip_id);
CREATE INDEX idx_approval_approver_id ON approval_records(approver_id);

-- ============================================================
-- TABLE: expenses
-- ============================================================
CREATE TABLE expenses (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid(),
    trip_id                     UUID            NOT NULL,
    total_actual                BIGINT          NOT NULL DEFAULT 0,
    -- Snapshot dự toán tại thời điểm tạo expense (bất biến)
    estimated_budget_snapshot   BIGINT          NOT NULL,
    -- Tính bởi Service, không cho client set trực tiếp
    variance_pct                NUMERIC(6,2),
    variance_amount             BIGINT,
    justification               TEXT,
    -- BR-TR-05: cần Manager duyệt lại khi variance > 10%
    manager_reapproval_required BOOLEAN         NOT NULL DEFAULT FALSE,
    manager_reapproved          BOOLEAN         NOT NULL DEFAULT FALSE,
    manager_reapprover_id       UUID,
    manager_reapproved_at       TIMESTAMPTZ,
    status                      expense_status  NOT NULL DEFAULT 'DRAFT',
    submitted_at                TIMESTAMPTZ,
    approved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_expenses PRIMARY KEY (id),
    CONSTRAINT uq_expenses_trip UNIQUE (trip_id),  -- 1:1 với trip
    CONSTRAINT fk_expenses_trip
        FOREIGN KEY (trip_id) REFERENCES trips(id),
    CONSTRAINT fk_expenses_reapprover
        FOREIGN KEY (manager_reapprover_id) REFERENCES users(id),

    -- Validation
    CONSTRAINT chk_expenses_total_actual
        CHECK (total_actual >= 0),
    CONSTRAINT chk_expenses_budget_snapshot
        CHECK (estimated_budget_snapshot > 0),

    -- BR-TR-05: nếu manager_reapproved=true thì phải có reapprover và timestamp
    CONSTRAINT chk_expenses_reapproval_consistent
        CHECK (
            NOT manager_reapproved OR
            (manager_reapprover_id IS NOT NULL AND manager_reapproved_at IS NOT NULL)
        ),

    -- Timestamp consistency
    CONSTRAINT chk_expenses_approved_after_submitted
        CHECK (approved_at IS NULL OR submitted_at IS NULL OR approved_at >= submitted_at)
);

CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_status  ON expenses(status);

-- ============================================================
-- TABLE: expense_items
-- ============================================================
CREATE TABLE expense_items (
    id              UUID                NOT NULL DEFAULT gen_random_uuid(),
    expense_id      UUID                NOT NULL,
    expense_date    DATE                NOT NULL,
    category        expense_category    NOT NULL,
    amount          BIGINT              NOT NULL,
    description     TEXT                NOT NULL,
    receipt_url     VARCHAR(500),
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_expense_items PRIMARY KEY (id),
    CONSTRAINT fk_expense_items_expense
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
        ON DELETE CASCADE,

    -- Khoản chi phải dương
    CONSTRAINT chk_expense_items_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_expense_items_expense_id ON expense_items(expense_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
    id              UUID                NOT NULL DEFAULT gen_random_uuid(),
    recipient_id    UUID                NOT NULL,
    type            notification_type   NOT NULL,
    message         TEXT                NOT NULL,
    reference_id    UUID,
    reference_type  VARCHAR(50),
    is_read         BOOLEAN             NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id)
        ON DELETE CASCADE,

    -- Consistency: read_at chỉ có khi is_read = true
    CONSTRAINT chk_notifications_read_at
        CHECK (NOT is_read OR read_at IS NOT NULL)
);

CREATE INDEX idx_notifications_recipient       ON notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_unread
    ON notifications(recipient_id, is_read)
    WHERE is_read = FALSE;
CREATE INDEX idx_notifications_reference       ON notifications(reference_id);
CREATE INDEX idx_notifications_created_at      ON notifications(created_at DESC);

-- ============================================================
-- TABLE: audit_logs (INSERT-ONLY)
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID                NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID                NOT NULL,
    entity_type     audit_entity_type   NOT NULL,
    entity_id       UUID                NOT NULL,
    action          VARCHAR(100)        NOT NULL,
    previous_state  VARCHAR(100),
    new_state       VARCHAR(100),
    metadata        JSONB               NOT NULL DEFAULT '{}',
    ip_address      VARCHAR(45),
    -- Không có updated_at — bảng này KHÔNG bao giờ UPDATE
    "timestamp"     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_logs_entity    ON audit_logs(entity_id, entity_type);
CREATE INDEX idx_audit_logs_user_id   ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs("timestamp" DESC);
CREATE INDEX idx_audit_logs_action    ON audit_logs(action);

-- ============================================================
-- TRIGGER: Bảo vệ immutability của audit_logs (NFR-TR-04)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'audit_logs là immutable — hành vi UPDATE/DELETE bị nghiêm cấm theo NFR-TR-04. Entity: %, Action: %',
        OLD.entity_type, OLD.action;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_audit_log_modification();

-- ============================================================
-- TRIGGER: updated_at tự động cập nhật
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_itinerary_items_updated_at
    BEFORE UPDATE ON itinerary_items
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
```

---

## 6. Prisma Schema

```prisma
// prisma/schema.prisma
// Generator & datasource

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum UserRole {
  EMPLOYEE
  MANAGER
  TRAVEL_ADMIN
  FINANCE
  ADMIN
}

enum JobGrade {
  STAFF
  MANAGER_GRADE
  DIRECTOR
}

enum DestinationType {
  TIER1_CITY
  OTHER
}

enum TripStatus {
  DRAFT
  SUBMITTED
  MANAGER_REVIEWING
  PENDING_ADMIN_APPROVAL
  APPROVED
  ONGOING
  EXPENSE_DRAFT
  EXPENSE_SUBMITTED
  EXPENSE_APPROVED
  EXPENSE_REJECTED
  MANAGER_REAPPROVE
  CLOSED
  REJECTED
}

enum TimeSlot {
  MORNING
  AFTERNOON
  EVENING
  ALL_DAY
}

enum ItineraryCategory {
  MEETING
  ACCOMMODATION
  TRANSPORT
  MEAL
  OTHER
}

enum ApprovalLevel {
  LEVEL_1
  LEVEL_2
  MANAGER_REAPPROVE
}

enum ApprovalAction {
  APPROVED
  REJECTED
}

enum ExpenseStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  CLOSED
}

enum ExpenseCategory {
  ACCOMMODATION
  TRANSPORT
  MEAL
  PER_DIEM
  OTHER
}

enum NotificationType {
  TRIP_APPROVED
  TRIP_REJECTED
  PENDING_LEVEL1_APPROVAL
  PENDING_LEVEL2_APPROVAL
  EXPENSE_SUBMITTED
  EXPENSE_APPROVED
  EXPENSE_REJECTED
  MANAGER_REAPPROVAL_REQUIRED
  TRIP_CLOSED
}

enum AuditEntityType {
  TRIP
  EXPENSE
  ITINERARY
  USER
  AUTH
}

// ─────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────

model User {
  id           String    @id @default(uuid())
  name         String    @db.VarChar(255)
  email        String    @unique @db.VarChar(255)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  role         UserRole
  jobGrade     JobGrade  @default(STAFF) @map("job_grade")
  department   String?   @db.VarChar(100)
  managerId    String?   @map("manager_id") @db.Uuid
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  manager           User?            @relation("UserManager", fields: [managerId], references: [id])
  subordinates      User[]           @relation("UserManager")
  trips             Trip[]           @relation("TripEmployee")
  approvalRecords   ApprovalRecord[]
  notifications     Notification[]
  auditLogs         AuditLog[]
  refreshTokens     RefreshToken[]
  reapprovedExpenses Expense[]       @relation("ExpenseReapprover")

  @@map("users")
}

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash") @db.VarChar(500)
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  isRevoked  Boolean   @default(false) @map("is_revoked")
  ipAddress  String?   @map("ip_address") @db.VarChar(45)
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model Trip {
  id                 String          @id @default(uuid())
  employeeId         String          @map("employee_id") @db.Uuid
  origin             String          @db.VarChar(200)
  destination        String          @db.VarChar(200)
  destinationType    DestinationType @map("destination_type")
  departureDate      DateTime        @map("departure_date") @db.Date
  returnDate         DateTime        @map("return_date") @db.Date
  purpose            String          @db.Text
  estimatedBudget    BigInt          @map("estimated_budget")
  hotelCostPerNight  BigInt?         @map("hotel_cost_per_night")
  hotelNights        Int?            @map("hotel_nights")
  perDiemBudget      BigInt?         @map("per_diem_budget")
  transportBudget    BigInt?         @map("transport_budget")
  otherBudget        BigInt?         @map("other_budget")
  status             TripStatus      @default(DRAFT)
  isUrgent           Boolean         @default(false) @map("is_urgent")
  urgencyReason      String?         @map("urgency_reason") @db.Text
  requiresLevel2     Boolean         @default(false) @map("requires_level2")
  submittedAt        DateTime?       @map("submitted_at") @db.Timestamptz
  approvedAt         DateTime?       @map("approved_at") @db.Timestamptz
  closedAt           DateTime?       @map("closed_at") @db.Timestamptz
  createdAt          DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime        @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  employee          User                @relation("TripEmployee", fields: [employeeId], references: [id])
  policyCheckResult PolicyCheckResult?
  itineraryItems    ItineraryItem[]
  approvalRecords   ApprovalRecord[]
  expense           Expense?

  @@index([employeeId])
  @@index([status])
  @@index([departureDate])
  @@index([employeeId, status])
  @@map("trips")
}

model PolicyCheckResult {
  id                       String    @id @default(uuid())
  tripId                   String    @unique @map("trip_id") @db.Uuid
  passed                   Boolean
  violations               Json      @default("[]")
  violationCount           Int       @default(0) @map("violation_count")
  requiresLevel2Approval   Boolean   @default(false) @map("requires_level2_approval")
  checkedAt                DateTime  @default(now()) @map("checked_at") @db.Timestamptz

  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@map("policy_check_results")
}

model ItineraryItem {
  id             String            @id @default(uuid())
  tripId         String            @map("trip_id") @db.Uuid
  itemDate       DateTime          @map("item_date") @db.Date
  dayNumber      Int               @map("day_number")
  timeSlot       TimeSlot          @map("time_slot")
  location       String            @db.VarChar(300)
  activity       String            @db.Text
  category       ItineraryCategory
  estimatedCost  BigInt            @default(0) @map("estimated_cost")
  notes          String?           @db.Text
  isAiGenerated  Boolean           @default(false) @map("is_ai_generated")
  sortOrder      Int               @default(0) @map("sort_order")
  createdAt      DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@index([tripId])
  @@index([tripId, itemDate])
  @@map("itinerary_items")
}

model ApprovalRecord {
  id                       String          @id @default(uuid())
  tripId                   String          @map("trip_id") @db.Uuid
  approverId               String          @map("approver_id") @db.Uuid
  approvalLevel            ApprovalLevel   @map("approval_level")
  action                   ApprovalAction
  comment                  String?         @db.Text
  budgetSnapshot           BigInt          @map("budget_snapshot")
  hadViolationsSnapshot    Boolean         @map("had_violations_snapshot")
  actedAt                  DateTime        @default(now()) @map("acted_at") @db.Timestamptz

  trip     Trip @relation(fields: [tripId], references: [id])
  approver User @relation(fields: [approverId], references: [id])

  @@index([tripId])
  @@index([approverId])
  @@map("approval_records")
}

model Expense {
  id                        String        @id @default(uuid())
  tripId                    String        @unique @map("trip_id") @db.Uuid
  totalActual               BigInt        @default(0) @map("total_actual")
  estimatedBudgetSnapshot   BigInt        @map("estimated_budget_snapshot")
  variancePct               Decimal?      @map("variance_pct") @db.Decimal(6, 2)
  varianceAmount            BigInt?       @map("variance_amount")
  justification             String?       @db.Text
  managerReapprovalRequired Boolean       @default(false) @map("manager_reapproval_required")
  managerReapproved         Boolean       @default(false) @map("manager_reapproved")
  managerReapproverId       String?       @map("manager_reapprover_id") @db.Uuid
  managerReapprovedAt       DateTime?     @map("manager_reapproved_at") @db.Timestamptz
  status                    ExpenseStatus @default(DRAFT)
  submittedAt               DateTime?     @map("submitted_at") @db.Timestamptz
  approvedAt                DateTime?     @map("approved_at") @db.Timestamptz
  createdAt                 DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                 DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  trip               Trip          @relation(fields: [tripId], references: [id])
  managerReapprover  User?         @relation("ExpenseReapprover", fields: [managerReapproverId], references: [id])
  items              ExpenseItem[]

  @@index([tripId])
  @@index([status])
  @@map("expenses")
}

model ExpenseItem {
  id           String          @id @default(uuid())
  expenseId    String          @map("expense_id") @db.Uuid
  expenseDate  DateTime        @map("expense_date") @db.Date
  category     ExpenseCategory
  amount       BigInt
  description  String          @db.Text
  receiptUrl   String?         @map("receipt_url") @db.VarChar(500)
  createdAt    DateTime        @default(now()) @map("created_at") @db.Timestamptz

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)

  @@index([expenseId])
  @@map("expense_items")
}

model Notification {
  id             String           @id @default(uuid())
  recipientId    String           @map("recipient_id") @db.Uuid
  type           NotificationType
  message        String           @db.Text
  referenceId    String?          @map("reference_id") @db.Uuid
  referenceType  String?          @map("reference_type") @db.VarChar(50)
  isRead         Boolean          @default(false) @map("is_read")
  readAt         DateTime?        @map("read_at") @db.Timestamptz
  createdAt      DateTime         @default(now()) @map("created_at") @db.Timestamptz

  recipient User @relation(fields: [recipientId], references: [id], onDelete: Cascade)

  @@index([recipientId])
  @@index([referenceId])
  @@map("notifications")
}

model AuditLog {
  id             String          @id @default(uuid())
  userId         String          @map("user_id") @db.Uuid
  entityType     AuditEntityType @map("entity_type")
  entityId       String          @map("entity_id") @db.Uuid
  action         String          @db.VarChar(100)
  previousState  String?         @map("previous_state") @db.VarChar(100)
  newState       String?         @map("new_state") @db.VarChar(100)
  metadata       Json            @default("{}")
  ipAddress      String?         @map("ip_address") @db.VarChar(45)
  timestamp      DateTime        @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id])

  @@index([entityId, entityType])
  @@index([userId])
  @@index([timestamp(sort: Desc)])
  @@index([action])
  @@map("audit_logs")
}
```

---

## 7. Self-Check: Normalization, Race Condition, Business Logic Protection

### 7.1 Kiểm tra Chuẩn hóa (Normalization)

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| **1NF** — Không có multi-value trong 1 cột | ✅ Pass | `violations` dùng JSONB là array — đây là snapshot, không phải quan hệ cần normalize |
| **2NF** — Không có partial dependency | ✅ Pass | Tất cả non-key attributes phụ thuộc hoàn toàn vào PK |
| **3NF** — Không có transitive dependency | ✅ Pass | `trip_days` là generated column (tính từ dates, không lưu dữ liệu thừa). `total_actual` trong `expenses` là denormalization có chủ đích (xem bên dưới) |
| **Intentional denormalization** | ⚠️ Ghi nhận | `expenses.total_actual` = SUM(expense_items.amount). Chấp nhận để: (1) tránh tính lại mỗi lần query, (2) lock giá trị khi submitted. Service đồng bộ sau mỗi INSERT/UPDATE/DELETE vào expense_items khi status=DRAFT |
| **Snapshot fields** | ✅ Design decision | `approval_records.budget_snapshot`, `expenses.estimated_budget_snapshot` — chủ đích lưu lịch sử, không phải dư thừa. Đảm bảo audit trail chính xác dù trip bị chỉnh sửa |
| **Không có bảng Junction thừa** | ✅ Pass | Tất cả quan hệ đều có semantic rõ ràng |

### 7.2 Xử lý Race Condition

| Tình huống | Cơ chế bảo vệ | Tầng |
|---|---|---|
| **Double-approve: 2 Manager bấm Approve cùng lúc** | `UNIQUE INDEX uix_approval_one_per_level_approved ON approval_records(trip_id, approval_level) WHERE action='APPROVED'` — người thứ 2 sẽ nhận unique violation | DB constraint |
| **State transition đồng thời** | Service dùng `SELECT ... FOR UPDATE` trên `trips` trước mỗi transition — chỉ 1 transaction thực hiện được | Service + DB lock |
| **Cập nhật total_actual đồng thời** | `SELECT ... FOR UPDATE` trên `expenses` trước khi tính và update `total_actual` | Service + DB lock |
| **Refresh token rotation** | `UNIQUE(token_hash)` — đảm bảo token không bị duplicate | DB constraint |
| **Concurrent expense item modification** | Service kiểm tra `expense.status = 'DRAFT'` trong transaction; nếu đã SUBMITTED thì block | Service layer |

**Pattern chuẩn cho state transition (TypeScript/Prisma):**
```typescript
// Trong TripService — pattern SELECT FOR UPDATE
async submitTrip(tripId: string, userId: string): Promise<Trip> {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock row trước — chặn concurrent write
    const trip = await tx.$queryRaw<Trip[]>`
      SELECT * FROM trips
      WHERE id = ${tripId}::uuid
      FOR UPDATE
    `;

    if (!trip[0]) throw new NotFoundError('Trip not found');
    if (trip[0].status !== 'DRAFT') {
      throw new InvalidStateError(`Cannot submit trip in status: ${trip[0].status}`);
    }
    if (trip[0].employee_id !== userId) {
      throw new ForbiddenError('Not the trip owner');
    }

    // 2. Chạy policy check
    const policyResult = await policyCheckEngine.run(trip[0]);

    // 3. Upsert policy_check_results
    await tx.policyCheckResult.upsert({
      where: { tripId },
      create: { tripId, ...policyResult },
      update: { ...policyResult, checkedAt: new Date() }
    });

    // 4. Update trip status
    const updated = await tx.trip.update({
      where: { id: tripId },
      data: {
        status: 'SUBMITTED',
        requiresLevel2: policyResult.requiresLevel2Approval,
        submittedAt: new Date()
      }
    });

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        userId,
        entityType: 'TRIP',
        entityId: tripId,
        action: 'TRIP_SUBMITTED',
        previousState: 'DRAFT',
        newState: 'SUBMITTED',
        metadata: { policyViolationCount: policyResult.violationCount }
      }
    });

    return updated;
  });
}
```

### 7.3 Business Logic Protection Matrix

Bảng kiểm tra mỗi Business Rule được bảo vệ ở đâu:

| BR | Tên Rule | DB Constraint | Service Layer | Cả hai |
|---|---|---|---|---|
| **BR-TR-01** | Hotel limit theo job_grade | ❌ (phụ thuộc cross-table join) | ✅ PolicyCheckEngine so sánh `hotel_cost_per_night` với `HOTEL_LIMIT[user.job_grade]` | Service |
| **BR-TR-02** | Per Diem cap | ❌ (cần trip_days + destination_type) | ✅ PolicyCheckEngine tính `max = trip_days * RATE[destination_type]` | Service |
| **BR-TR-03** | Advance notice 3 ngày | ✅ `CHECK (NOT is_urgent OR urgency_reason IS NOT NULL)` | ✅ Service tính working days diff, set `is_urgent` | Cả hai |
| **BR-TR-04** | 2-level approval routing | ✅ `UNIQUE INDEX` chặn double-approve | ✅ ApprovalRouter quyết định LEVEL_1 vs LEVEL_2 | Cả hai |
| **BR-TR-05** | Variance tolerance 10% | ✅ `chk_expenses_reapproval_consistent` | ✅ ExpenseService tính variance, block Finance close nếu >10% chưa reapprove | Cả hai |
| **BR-TR-06** | Closed trip immutability | ✅ Trigger `trg_audit_logs_immutable` (audit); immutableGuard qua middleware | ✅ `immutableGuard` middleware chặn tất cả write khi status=CLOSED | Cả hai |
| **BR-TR-07** | AI budget guardrail | ❌ (AI output — không thể enforce ở DB) | ✅ AIService validate `totalEstimatedCost ≤ budget` trước khi trả về | Service |

### 7.4 Dữ liệu Snapshot vs Dữ liệu Hiện tại

| Trường snapshot | Bảng | Lý do cần snapshot |
|---|---|---|
| `approval_records.budget_snapshot` | approval_records | Ngân sách có thể thay đổi sau khi duyệt; cần biết ngân sách lúc duyệt là bao nhiêu để audit |
| `approval_records.had_violations_snapshot` | approval_records | Violations có thể thay đổi nếu policy config thay đổi; cần biết lúc duyệt có vi phạm không |
| `expenses.estimated_budget_snapshot` | expenses | Trip budget có thể thay đổi sau khi expense claim được tạo; variance phải tính so với budget đã duyệt |
| `policy_check_results.violations` | policy_check_results | Toàn bộ record này là snapshot kết quả tại thời điểm submit — không update, chỉ replace |

### 7.5 Kết luận Self-Check

| Tiêu chí | Trạng thái | Ghi chú |
|---|---|---|
| Chuẩn hóa (3NF) | ✅ Đạt | Có 2 intentional denorm có ghi nhận |
| Race condition handling | ✅ Đầy đủ | SELECT FOR UPDATE + UNIQUE constraint phủ toàn bộ critical path |
| Snapshot data | ✅ Đầy đủ | 4 snapshot fields được ghi lại rõ lý do |
| Business logic tại DB | ✅ Tốt | 7 BR được kiểm tra — 5/7 có ít nhất 1 lớp DB constraint; 2/7 chỉ ở service layer (lý do: phụ thuộc cross-table logic) |
| Immutability | ✅ Đa lớp | Middleware (service) + Trigger (DB) cho audit_logs; Middleware cho trips CLOSED |
| Tiền tệ | ✅ BIGINT | Không có floating-point risk |
| Audit trail | ✅ Bất biến | Trigger DB ngăn UPDATE/DELETE, INSERT-only |
| FK constraints | ✅ Đầy đủ | Tất cả quan hệ có FK; ON DELETE CASCADE cho các bảng con |

---

*Tài liệu này là nguồn tham chiếu chuẩn cho tất cả query và migration. Mọi thay đổi schema phải tạo Prisma migration và ghi vào `decision-log.md`.*
