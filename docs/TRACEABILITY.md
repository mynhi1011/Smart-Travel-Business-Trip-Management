# Requirements Traceability Matrix (RTM)

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 — MIS3032_1
**Phiên bản:** v1.0
**Ngày tạo:** 2026-08-28
**Tác giả:** Nhóm 11 (tổng hợp)
**Tài liệu nguồn:** `02-vault/02-requirements/requirements.md`, `02-vault/03-domain/business-rules.md`, `03-product/user-stories.md`, `05-technical/API.md`, `05-technical/data-model.md`, `05-technical/story-specs/`

---

## Mục lục

1. [Tổng quan & Mục đích](#1-tổng-quan--mục-đích)
2. [Ma trận chính: REQ → US → BR → API → DB → Spec → Test](#2-ma-trận-chính-req--us--br--api--db--spec--test)
3. [Ma trận ngược: US → REQ (Backward Traceability)](#3-ma-trận-ngược-us--req-backward-traceability)
4. [Business Rules Coverage](#4-business-rules-coverage)
5. [API Endpoint Traceability](#5-api-endpoint-traceability)
6. [DB Table Traceability](#6-db-table-traceability)
7. [NFR Traceability](#7-nfr-traceability)
8. [Coverage Summary & Orphan Check](#8-coverage-summary--orphan-check)

---

## 1. Tổng quan & Mục đích

Ma trận này đảm bảo **không có requirement nào bị bỏ sót** (No Orphan Requirements) và **mọi artifact kỹ thuật đều có thể truy ngược** về yêu cầu nghiệp vụ gốc.

### Chuỗi truy vết

```
Business Goal
    │
    ▼
Functional Requirement (REQ-TR-*)
    │
    ├──► User Story (US-*)
    │         │
    │         ├──► Business Rule (BR-TR-*)
    │         ├──► API Endpoint
    │         ├──► DB Table / Column
    │         ├──► Story Spec (05-technical/story-specs/US-*.md)
    │         └──► Test Cases (T*.*)
    │
    └──► Non-Functional Requirement (NFR-TR-*)
              │
              └──► Architecture Decision (ADR-*)
```

### Ký hiệu

| Ký hiệu | Nghĩa |
|---|---|
| ✅ | Đã covered đầy đủ |
| ⚠️ | Covered một phần / cần chú ý |
| ❌ | Chưa covered / Orphan |
| `[BR-TR-01]` | Business Rule |
| `[REQ-TR-01]` | Functional Requirement |
| `[NFR-TR-01]` | Non-Functional Requirement |
| `[US-01]` | User Story |
| `[ADR-01]` | Architecture Decision Record |

---

## 2. Ma trận chính: REQ → US → BR → API → DB → Spec → Test

### REQ-TR-01 — Tạo Trip Request

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Employee tạo Trip Request: điểm đi/đến, ngày, mục đích, dự toán |
| **Priority** | Must |
| **User Stories** | [US-01] Khởi tạo Trip Request cơ bản |
| **Business Rules** | [BR-TR-02] Per Diem, [BR-TR-03] Advance Notice |
| **API Endpoints** | `POST /api/v1/trips`, `GET /api/v1/trips`, `GET /api/v1/trips/:id`, `PATCH /api/v1/trips/:id`, `DELETE /api/v1/trips/:id` |
| **DB Tables** | `trips` (INSERT), `audit_logs` (INSERT) |
| **Story Spec** | `05-technical/story-specs/US-01-create-trip-request.md` |
| **Test Cases** | T1.1–T1.13 |
| **Acceptance Criteria** | AC 1.1, AC 1.2, AC 1.3 |
| **Status** | ✅ Covered |

---

### REQ-TR-02 — AI Itinerary Generation

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | AI sinh bản nháp lịch trình theo điểm đến, số ngày, ngân sách |
| **Priority** | Must |
| **User Stories** | [US-02] AI sinh gợi ý lịch trình |
| **Business Rules** | [BR-TR-07] AI Grounding Rule (guardrail server-side) |
| **API Endpoints** | `POST /api/v1/ai/generate-itinerary` |
| **DB Tables** | `itinerary_items` (INSERT batch, `is_ai_generated=true`), `audit_logs` (INSERT `AI_ITINERARY_APPLIED`) |
| **Story Spec** | `05-technical/story-specs/US-02-ai-itinerary.md` |
| **Test Cases** | T2.1–T2.13 |
| **Acceptance Criteria** | AC 2.1, AC 2.2 |
| **External Dependency** | Google Gemini API (ADR-06) |
| **Status** | ✅ Covered |

---

### REQ-TR-03 — Policy Check Engine

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Tự động kiểm tra vi phạm chính sách trước submit, hiển thị cảnh báo |
| **Priority** | Must |
| **User Stories** | [US-04] Policy Check tự động |
| **Business Rules** | [BR-TR-01] Hotel Limit, [BR-TR-02] Per Diem, [BR-TR-03] Advance Notice, [BR-TR-04] Approval Matrix |
| **API Endpoints** | `POST /api/v1/trips/:id/submit` (trigger PolicyCheckEngine) |
| **DB Tables** | `policy_check_results` (INSERT snapshot), `trips` (UPDATE `requires_level2`, `is_urgent`), `audit_logs` |
| **Story Spec** | `05-technical/story-specs/US-04-policy-check.md` |
| **Test Cases** | T4.1–T4.12 |
| **Acceptance Criteria** | AC 4.1, AC 4.2 |
| **Status** | ✅ Covered |

---

### REQ-TR-04 — Manager Phê duyệt Cấp 1

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Manager phê duyệt hoặc từ chối Trip Request (Cấp 1) |
| **Priority** | Must |
| **User Stories** | [US-05] Manager Approve L1 |
| **Business Rules** | [BR-TR-04] Approval Matrix (20M threshold) |
| **API Endpoints** | `POST /api/v1/trips/:id/approve`, `POST /api/v1/trips/:id/reject` |
| **DB Tables** | `trips` (UPDATE status), `approval_records` (INSERT LEVEL_1 + snapshot), `notifications`, `audit_logs` |
| **Story Spec** | `05-technical/story-specs/US-05-manager-approve-l1.md` |
| **Test Cases** | T5.1–T5.15 |
| **Acceptance Criteria** | AC 5.1, AC 5.2, AC 5.3 |
| **Status** | ✅ Covered |

---

### REQ-TR-05 — Định tuyến Phê duyệt Cấp 2

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Tự động chuyển sang Travel Admin nếu budget > 20M hoặc vi phạm policy |
| **Priority** | Must |
| **User Stories** | [US-06] Travel Admin Approve L2 |
| **Business Rules** | [BR-TR-04] Approval Matrix |
| **API Endpoints** | `POST /api/v1/trips/:id/approve` (TRAVEL_ADMIN role, PENDING_ADMIN_APPROVAL state), `POST /api/v1/trips/:id/reject` |
| **DB Tables** | `trips` (UPDATE status), `approval_records` (INSERT LEVEL_2), `notifications`, `audit_logs` |
| **Story Spec** | `05-technical/story-specs/US-06-travel-admin-approve-l2.md` |
| **Test Cases** | T6.1–T6.10 |
| **Acceptance Criteria** | AC 6.1, AC 6.2 |
| **Status** | ✅ Covered |

---

### REQ-TR-06 — Itinerary Builder

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Employee xem, thêm, sửa, xóa mốc hoạt động trong lịch trình |
| **Priority** | Must |
| **User Stories** | [US-03] Itinerary Builder |
| **Business Rules** | [BR-TR-01] Hotel Limit (warning), [BR-TR-06] Closed Trip Immutability |
| **API Endpoints** | `GET /api/v1/trips/:id/itinerary`, `POST /api/v1/trips/:id/itinerary`, `PATCH /api/v1/trips/:id/itinerary/:itemId`, `DELETE /api/v1/trips/:id/itinerary/:itemId` |
| **DB Tables** | `itinerary_items` (CRUD), `audit_logs` |
| **Story Spec** | `05-technical/story-specs/US-03-itinerary-builder.md` |
| **Test Cases** | T3.1–T3.14 |
| **Acceptance Criteria** | AC 3.1, AC 3.2 |
| **Status** | ✅ Covered |

---

### REQ-TR-07 — Expense Claim Creation

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Employee tạo và quản lý Expense Claim sau chuyến đi |
| **Priority** | Must |
| **User Stories** | [US-07] Lập Expense Claim |
| **Business Rules** | [BR-TR-05] Variance Tolerance, [BR-TR-06] Immutability |
| **API Endpoints** | `POST /api/v1/trips/:id/expense`, `GET /api/v1/trips/:id/expense`, `PATCH /api/v1/trips/:id/expense`, `POST /api/v1/trips/:id/expense/items`, `PATCH /api/v1/trips/:id/expense/items/:itemId`, `DELETE /api/v1/trips/:id/expense/items/:itemId` |
| **DB Tables** | `expenses` (INSERT/UPDATE), `expense_items` (CRUD), `audit_logs` |
| **Story Spec** | `05-technical/story-specs/US-07-expense-claim.md` |
| **Test Cases** | T7.1–T7.15 |
| **Acceptance Criteria** | AC 7.1, AC 7.2, AC 7.3 |
| **Status** | ✅ Covered |

---

### REQ-TR-08 — Expense Variance Calculation

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Tự động tính variance giữa dự toán và thực tế |
| **Priority** | Must |
| **User Stories** | [US-07] (AC 7.2, AC 7.3) |
| **Business Rules** | [BR-TR-05] Variance Tolerance (0–10% cần giải trình, >10% cần Manager reapprove) |
| **API Endpoints** | `POST /api/v1/trips/:id/expense/submit` (server tính variance) |
| **DB Tables** | `expenses.variance_pct`, `expenses.variance_amount`, `expenses.total_actual` (server-computed), `expenses.manager_reapproval_required` |
| **Story Spec** | `05-technical/story-specs/US-07-expense-claim.md` |
| **Test Cases** | T7.3, T7.4, T7.5, T7.6 |
| **Acceptance Criteria** | AC 7.2, AC 7.3 |
| **Ghi chú** | `variance_pct` là server-computed field — client không được gửi |
| **Status** | ✅ Covered |

---

### REQ-TR-09 — Finance Duyệt & Close Trip

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Finance duyệt expense, yêu cầu giải trình nếu > 10%, đóng hồ sơ |
| **Priority** | Must |
| **User Stories** | [US-08] Finance Close Trip |
| **Business Rules** | [BR-TR-05] Variance Tolerance, [BR-TR-06] Closed Trip Immutability |
| **API Endpoints** | `POST /api/v1/trips/:id/expense/approve`, `POST /api/v1/trips/:id/expense/reject`, `POST /api/v1/trips/:id/expense/reapprove`, `POST /api/v1/trips/:id/close` |
| **DB Tables** | `expenses` (UPDATE status), `trips` (UPDATE `status=CLOSED`, `closed_at`), `audit_logs`, `notifications` |
| **Story Spec** | `05-technical/story-specs/US-08-finance-close.md` |
| **Test Cases** | T8.1–T8.14 |
| **Acceptance Criteria** | AC 8.1, AC 8.2, AC 8.3 |
| **Status** | ✅ Covered |

---

### REQ-TR-10 — Role-based Dashboard

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Dashboard hiển thị đúng dữ liệu theo role |
| **Priority** | Must |
| **User Stories** | [US-09] Dashboard |
| **Business Rules** | [BR-TR-06] CLOSED = read-only |
| **API Endpoints** | `GET /api/v1/dashboard` |
| **DB Tables** | `trips` (READ, filtered by role), `expenses` (READ), `notifications` (READ unreadCount) |
| **Story Spec** | `05-technical/story-specs/US-09-dashboard.md` |
| **Test Cases** | T9.1–T9.10 |
| **Acceptance Criteria** | AC 9.1, AC 9.2 |
| **Status** | ✅ Covered |

---

### REQ-TR-11 — In-app Notification

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Thông báo in-app khi trạng thái thay đổi |
| **Priority** | Should |
| **User Stories** | [US-10] Notification & PDF |
| **Business Rules** | — |
| **API Endpoints** | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`, `GET /api/v1/notifications/stream` (SSE) |
| **DB Tables** | `notifications` (INSERT bởi NotificationService, UPDATE is_read) |
| **Story Spec** | `05-technical/story-specs/US-10-notification-pdf.md` |
| **Test Cases** | T10.1–T10.8, T10.12–T10.15 |
| **Acceptance Criteria** | AC 10.1 |
| **Architecture** | ADR-07 (SSE thay vì WebSocket) |
| **Status** | ✅ Covered |

---

### REQ-TR-12 — PDF Export

| Thuộc tính | Chi tiết |
|---|---|
| **Mô tả** | Xuất báo cáo chuyến đi dưới dạng PDF |
| **Priority** | Should |
| **User Stories** | [US-10] Notification & PDF |
| **Business Rules** | [BR-TR-06] CLOSED = read-only (vẫn xuất được) |
| **API Endpoints** | `GET /api/v1/trips/:id/export-pdf` |
| **DB Tables** | `trips`, `itinerary_items`, `expenses`, `expense_items`, `approval_records` (READ only) |
| **Story Spec** | `05-technical/story-specs/US-10-notification-pdf.md` |
| **Test Cases** | T10.5–T10.11 |
| **Acceptance Criteria** | AC 10.2 |
| **Tech** | Puppeteer 22 (ADR — PDF export) |
| **Status** | ✅ Covered |

---

## 3. Ma trận ngược: US → REQ (Backward Traceability)

Mỗi User Story phải truy ngược về ít nhất 1 REQ. Bảng kiểm tra không có US "mồ côi":

| User Story | REQ gốc | BR liên quan | Story Spec | Status |
|---|---|---|---|---|
| **US-01** Tạo Trip Request | REQ-TR-01 | BR-TR-02, BR-TR-03 | US-01-create-trip-request.md | ✅ |
| **US-02** AI Itinerary | REQ-TR-02 | BR-TR-07 | US-02-ai-itinerary.md | ✅ |
| **US-03** Itinerary Builder | REQ-TR-06 | BR-TR-01, BR-TR-06 | US-03-itinerary-builder.md | ✅ |
| **US-04** Policy Check | REQ-TR-03 | BR-TR-01, BR-TR-02, BR-TR-03, BR-TR-04 | US-04-policy-check.md | ✅ |
| **US-05** Manager Approve L1 | REQ-TR-04 | BR-TR-04 | US-05-manager-approve-l1.md | ✅ |
| **US-06** Travel Admin L2 | REQ-TR-05 | BR-TR-04 | US-06-travel-admin-approve-l2.md | ✅ |
| **US-07** Expense Claim | REQ-TR-07, REQ-TR-08 | BR-TR-05 | US-07-expense-claim.md | ✅ |
| **US-08** Finance Close | REQ-TR-09 | BR-TR-05, BR-TR-06 | US-08-finance-close.md | ✅ |
| **US-09** Dashboard | REQ-TR-10 | BR-TR-06 | US-09-dashboard.md | ✅ |
| **US-10** Notification + PDF | REQ-TR-11, REQ-TR-12 | BR-TR-06 | US-10-notification-pdf.md | ✅ |

**Kết quả:** 10/10 User Stories truy ngược được về REQ. **Không có US mồ côi.**

---

## 4. Business Rules Coverage

Mỗi BR phải được bảo vệ tại ít nhất 1 tầng (DB constraint, Service layer, hoặc cả hai).

| BR ID | Tên Rule | User Stories | API Endpoint | DB Layer | Service Layer | Story Spec Test |
|---|---|---|---|---|---|---|
| **BR-TR-01** | Hotel Limit theo job_grade | US-03, US-04 | `POST /trips/:id/itinerary`, `POST /trips/:id/submit` | ❌ (cross-table) | ✅ PolicyCheckEngine | T3.5, T4.2 |
| **BR-TR-02** | Per Diem Allowance | US-01, US-04 | `POST /trips/:id/submit` | ❌ | ✅ PolicyCheckEngine | T1.3, T4.3 |
| **BR-TR-03** | Advance Notice 3 ngày | US-01, US-04 | `POST /trips`, `POST /trips/:id/submit` | ✅ `CHECK (NOT is_urgent OR urgency_reason IS NOT NULL)` | ✅ working days calc | T1.4, T4.5 |
| **BR-TR-04** | Approval Matrix 20M | US-05, US-06, US-04 | `POST /trips/:id/approve` | ✅ UNIQUE INDEX approve per level | ✅ ApprovalRouter | T5.1–T5.3, T6.1 |
| **BR-TR-05** | Expense Variance ≤10% | US-07, US-08 | `POST /expense/submit`, `POST /expense/approve` | ✅ `chk_expenses_reapproval_consistent` | ✅ ExpenseService | T7.4–T7.6, T8.3–T8.4 |
| **BR-TR-06** | Closed Trip Immutability | US-08, US-09, US-10 | Tất cả write endpoints | ✅ Trigger `trg_audit_logs_immutable` | ✅ immutableGuard middleware | T8.2, T8.9–T8.10, T3.9 |
| **BR-TR-07** | AI Grounding Rule | US-02 | `POST /ai/generate-itinerary` | ❌ (AI output) | ✅ AIService guardrail (retry ×2) | T2.3 |

**Kết quả:** 7/7 Business Rules covered. **Không có BR mồ côi.**

---

## 5. API Endpoint Traceability

Mỗi endpoint phải truy ngược về ít nhất 1 REQ và 1 US:

| # | Method | Endpoint | REQ | US | BR | Story Spec | Auth |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | — | ALL | — | — | Public |
| 2 | POST | `/auth/refresh` | — | ALL | — | — | Cookie |
| 3 | DELETE | `/auth/logout` | — | ALL | — | — | Bearer |
| 4 | GET | `/auth/me` | — | ALL | — | — | Bearer |
| 5 | GET | `/trips` | REQ-TR-01, REQ-TR-10 | US-01, US-09 | — | US-01 | Bearer/ALL |
| 6 | POST | `/trips` | REQ-TR-01 | US-01 | BR-TR-02, BR-TR-03 | US-01 | EMPLOYEE |
| 7 | GET | `/trips/:id` | REQ-TR-01 | US-01, US-05, US-06 | — | US-01, US-05 | Bearer |
| 8 | PATCH | `/trips/:id` | REQ-TR-01 | US-01 | BR-TR-06 | US-01 | EMPLOYEE owner |
| 9 | DELETE | `/trips/:id` | REQ-TR-01 | US-01 | — | US-01 | EMPLOYEE owner |
| 10 | POST | `/trips/:id/submit` | REQ-TR-03 | US-04 | BR-TR-01,02,03,04 | US-04 | EMPLOYEE owner |
| 11 | POST | `/trips/:id/approve` | REQ-TR-04, REQ-TR-05 | US-05, US-06 | BR-TR-04 | US-05, US-06 | MANAGER / TRAVEL_ADMIN |
| 12 | POST | `/trips/:id/reject` | REQ-TR-04, REQ-TR-05 | US-05, US-06 | BR-TR-04 | US-05, US-06 | MANAGER / TRAVEL_ADMIN |
| 13 | POST | `/trips/:id/close` | REQ-TR-09 | US-08 | BR-TR-05, BR-TR-06 | US-08 | FINANCE |
| 14 | GET | `/trips/:id/itinerary` | REQ-TR-06 | US-03 | — | US-03 | Bearer |
| 15 | POST | `/trips/:id/itinerary` | REQ-TR-06 | US-03 | BR-TR-01, BR-TR-06 | US-03 | EMPLOYEE owner |
| 16 | PATCH | `/trips/:id/itinerary/:itemId` | REQ-TR-06 | US-03 | BR-TR-06 | US-03 | EMPLOYEE owner |
| 17 | DELETE | `/trips/:id/itinerary/:itemId` | REQ-TR-06 | US-03 | BR-TR-06 | US-03 | EMPLOYEE owner |
| 18 | GET | `/trips/:id/expense` | REQ-TR-07, REQ-TR-08 | US-07, US-08 | BR-TR-05 | US-07 | Owner/FINANCE |
| 19 | POST | `/trips/:id/expense` | REQ-TR-07 | US-07 | — | US-07 | EMPLOYEE owner |
| 20 | PATCH | `/trips/:id/expense` | REQ-TR-07 | US-07 | BR-TR-05 | US-07 | EMPLOYEE owner |
| 21 | POST | `/trips/:id/expense/submit` | REQ-TR-07, REQ-TR-08 | US-07 | BR-TR-05 | US-07 | EMPLOYEE owner |
| 22 | POST | `/trips/:id/expense/approve` | REQ-TR-09 | US-08 | BR-TR-05 | US-08 | FINANCE |
| 23 | POST | `/trips/:id/expense/reject` | REQ-TR-09 | US-08 | — | US-08 | FINANCE |
| 24 | POST | `/trips/:id/expense/reapprove` | REQ-TR-09 | US-08 | BR-TR-05 | US-08 | MANAGER |
| 25 | POST | `/trips/:id/expense/items` | REQ-TR-07 | US-07 | BR-TR-06 | US-07 | EMPLOYEE owner |
| 26 | PATCH | `/trips/:id/expense/items/:itemId` | REQ-TR-07 | US-07 | BR-TR-06 | US-07 | EMPLOYEE owner |
| 27 | DELETE | `/trips/:id/expense/items/:itemId` | REQ-TR-07 | US-07 | BR-TR-06 | US-07 | EMPLOYEE owner |
| 28 | POST | `/ai/generate-itinerary` | REQ-TR-02 | US-02 | BR-TR-07 | US-02 | EMPLOYEE |
| 29 | GET | `/notifications` | REQ-TR-11 | US-10 | — | US-10 | Bearer/ALL |
| 30 | PATCH | `/notifications/:id/read` | REQ-TR-11 | US-10 | — | US-10 | Bearer/ALL |
| 31 | PATCH | `/notifications/read-all` | REQ-TR-11 | US-10 | — | US-10 | Bearer/ALL |
| 32 | GET | `/notifications/stream` | REQ-TR-11 | US-10 | — | US-10 | Token query |
| 33 | GET | `/dashboard` | REQ-TR-10 | US-09 | BR-TR-06 | US-09 | Bearer/ALL |
| 34 | GET | `/trips/:id/export-pdf` | REQ-TR-12 | US-10 | BR-TR-06 | US-10 | Owner/FINANCE |
| 35 | GET | `/health` | — | — | — | — | Public |

**Kết quả:** 35/35 endpoints có REQ hoặc lý do kỹ thuật. **Không có endpoint mồ côi.**

---

## 6. DB Table Traceability

| Bảng DB | REQ | US | BR | Ghi chú |
|---|---|---|---|---|
| `users` | — | ALL | BR-TR-01 (job_grade) | Foundation table |
| `refresh_tokens` | — | ALL | — | Auth (ADR-05) |
| `trips` | REQ-TR-01, 03, 04, 05, 09, 10 | US-01, 04, 05, 06, 08, 09 | BR-TR-03, 04, 06 | Central entity, 13 statuses |
| `policy_check_results` | REQ-TR-03 | US-04 | BR-TR-01, 02, 03, 04 | Snapshot bất biến |
| `itinerary_items` | REQ-TR-06, 02 | US-02, 03 | BR-TR-01, 06 | `is_ai_generated` flag |
| `approval_records` | REQ-TR-04, 05, 09 | US-05, 06, 08 | BR-TR-04 | Snapshot budget/violations |
| `expenses` | REQ-TR-07, 08, 09 | US-07, 08 | BR-TR-05, 06 | Server-computed variance |
| `expense_items` | REQ-TR-07 | US-07 | BR-TR-06 | Cascade delete từ expenses |
| `notifications` | REQ-TR-11 | US-10 | — | SSE emit (ADR-07) |
| `audit_logs` | NFR-TR-04 | ALL | BR-TR-06 | INSERT-only, immutable trigger |

---

## 7. NFR Traceability

| NFR ID | Yêu cầu | US liên quan | Cơ chế đáp ứng | ADR | Test |
|---|---|---|---|---|---|
| **NFR-TR-01** | Response ≤ 1.0s (CRUD APIs) | ALL | Index DB, Prisma query optimization | — | T1.12, T5.15, T9.9 |
| **NFR-TR-02** | AI latency ≤ 5.0s, Skeleton loading | US-02 | Gemini timeout 8s server-side; React Skeleton | ADR-06 | T2.4, T2.12 |
| **NFR-TR-03** | RBAC strict, HTTP 403 | ALL | `authGuard` + `roleGuard` middleware | ADR-05 | T1.9, T4.8, T5.9, T8.8 |
| **NFR-TR-04** | Audit logging: user_id, timestamp, action, prev/new state | ALL | `AuditLogger` service, bảng `audit_logs` (INSERT-only) | — | T1.11, T4.10, T5.10, T7.14 |
| **NFR-TR-05** | Atomic transaction, chống race condition | US-05, US-06, US-08 | `prisma.$transaction`, `SELECT FOR UPDATE`, UNIQUE INDEX | ADR-04 | T5.8, T6.10, T8.11 |
| **NFR-TR-06** | Desktop web ≥ 1280×720, accessibility | ALL | Ant Design v5, responsive grid | ADR-02 | Manual usability test |

---

## 8. Coverage Summary & Orphan Check

### 8.1 Functional Requirements Coverage

| Metric | Giá trị |
|---|---|
| Tổng FR | 12 (REQ-TR-01 → REQ-TR-12) |
| FR đã covered | **12/12** |
| FR mồ côi (không có US) | **0** |
| Coverage | **100%** ✅ |

### 8.2 User Stories Coverage

| Metric | Giá trị |
|---|---|
| Tổng US | 10 (US-01 → US-10) |
| US có Story Spec | **10/10** |
| US có Test Cases | **10/10** |
| US mồ côi (không có REQ) | **0** |
| Coverage | **100%** ✅ |

### 8.3 Business Rules Coverage

| Metric | Giá trị |
|---|---|
| Tổng BR | 7 (BR-TR-01 → BR-TR-07) |
| BR được enforce ≥ 1 tầng | **7/7** |
| BR được test | **7/7** |
| BR mồ côi | **0** |
| Coverage | **100%** ✅ |

### 8.4 API Endpoints Coverage

| Metric | Giá trị |
|---|---|
| Tổng endpoints | 35 |
| Endpoints có REQ/US | **33/35** (2 = auth infra + health) |
| Endpoints không có test | **0** |
| Coverage | **✅** |

### 8.5 Test Cases Summary

| Story | Test Cases | AC Covered |
|---|---|---|
| US-01 | T1.1 – T1.13 (13 cases) | AC 1.1, 1.2, 1.3 ✅ |
| US-02 | T2.1 – T2.13 (13 cases) | AC 2.1, 2.2 ✅ |
| US-03 | T3.1 – T3.14 (14 cases) | AC 3.1, 3.2 ✅ |
| US-04 | T4.1 – T4.12 (12 cases) | AC 4.1, 4.2 ✅ |
| US-05 | T5.1 – T5.15 (15 cases) | AC 5.1, 5.2, 5.3 ✅ |
| US-06 | T6.1 – T6.10 (10 cases) | AC 6.1, 6.2 ✅ |
| US-07 | T7.1 – T7.15 (15 cases) | AC 7.1, 7.2, 7.3 ✅ |
| US-08 | T8.1 – T8.14 (14 cases) | AC 8.1, 8.2, 8.3 ✅ |
| US-09 | T9.1 – T9.10 (10 cases) | AC 9.1, 9.2 ✅ |
| US-10 | T10.1 – T10.15 (15 cases) | AC 10.1, 10.2 ✅ |
| **TOTAL** | **131 test cases** | **20/20 AC** ✅ |

### 8.6 Kết luận Orphan Check

```
✅ Không có Orphan Requirement   — 12/12 REQ có US
✅ Không có Orphan User Story    — 10/10 US có REQ
✅ Không có Orphan Business Rule — 7/7 BR có enforcement
✅ Không có Orphan API Endpoint  — 35/35 endpoints có lý do
✅ Không có Orphan DB Table      — 10/10 bảng có REQ/US
✅ 131 test cases phủ toàn bộ 20 AC
```

---

*Tài liệu này được cập nhật khi có thay đổi requirements hoặc thêm Story Spec mới. Phiên bản tiếp theo: v1.1 sau Implementation Phase.*
