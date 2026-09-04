# Workflows - Smart Travel & Business Trip Management

## Luồng chính: Request → Approve → Itinerary → Trip → Expense → Close

```
[Employee]                [Manager]              [Travel Admin]           [AI]                  [Finance]
    │
    ├─ Tạo Trip Request ──► DRAFT
    │                         │
    │                         └─ Submit ──► SUBMITTED
    │                                         │
    │                              ┌──────────┴──────────┐
    │                              │                     │
    │                         [Manager review]      [Reject] ──► REJECTED
    │                              │
    │                         MANAGER_REVIEWING (*)
    │                              │
    │              ┌───────────────┴──────────────────┐
    │              │ (budget ≤ 20M, không vi phạm)    │ (budget > 20M HOẶC có vi phạm — BR-TR-04)
    │              ▼                                   ▼
    │           APPROVED                   PENDING_ADMIN_APPROVAL
    │                                               │
    │                                    [Travel Admin duyệt cấp 2]
    │                                               │
    │                              ┌────────────────┴───────────────┐
    │                              │                                │
    │                           APPROVED                        REJECTED
    │
    │    [AI sinh Itinerary Draft — REQ-TR-02, BR-TR-07]
    │    [Employee chỉnh sửa Itinerary Builder — US-03]
    │
    ├─ Bắt đầu chuyến đi ──► ONGOING
    │
    ├─ Expense Claim (EXPENSE_DRAFT) ──► EXPENSE_SUBMITTED
    │                                          │
    │                             ┌────────────┴──────────────────────────┐
    │                             │                                       │
    │                   (variance ≤ 10%)                     (variance > 10% — BR-TR-05)
    │                             │                                       │
    │                    [Finance duyệt]                   MANAGER_REAPPROVE (*)
    │                             │                                       │
    │                     EXPENSE_APPROVED                       [Manager duyệt bổ sung]
    │                             │                                       │
    │                    [Finance gọi Close]                  EXPENSE_SUBMITTED (loop)
    │                             │
    │                          CLOSED (Read-only / Immutable — BR-TR-06)
```

> `(*)` = Internal state — không expose ra external API response dưới dạng trạng thái cuối

---

## Trạng thái (Status) đầy đủ của Trip Request

> **Phân loại:** Public API = hiển thị trực tiếp trong response; Internal = trạng thái trung gian server-side, có thể thay đổi trong cùng một request cycle.

| Status | Loại | Ý nghĩa | Ai chuyển trạng thái |
|---|---|---|---|
| `DRAFT` | Public | Employee vừa tạo, chưa submit | Employee (submit) |
| `SUBMITTED` | Public | Đã submit, đang chờ Manager | Server (khi submit) |
| `MANAGER_REVIEWING` | **Internal** | Trạng thái nội bộ khi Manager đang xử lý. **Không phải trạng thái cuối — không dùng làm filter UI.** Được giữ trong state machine backend nhưng thường chuyển ngay sang `APPROVED` hoặc `PENDING_ADMIN_APPROVAL` trong cùng transaction. | Backend (tự động) |
| `PENDING_ADMIN_APPROVAL` | Public | Chờ Travel Admin duyệt cấp 2 (BR-TR-04: budget > 20M hoặc có vi phạm) | Travel Admin |
| `APPROVED` | Public | Đã duyệt đủ cấp, sẵn sàng thực hiện | Tự động sau approval cuối |
| `REJECTED` | Public | Bị từ chối ở bất kỳ cấp nào | Manager hoặc Travel Admin |
| `ONGOING` | Public | Chuyến đi đang diễn ra | Employee (bắt đầu chuyến đi) |
| `EXPENSE_DRAFT` | Public | Employee đang soạn Expense Claim | Employee |
| `EXPENSE_SUBMITTED` | Public | Đã nộp Expense Claim, chờ Finance | Finance hoặc Manager (nếu > 10%) |
| `EXPENSE_APPROVED` | Public | Finance đã duyệt chi phí, **chưa đóng hồ sơ** (cần gọi Close API riêng) | Finance (close) |
| `EXPENSE_REJECTED` | Public | Finance reject — Employee cần sửa lại | Employee (re-submit) |
| `MANAGER_REAPPROVE` | **Internal** | Trạng thái nội bộ khi variance > 10% và đang chờ Manager duyệt bổ sung (BR-TR-05). Tương tự `MANAGER_REVIEWING`, là transient state. | Manager (re-approve) |
| `CLOSED` | Public | Finance đã đóng hồ sơ; dữ liệu bất biến (BR-TR-06) | Finance |

---

## Mapping Frontend ↔ Backend

Frontend `TripStatus` gộp một số trạng thái nội bộ thành nhóm hiển thị:

| Backend Status | Frontend TripStatus hiển thị | Ghi chú |
|---|---|---|
| `DRAFT` | `DRAFT` | |
| `SUBMITTED` | `SUBMITTED` | |
| `MANAGER_REVIEWING` | `SUBMITTED` | Internal state — hiển thị như "Chờ duyệt" |
| `PENDING_ADMIN_APPROVAL` | `PENDING_ADMIN_APPROVAL` | |
| `APPROVED` | `APPROVED` | |
| `REJECTED` | `REJECTED` | |
| `ONGOING` | `TRIP_IN_PROGRESS` | |
| `EXPENSE_DRAFT` | `TRIP_IN_PROGRESS` | Gộp với ONGOING ở UI |
| `EXPENSE_SUBMITTED` | `EXPENSE_SUBMITTED` | |
| `EXPENSE_APPROVED` | `EXPENSE_APPROVED` | **Tách riêng — không gộp vào CLOSED** |
| `EXPENSE_REJECTED` | `EXPENSE_SUBMITTED` | Loop lại để employee sửa |
| `MANAGER_REAPPROVE` | `PENDING_MANAGER_ADDITIONAL_APPROVAL` | Internal state |
| `CLOSED` | `CLOSED` | |

---

## Quy tắc quan trọng về trạng thái nội bộ

1. **`MANAGER_REVIEWING`** là trạng thái nội bộ trong VALID_TRANSITIONS state machine của backend, nhưng trong thực tế `approveTrip()` chuyển thẳng sang `APPROVED` hoặc `PENDING_ADMIN_APPROVAL` mà không giữ lại `MANAGER_REVIEWING`. Không nên dùng làm filter hay điều kiện trong API client.

2. **`MANAGER_REAPPROVE`** tương tự — là nhánh chuyển tạm khi Finance reject vì variance > 10%. Frontend map thành `PENDING_MANAGER_ADDITIONAL_APPROVAL` để hiển thị.

3. **`EXPENSE_APPROVED` ≠ `CLOSED`** — Finance cần gọi `POST /trips/:id/close` riêng sau khi `approveExpense`. Đây là hai bước tách biệt để đảm bảo audit trail đầy đủ.

---

## Ghi chú

- Mọi chuyển trạng thái phải ghi audit log (ai, khi nào, hành động gì) — xem NFR liên quan trong `requirements.md`.
- AI chỉ tham gia ở bước sinh Itinerary Draft; không có quyền tự chuyển trạng thái phê duyệt (BR-TR-07, AI Guardrail Rule).
- Manager chỉ được approve/reject Trip thuộc nhân viên trực tiếp của mình (NFR-TR-03 RBAC ownership).
- Nguồn: `03-domain/business-rules.md` (BR-TR-01 → BR-TR-07), `02-requirements/requirements.md`.
