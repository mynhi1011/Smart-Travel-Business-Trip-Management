# Chiến Lược Kiểm Thử — Smart Travel Business Trip Management

**Phiên bản:** 1.0.0
**Ngày cập nhật:** 2026-09-18
**Tác giả:** QA Lead / Backend Architect
**Trạng thái:** Approved

---

## Mục lục

1. [Mục tiêu kiểm thử](#1-mục-tiêu-kiểm-thử)
2. [Phạm vi kiểm thử](#2-phạm-vi-kiểm-thử)
3. [Kim tự tháp kiểm thử (Test Pyramid)](#3-kim-tự-tháp-kiểm-thử-test-pyramid)
4. [Stack công nghệ kiểm thử](#4-stack-công-nghệ-kiểm-thử)
5. [Cấu trúc thư mục test](#5-cấu-trúc-thư-mục-test)
6. [Quy ước đặt tên file test](#6-quy-ước-đặt-tên-file-test)
7. [Ma trận test case](#7-ma-trận-test-case)
8. [Chiến lược Mock / Stub](#8-chiến-lược-mock--stub)
9. [Quy tắc Failure Path](#9-quy-tắc-failure-path)
10. [Coverage Target](#10-coverage-target)
11. [CI/CD Integration](#11-cicd-integration)
12. [Checklist PASS Rubric](#12-checklist-pass-rubric)

---

## 1. Mục tiêu kiểm thử

Chiến lược này đảm bảo hệ thống Smart Travel đáp ứng các tiêu chí chất lượng sau:

| Tiêu chí | Mô tả |
|---|---|
| **Đúng đắn chức năng** | Mọi business rule (BR-TR-*) hoạt động chính xác theo spec |
| **Bảo mật & phân quyền** | Không có route bị bypass Auth hoặc RBAC |
| **Validation dữ liệu** | Toàn bộ input được validate — trả về lỗi rõ ràng, không crash |
| **Resilience** | Hệ thống xử lý graceful khi DB lỗi, service bên ngoài timeout |
| **Trải nghiệm người dùng** | FE component render đúng, feedback lỗi hiển thị đúng chỗ |

Kiểm thử **KHÔNG** dừng lại ở "status 200 OK". Mỗi test case phải assert ít nhất một trong:
- Cấu trúc response body (field, type, giá trị)
- HTTP status code đúng ngữ nghĩa (201, 400, 401, 403, 409, 422)
- Error code (`error` field) theo đặc tả `API.md §3`
- Side effect: bản ghi DB, notification, audit log

---

## 2. Phạm vi kiểm thử

### 2.1 In Scope

**Backend (Node.js / Express / Prisma)**

| Module | Loại test | Ưu tiên |
|---|---|---|
| `auth.routes` — login, refresh, logout | Integration (API) | P0 |
| `trips.routes` — CRUD + actions | Integration (API) | P0 |
| `expenses.routes` — CRUD + submit/approve | Integration (API) | P0 |
| `itinerary.routes` | Integration (API) | P1 |
| `policy.service` — policy check logic | Unit | P0 |
| `approval.service` — routing approval | Unit | P0 |
| `trip.service` — state machine transitions | Unit | P0 |
| `auth.guard` middleware | Unit | P0 |
| `role.guard` middleware | Unit | P0 |
| `error-handler` middleware | Unit | P1 |
| `validators/trip.validator` (Zod schema) | Unit | P0 |

**Frontend (React / Vite / TypeScript)**

| Module | Loại test | Ưu tiên |
|---|---|---|
| `TripRequestForm` component | Component (RTL) | P0 |
| `PolicyBanner` component | Component (RTL) | P0 |
| `LoginForm` component | Component (RTL) | P0 |
| `StatusBadge` component | Component (RTL) | P1 |
| `services/trips.ts` — API wrapper | Unit (mock fetch) | P1 |

### 2.2 Out of Scope (MVP)

- E2E test Playwright/Cypress (phase 2)
- Performance / Load test (phase 2)
- Mobile browser compatibility
- PDF generation visual regression

---

## 3. Kim tự tháp kiểm thử (Test Pyramid)

```
         ╔══════════════════╗
         ║    E2E Tests      ║  (Phase 2 — Playwright)
         ║   ~10% of tests   ║
         ╚══════════════════╝
       ╔════════════════════════╗
       ║  Integration / API Tests║  ← Supertest, BE in-process
       ║     ~30% of tests       ║  Happy path + Auth + Errors
       ╚════════════════════════╝
    ╔══════════════════════════════════╗
    ║         Unit Tests               ║  ← Vitest, isolated
    ║          ~60% of tests           ║  Validators, Services, Guards
    ╚══════════════════════════════════╝
```

### 3.1 Unit Tests

- Kiểm tra từng hàm / class trong isolation.
- Dependencies (Prisma, JWT, AI SDK) đều được **mock hoàn toàn**.
- Chạy nhanh (< 5ms / test), không cần DB.
- Áp dụng cho: validators, service logic, guard middleware, utility functions.

### 3.2 Integration / API Tests

- Test toàn bộ HTTP request → response cycle thông qua Express app.
- Dùng `supertest` để gửi request in-process (không cần server listen thực).
- Prisma client được **mock** hoặc dùng **test database** (SQLite in-memory).
- Assert: status code, response body, error code, header.
- Áp dụng cho: tất cả API endpoints (CRUD + actions + auth).

### 3.3 Component Tests (Frontend)

- Render component trong môi trường `jsdom`.
- Mock API calls (`services/*.ts`) để test độc lập với backend.
- Assert: DOM output, user interaction (click, type, submit), error message visibility.
- Dùng `@testing-library/react` + `@testing-library/user-event`.

---

## 4. Stack công nghệ kiểm thử

| Layer | Framework | Ghi chú |
|---|---|---|
| BE Unit + Integration | **Vitest** | Thay thế Jest, native ESM, nhanh hơn |
| BE HTTP request | **Supertest** | In-process HTTP test, không cần port |
| FE Component | **Vitest + RTL** | `@testing-library/react` v16 |
| FE DOM | **jsdom** | Vitest environment |
| FE Interaction | **@testing-library/user-event** v14 | Mô phỏng user thực |
| Assertion FE DOM | **@testing-library/jest-dom** | Matchers: `toBeInTheDocument`, `toHaveValue` |
| Mock | **vi.mock() / vi.fn()** | Built-in Vitest mock |
| Coverage | **@vitest/coverage-v8** | V8 native coverage |

---

## 5. Cấu trúc thư mục test

```
Smart-Travel-Business-Trip-Management/
├── src/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── __tests__/                     ← Integration/API tests (Supertest)
│   │   │   │   ├── setup.ts                   ← Global test setup (env, db mock)
│   │   │   │   ├── trips.api.test.ts          ← POST/GET/PATCH /api/v1/trips
│   │   │   │   ├── auth.api.test.ts           ← POST /api/v1/auth/login, refresh
│   │   │   │   └── expenses.api.test.ts       ← Expense CRUD + submit
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.guard.test.ts         ← Unit: authGuard
│   │   │   │   └── role.guard.test.ts         ← Unit: roleGuard
│   │   │   ├── services/
│   │   │   │   ├── trip.service.test.ts       ← Unit: state machine
│   │   │   │   └── policy.service.test.ts     ← Unit: policy check logic
│   │   │   └── utils/
│   │   │       └── validators/
│   │   │           └── trip.validator.test.ts ← Unit: Zod schema
│   │   └── vitest.config.ts
│   │
│   └── frontend/
│       ├── src/
│       │   └── __tests__/
│       │       ├── setup.ts                   ← RTL setup (jest-dom import)
│       │       ├── TripRequestForm.test.tsx   ← Component test
│       │       ├── LoginForm.test.tsx         ← Component test
│       │       └── PolicyBanner.test.tsx      ← Component test
│       └── vitest.config.ts
```

---

## 6. Quy ước đặt tên file test

| Quy ước | Áp dụng | Ví dụ |
|---|---|---|
| `*.test.ts` | Unit test (BE) | `trip.service.test.ts` |
| `*.test.tsx` | Component test (FE) | `TripRequestForm.test.tsx` |
| `*.api.test.ts` | Integration / API test | `trips.api.test.ts` |
| `describe` block | Tên module/endpoint | `describe('POST /api/v1/trips', ...)` |
| `it` block | Mô tả hành vi + expected | `it('should return 201 with trip data on valid input')` |
| Prefix `[HAPPY]` | Happy path | `it('[HAPPY] 201 — tạo trip thành công')` |
| Prefix `[FAIL]` | Failure path | `it('[FAIL] 400 — thiếu destination')` |
| Prefix `[AUTH]` | Authentication/Authorization | `it('[AUTH] 401 — không có Bearer token')` |
| Prefix `[BIZ]` | Business rule | `it('[BIZ] 422 — budget vượt 20M policy')` |

---

## 7. Ma trận test case

### 7.1 `POST /api/v1/trips` — Tạo chuyến đi

| # | Loại | Input | Expected | Mô tả |
|---|---|---|---|---|
| T-01 | HAPPY | Payload hợp lệ, token EMPLOYEE | 201, `data.tripCode` hiện diện | Tạo trip thành công |
| T-02 | FAIL/VALIDATION | Thiếu `destination` | 400, `error: VALIDATION_ERROR` | Required field |
| T-03 | FAIL/VALIDATION | `departureDate` sau `returnDate` | 400, `error: VALIDATION_ERROR` | Date range constraint |
| T-04 | FAIL/VALIDATION | `estimatedBudget < 0` | 400, `error: VALIDATION_ERROR` | Boundary value |
| T-05 | AUTH | Không có Authorization header | 401, `error: UNAUTHORIZED` | Missing token |
| T-06 | AUTH | Token hết hạn | 401, `error: TOKEN_EXPIRED` | Expired JWT |
| T-07 | AUTH | Role MANAGER gọi endpoint EMPLOYEE-only | 403, `error: FORBIDDEN` | RBAC violation |
| T-08 | BIZ | Budget > 20,000,000 VND | 201 + `warnings` array chứa `OVER_20M` | Policy warning |
| T-09 | BIZ | `perDiemBudget` vượt hạn mức | 201 + `warnings` hoặc 422 POLICY_VIOLATION | BR-TR-02 |

### 7.2 `POST /api/v1/trips/:id/submit` — Submit chuyến đi

| # | Loại | Input | Expected | Mô tả |
|---|---|---|---|---|
| S-01 | HAPPY | Trip ở trạng thái DRAFT, token owner | 200, `data.status: SUBMITTED` | Submit thành công |
| S-02 | FAIL/BIZ | Trip ở trạng thái SUBMITTED (không thể re-submit) | 409, `error: INVALID_STATUS_TRANSITION` | State machine violation |
| S-03 | AUTH | Token user khác (không phải owner) | 403, `error: NOT_OWNER` | Ownership check |

### 7.3 `POST /api/v1/trips/:id/approve` — Phê duyệt

| # | Loại | Input | Expected | Mô tả |
|---|---|---|---|---|
| A-01 | HAPPY | Trip SUBMITTED, token MANAGER | 200, `data.status: MANAGER_REVIEWING` | Duyệt cấp 1 |
| A-02 | AUTH | Token EMPLOYEE gọi approve | 403, `error: FORBIDDEN` | RBAC — chỉ MANAGER/TRAVEL_ADMIN |
| A-03 | AUTH | Token không hợp lệ (sai chữ ký) | 401, `error: INVALID_TOKEN` | Tampered token |

### 7.4 `POST /api/v1/auth/login` — Đăng nhập

| # | Loại | Input | Expected | Mô tả |
|---|---|---|---|---|
| L-01 | HAPPY | Email + password đúng | 200, `accessToken` hiện diện | Login thành công |
| L-02 | FAIL | Sai password | 401, `error: INVALID_CREDENTIALS` | Wrong credentials |
| L-03 | FAIL/VALIDATION | Email sai format | 400, `error: VALIDATION_ERROR` | Email validation |
| L-04 | FAIL/VALIDATION | Password trống | 400, `error: VALIDATION_ERROR` | Required field |

### 7.5 Frontend — `TripRequestForm`

| # | Loại | Hành động | Expected | Mô tả |
|---|---|---|---|---|
| F-01 | HAPPY | Submit form hợp lệ | `createTrip` service được gọi với đúng payload | Form submit |
| F-02 | FAIL | Submit form thiếu destination | Hiển thị error message "Vui lòng nhập điểm đến" | Client validation |
| F-03 | FAIL | Ngày đi > ngày về | Hiển thị lỗi date range | Date validation |
| F-04 | FAIL | Budget âm | Input không cho nhập giá trị < 0 | Boundary UI |
| F-05 | RENDER | Render không có props | Component mount không crash | Smoke test |

---

## 8. Chiến lược Mock / Stub

### 8.1 Mock Prisma Client (Backend Unit Tests)

```typescript
// Dùng vi.mock() để intercept toàn bộ Prisma calls
vi.mock('../prisma/client', () => ({
  default: {
    trip: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));
```

**Nguyên tắc:**
- Mỗi test `beforeEach` phải `vi.clearAllMocks()` để tránh state leak.
- Happy path: mock trả về object hợp lệ.
- Failure path: mock throw `new Error(...)` hoặc trả về `null`.

### 8.2 Mock JWT (Backend Unit Tests)

```typescript
// Không tạo JWT thật trong test — mock toàn bộ jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));
```

**Trong Integration Tests:** Tạo JWT thật với `JWT_ACCESS_SECRET` riêng cho test environment (`process.env.JWT_ACCESS_SECRET = 'test-secret-do-not-use-in-prod'`).

### 8.3 Helper: generateTestToken()

```typescript
// src/backend/src/__tests__/setup.ts
import jwt from 'jsonwebtoken';

export function generateTestToken(payload: {
  sub: string;
  role: string;
  name: string;
}): string {
  return jwt.sign(payload, process.env['JWT_ACCESS_SECRET']!, {
    expiresIn: '1h',
  });
}
```

Dùng thống nhất trong tất cả integration tests — không hardcode token string.

### 8.4 Mock API Services (Frontend Component Tests)

```typescript
// Mock toàn bộ module services/trips
vi.mock('../../services/trips', () => ({
  createTrip: vi.fn(),
  listTrips: vi.fn().mockResolvedValue([]),
}));
```

**Nguyên tắc:**
- Mock ở cấp module (`vi.mock`), không patch global `fetch`.
- `vi.mocked(createTrip).mockResolvedValue(...)` cho happy path.
- `vi.mocked(createTrip).mockRejectedValue(new Error(...))` cho failure path.

### 8.5 Test Database Strategy

| Môi trường | Strategy |
|---|---|
| Unit tests | Prisma fully mocked — không cần DB |
| Integration tests (CI) | SQLite in-memory via `DATABASE_URL=file::memory:?cache=shared` |
| Integration tests (local) | PostgreSQL test DB riêng (`smart_travel_test`) |

> **Quan trọng:** Không bao giờ chạy test trên production database. File `.env.test` phải được gitignore.

---

## 9. Quy tắc Failure Path

### 9.1 Validation (400 / 422)

Mỗi required field PHẢI có ít nhất một test case missing/invalid:

```
✅ Thiếu field bắt buộc       → 400 VALIDATION_ERROR
✅ Sai kiểu dữ liệu (string thay vì number) → 400 VALIDATION_ERROR
✅ Giá trị âm cho số tiền     → 400 VALIDATION_ERROR
✅ Date range không hợp lệ   → 400 VALIDATION_ERROR
✅ Policy violation           → 422 POLICY_VIOLATION (business constraint)
```

Response PHẢI chứa `details` field để frontend hiển thị lỗi đúng field:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Dữ liệu đầu vào không hợp lệ.",
  "details": {
    "fieldErrors": { "destination": ["Điểm đến không được để trống"] }
  }
}
```

### 9.2 Authentication (401)

```
✅ Không có Authorization header → 401 UNAUTHORIZED
✅ Header không có "Bearer " prefix → 401 UNAUTHORIZED
✅ Token hết hạn (TokenExpiredError) → 401 TOKEN_EXPIRED
✅ Token sai chữ ký / bị tamper → 401 INVALID_TOKEN
✅ Sai credentials (login) → 401 INVALID_CREDENTIALS
```

### 9.3 Authorization (403)

```
✅ Role không được phép truy cập route → 403 FORBIDDEN
✅ User không phải owner của resource → 403 NOT_OWNER
✅ authGuard pass nhưng roleGuard fail → 403 FORBIDDEN
```

### 9.4 Business Rule (409 / 422)

```
✅ Invalid state transition (CLOSED → SUBMITTED) → 409 INVALID_STATUS_TRANSITION
✅ Sửa trip đã CLOSED → 409 TRIP_IMMUTABLE
✅ Expense variance > threshold → 422 EXPENSE_VARIANCE_EXCEEDED
✅ AI budget guardrail fail → 422 AI_BUDGET_GUARDRAIL_FAILED
```

---

## 10. Coverage Target

| Layer | Statement | Branch | Function | Line |
|---|---|---|---|---|
| BE Services | ≥ 80% | ≥ 75% | ≥ 80% | ≥ 80% |
| BE Middlewares | ≥ 90% | ≥ 85% | ≥ 90% | ≥ 90% |
| BE Validators | ≥ 95% | ≥ 90% | ≥ 95% | ≥ 95% |
| BE Controllers | ≥ 70% | ≥ 65% | ≥ 70% | ≥ 70% |
| FE Components | ≥ 70% | ≥ 60% | ≥ 70% | ≥ 70% |

Coverage report được generate tại:
- `src/backend/coverage/` — xem `index.html`
- `src/frontend/coverage/` — xem `index.html`

---

## 11. CI/CD Integration

```yaml
# .github/workflows/test.yml (tham khảo)
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    
    - name: Install BE deps
      run: npm ci
      working-directory: src/backend
    
    - name: Run BE tests
      run: npm run test:run
      working-directory: src/backend
      env:
        NODE_ENV: test
        JWT_ACCESS_SECRET: ci-test-secret-not-for-prod
        DATABASE_URL: file::memory:?cache=shared
    
    - name: Install FE deps
      run: npm ci
      working-directory: src/frontend
    
    - name: Run FE tests
      run: npm run test:run
      working-directory: src/frontend
```

**Gate điều kiện merge PR:**
- Tất cả tests PASS
- Coverage không giảm dưới ngưỡng đã định
- Không có test nào bị skip (`.skip`) mà không có comment giải thích

---

## 12. Checklist PASS Rubric

Trước khi đánh dấu task "Done", Dev phải tự kiểm tra toàn bộ checklist sau:

### Setup & Infrastructure

- [ ] `vitest.config.ts` tồn tại trong cả `src/backend/` và `src/frontend/`
- [ ] `src/frontend/src/__tests__/setup.ts` import `@testing-library/jest-dom`
- [ ] Scripts `test:run`, `test:coverage`, `test:be`, `test:fe` chạy được

### Backend Test Quality

- [ ] Có ít nhất 1 test case **201/200 happy path** với assert body
- [ ] Có ít nhất 1 test case **400 validation** với assert `error: VALIDATION_ERROR`
- [ ] Có ít nhất 1 test case **401 unauthorized** (missing token)
- [ ] Có ít nhất 1 test case **401 token expired**
- [ ] Có ít nhất 1 test case **403 forbidden** (sai role)
- [ ] Có ít nhất 1 test case **business rule violation** (409 hoặc 422)
- [ ] Không có test nào chỉ assert `expect(res.status).toBe(200)` duy nhất
- [ ] Mock Prisma không để leak state giữa các test (dùng `beforeEach` clear)

### Frontend Test Quality

- [ ] Component render smoke test PASS
- [ ] Submit form với dữ liệu hợp lệ → gọi đúng service function
- [ ] Submit form thiếu required field → error message hiển thị trong DOM
- [ ] Không dùng `getByTestId` quá mức — ưu tiên `getByRole`, `getByLabelText`

### Documentation

- [ ] `test-strategy.md` có đủ 12 mục
- [ ] Ma trận test case bao phủ cả happy + failure path
- [ ] Mock strategy được ghi rõ theo từng layer
