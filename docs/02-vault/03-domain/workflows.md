# Workflows - Smart Travel & Business Trip Management

## Luồng chính: Request → Approve → Itinerary → Trip → Expense → Close

```
[Employee]                [Manager]              [Travel Admin]           [AI]                  [Finance]
    │
    ├─ Tạo Trip Request ──► SUBMITTED
    │                          │
    │                          ├─ Approve ──► APPROVED_MANAGER
    │                          │                   │
    │                          │      (nếu ngân sách > 20.000.000 VNĐ HOẶC có Policy Violation — BR-TR-04)
    │                          │                   ▼
    │                          │            PENDING_ADMIN_APPROVAL ──► [Travel Admin duyệt cấp 2] ──► APPROVED
    │                          │                   │
    │                          │      (nếu không thỏa điều kiện cấp 2)
    │                          │                   ▼
    │                          │                APPROVED
    │                          │
    │                          └─ Reject (kèm lý do) ──► REJECTED (kết thúc luồng)
    │
    │                                                        ▼
    │                                          [AI sinh Itinerary Draft theo ngân sách/ngày — REQ-TR-02]
    │                                                        │
    │              ◄── Employee/Travel Admin chỉnh sửa Itinerary Builder (REQ-TR-06) ──┘
    │
    ├─ Trip diễn ra (TRIP_IN_PROGRESS)
    │
    ├─ Nộp Expense Claim sau chuyến đi ──► EXPENSE_SUBMITTED
    │                                            │
    │                                (BR-TR-05: nếu vượt dự toán > 10%)
    │                                            ▼
    │                              PENDING_MANAGER_ADDITIONAL_APPROVAL ──► [Manager duyệt bổ sung]
    │                                            │
    │                                            ▼
    │                                    [Finance đối chiếu & Close]
    │                                            │
    │                                            ▼
    │                                          CLOSED (Read-only / Immutable — BR-TR-06)
```

## Trạng thái (Status) của Trip Request

| Status | Ý nghĩa | Ai chuyển trạng thái tiếp theo |
|---|---|---|
| `SUBMITTED` | Employee vừa tạo request | Manager |
| `APPROVED_MANAGER` | Manager đã duyệt cấp 1 | Hệ thống (tự route cấp 2 nếu cần) |
| `PENDING_ADMIN_APPROVAL` | Chờ Travel Admin duyệt cấp 2 (BR-TR-04) | Travel Admin |
| `APPROVED` | Đã duyệt đủ cấp, sẵn sàng tạo Itinerary | AI + Travel Admin |
| `REJECTED` | Bị từ chối ở bất kỳ cấp nào | — (kết thúc) |
| `TRIP_IN_PROGRESS` | Chuyến đi đang diễn ra theo Itinerary đã chốt | Employee (sau khi kết thúc chuyến) |
| `EXPENSE_SUBMITTED` | Employee đã nộp Expense Claim | Finance (hoặc Manager nếu vượt >10%) |
| `PENDING_MANAGER_ADDITIONAL_APPROVAL` | Chênh lệch chi phí thực tế >10% dự toán (BR-TR-05) | Manager |
| `CLOSED` | Finance đã đối chiếu và đóng hồ sơ; dữ liệu bất biến (BR-TR-06) | — (kết thúc) |

## Ghi chú

- Mọi chuyển trạng thái phải ghi audit log (ai, khi nào, hành động gì) — xem NFR liên quan trong `requirements.md`.
- AI chỉ tham gia ở bước sinh Itinerary Draft; không có quyền tự chuyển trạng thái phê duyệt (BR-TR-07, AI Guardrail Rule).
- Nguồn: `03-domain/business-rules.md` (BR-TR-01 → BR-TR-07), `02-requirements/requirements.md`.
