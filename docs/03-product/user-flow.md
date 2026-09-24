[Employee]                      [Manager]               [Travel Admin]          [AI]        [Finance]
    │
    ├─ Nhu cầu đi công tác
    │
    ├─ Tạo Trip Request ──► DRAFT
    │           │
    │           ▼
    │     [System: Policy Check]
    │           │
    │     Có vi phạm policy?
    │           │
    │   ┌───────┴────────────────────────────┐
    │   │ (Không)                            │ (Có — Policy Violation,
    │   │                                    │  vẫn được gửi duyệt)
    │   └────────────────┬───────────────────┘
    │                    ▼
    ├─ Tạo / Gợi ý Itinerary
    │     • AI gợi ý lịch trình
    │     • Employee điều chỉnh lịch trình
    │
    ├─ Xem & xác nhận Itinerary
    │
    ├─ Gửi Request để phê duyệt ──► SUBMITTED
    │                    │
    │                    ▼
    │            [Manager xem chi tiết Request]
    │              • Thông tin chuyến đi
    │              • Dự toán chi phí
    │              • Itinerary
    │              • Policy Check
    │                    │
    │              Phê duyệt?
    │                    │
    │        ┌───────────┴──────────────┐
    │        │ (Reject)                 │ (Approve)
    │        ▼                          ▼
    │     REJECTED             MANAGER_REVIEWING (*)
    │                                   │
    │              ┌────────────────────┴─────────────────────┐
    │              │ (budget ≤ 20M, không vi phạm)            │ (budget > 20M HOẶC có vi phạm — BR-TR-04)
    │              ▼                                                                       ▼
    │           APPROVED                            PENDING_ADMIN_APPROVAL
    │                                                         │
    │                                              [Travel Admin duyệt cấp 2]
    │                                                         │
    │                                          ┌──────────────┴──────────────┐
    │                                          │                             │
    │                                       APPROVED                     REJECTED
    │
    │    
    │
    ├─ Bắt đầu chuyến đi ──► ONGOING
    ├─ Kết thúc chuyến đi ──► ONGOING
    │
    ├─ Expense Claim ──► EXPENSE_SUBMITTED
    │                                          │
    │                             ┌────────────┴──────────────────────────┐
    │                             │                                       │
    │                   (variance ≤ 10%)                     (variance > 10% — BR-TR-05)
    │                             │                                       │
    │                    [Finance duyệt]                       MANAGER_REAPPROVE (*)
    │                             │                                       │
    │                     EXPENSE_APPROVED                     [Manager duyệt bổ sung]
    │                             │                                       │
    │                    [Finance gọi Close]                      EXPENSE_SUBMITTED
    │                             │                                       │
    │                             │                              [Finance gọi Close]
    │                             │                                       │
    │                             └───────────────────┬───────────────────┘
    │                                                 ▼
    │                              CLOSED (Read-only / Immutable)
    │

    


