# Story Spec

## Story ID
`US-02`

## Requirement IDs
`REQ-TR-02`, `NFR-TR-02` (AI latency ≤ 5s), `NFR-TR-04` (audit log)

## Design link
Figma: _[Prototype URL]_ → Screen: **AI Itinerary Panel** (overlay/panel trên Itinerary Builder)

## Goal
Cho phép Employee yêu cầu AI sinh bản nháp lịch trình chi tiết theo ngày trong phạm vi ngân sách đã nhập. Server-side guardrail đảm bảo AI không vượt budget (BR-TR-07). Kết quả trả về trong ≤ 5 giây.

---

## Preconditions
- Employee đã đăng nhập (role = `EMPLOYEE`).
- Trip Request đã tồn tại (có `tripId` hợp lệ thuộc về user).
- Trip có `destination`, `tripDays` (≥ 1), `estimatedBudget` (> 0).
- Trip chưa ở trạng thái `CLOSED`.

---

## Happy Path

1. Employee mở Itinerary Builder của một Trip.
2. Employee bấm nút **"Tạo lịch trình bằng AI"**.
3. Client hiển thị **Skeleton loading** ngay lập tức.
4. Client gửi `POST /api/v1/ai/generate-itinerary` với `{ tripId, destination, days, budget, preferences? }`.
5. Server gọi Gemini API với prompt có `budget_cap = budget`.
6. Gemini trả về JSON itinerary draft.
7. Server kiểm tra `totalEstimatedCost ≤ budget` (BR-TR-07 guardrail).
8. Guardrail pass → Server trả 200 với danh sách items phân theo ngày/buổi.
9. Client render preview itinerary, cho phép Employee xem trước.
10. Employee bấm **"Áp dụng"** → Client gọi `POST /api/v1/trips/:tripId/itinerary` cho từng item (với `isAiGenerated = true` — server set).

---

## Alternate / Error Paths

| ID | Tình huống | Phản hồi hệ thống |
|---|---|---|
| E-01 | AI sinh itinerary có `totalEstimatedCost > budget` | Server retry tối đa 2 lần. Nếu vẫn vượt → `422 AI_BUDGET_GUARDRAIL_FAILED` |
| E-02 | `422 AI_BUDGET_GUARDRAIL_FAILED` | Toast: "Không thể tạo lịch trình trong ngân sách. Vui lòng tăng ngân sách hoặc giảm số ngày." Skeleton biến mất. |
| E-03 | Gemini API timeout (> 8s server-side) | `500` → Toast: "Dịch vụ AI tạm thời không khả dụng. Bạn có thể nhập thủ công." |
| E-04 | `days` > `trip.tripDays` | `400 VALIDATION_ERROR`: "Số ngày AI không thể lớn hơn số ngày chuyến đi" |
| E-05 | `budget ≤ 0` | `400 VALIDATION_ERROR` |
| E-06 | `tripId` không thuộc về user | `403 NOT_OWNER` |
| E-07 | Trip đã CLOSED | `409 TRIP_IMMUTABLE` |
| E-08 | Token hết hạn | Auto refresh → retry |
| E-09 | Role không phải EMPLOYEE | `403 FORBIDDEN` |
| E-10 | Mạng ngắt trong khi chờ | Toast lỗi, Skeleton biến mất, nút "Thử lại" hiển thị |

---

## Data Read / Write

### Read
- `GET /api/v1/trips/:tripId` — xác nhận trip tồn tại, lấy `destination`, `tripDays`, `estimatedBudget`.

### Write (khi Employee bấm "Áp dụng")
- `POST /api/v1/trips/:tripId/itinerary` — tạo từng `itinerary_item` với `isAiGenerated = true`.
- Server INSERT `audit_logs`: `{ action: "AI_ITINERARY_APPLIED", entityType: "TRIP", metadata: { itemCount, totalEstimatedCost } }`.

### DB Tables affected
| Bảng | Operation | Ghi chú |
|---|---|---|
| `itinerary_items` | INSERT (batch) | `is_ai_generated = true` |
| `audit_logs` | INSERT | `action = AI_ITINERARY_APPLIED` |

> **AI API Key:** Gemini API key lưu trong `.env` server-side. **Không bao giờ** expose ra client (ADR-06).

---

## API Contract

### `POST /api/v1/ai/generate-itinerary`
**Request:**
```json
{
  "tripId": "uuid",
  "destination": "Đà Nẵng",
  "days": 3,
  "budget": 5000000,
  "preferences": "Ưu tiên họp buổi sáng, tham quan nhẹ buổi chiều"
}
```

**Response 200:**
```json
{
  "destination": "Đà Nẵng",
  "days": 3,
  "totalEstimatedCost": 4850000,
  "budgetCap": 5000000,
  "guardrailPass": true,
  "items": [
    {
      "dayNumber": 1,
      "itemDate": "2026-09-20",
      "timeSlot": "MORNING",
      "location": "Sân bay Đà Nẵng",
      "activity": "Di chuyển và check-in khách sạn",
      "category": "TRANSPORT",
      "estimatedCost": 150000,
      "notes": null
    }
  ]
}
```

**Response 422:**
```json
{
  "error": "AI_BUDGET_GUARDRAIL_FAILED",
  "message": "Không thể tạo lịch trình trong ngân sách 5.000.000 VNĐ sau 2 lần thử.",
  "requestId": "req_abc123"
}
```

**Timeout:** Server 8s, target client ≤ 5s (NFR-TR-02).

---

## Authorization

| Role | Quyền |
|---|---|
| `EMPLOYEE` | ✅ — chỉ với `tripId` của mình |
| `MANAGER` | ❌ 403 |
| `TRAVEL_ADMIN` | ❌ 403 |
| `FINANCE` | ❌ 403 |

---

## Validation / Business Rules

| Rule | Nguồn | Kiểm tra tại | Hành vi |
|---|---|---|---|
| `days ≤ trip.tripDays` | Logic | Server | 400 |
| `budget > 0` | Logic | Server | 400 |
| `totalEstimatedCost ≤ budget` | BR-TR-07 | Server (AIService guardrail) | Retry ×2 → 422 |
| AI không được tự tăng budget | BR-TR-07 | Server — không dùng AI output `budget` | Guardrail reject |
| Trip không CLOSED | BR-TR-06 | immutableGuard middleware | 409 |
| `isAiGenerated = true` | data-model | Server set, không nhận từ client | Strip nếu client gửi |

---

## Observability / Logging

| Event | Log level | Nội dung |
|---|---|---|
| AI request gửi đến Gemini | `info` | `{ destination, days, budget, requestId }` |
| Gemini response nhận về | `info` | `{ totalEstimatedCost, itemCount, guardrailPass, durationMs }` |
| Guardrail fail (retry) | `warn` | `{ attempt, totalEstimatedCost, budget, overshoot }` |
| Guardrail fail (2 lần) | `warn` | `{ action: "AI_GUARDRAIL_REJECT", tripId, budget }` |
| Gemini timeout | `error` | `{ action: "AI_TIMEOUT", durationMs, requestId }` |
| Items áp dụng | `info` | `{ action: "AI_ITINERARY_APPLIED", tripId, itemCount }` |

**Audit Log:** INSERT sau khi Employee áp dụng itinerary AI (NFR-TR-04).

---

## Test Plan

| ID | Loại | Mô tả | Expected |
|---|---|---|---|
| T2.1 | Happy path | `days=3`, `budget=5000000`, Gemini trả về `totalCost=4500000` | 200, `guardrailPass=true`, 3+ items |
| T2.2 | AC 2.1 | Items cover cả MORNING/AFTERNOON | Mỗi ngày có ≥ 2 time slots |
| T2.3 | AC 2.2 | Gemini trả về `totalCost=5500000 > 5000000` (mock) | Server retry; sau 2 lần → 422 |
| T2.4 | Perf | Đo thời gian từ click → render | ≤ 5000ms (NFR-TR-02) |
| T2.5 | Error E-03 | Mock Gemini timeout 9s | 500, toast "AI không khả dụng" |
| T2.6 | Error E-04 | `days = trip.tripDays + 1` | 400 |
| T2.7 | Auth E-06 | `tripId` của employee khác | 403 NOT_OWNER |
| T2.8 | Auth E-09 | Token role=MANAGER | 403 FORBIDDEN |
| T2.9 | Apply | Sau khi áp dụng, query `itinerary_items` | `is_ai_generated=true` cho tất cả items |
| T2.10 | Audit | Sau T2.9, query `audit_logs` | Record `AI_ITINERARY_APPLIED` tồn tại |
| T2.11 | Edge | Trip CLOSED → gọi AI | 409 TRIP_IMMUTABLE |
| T2.12 | Edge | Skeleton hiển thị trong khi chờ | Loading state visible ≥ 500ms |
| T2.13 | Security | Client cố gửi `isAiGenerated=false` | Server override thành `true` |

**AC Coverage:** AC 2.1 → T2.1, T2.2 ✅ | AC 2.2 → T2.3 ✅

---

## Definition of Done

- [ ] `POST /api/v1/ai/generate-itinerary` hoạt động, guardrail server-side (BR-TR-07)
- [ ] Retry logic tối đa 2 lần khi guardrail fail
- [ ] Skeleton loading hiển thị từ lúc bấm đến khi nhận response
- [ ] Response ≤ 5s trong điều kiện mạng chuẩn (NFR-TR-02)
- [ ] `isAiGenerated = true` được server set — không nhận từ client
- [ ] Gemini API key không bao giờ expose ra frontend
- [ ] `audit_logs` có record `AI_ITINERARY_APPLIED` (NFR-TR-04)
- [ ] Tất cả 13 test cases T2.1–T2.13 pass

> **⚠️ Cần xác nhận trước khi code:**
> 1. Khi guardrail fail hoàn toàn, có cho phép employee thấy itinerary "gần đúng" không, hay ẩn hoàn toàn?
> 2. Gemini API key có cần rotation định kỳ không? Cơ chế nào trong môi trường demo?
