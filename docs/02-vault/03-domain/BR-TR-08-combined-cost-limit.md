# BR-TR-08 — Kiểm tra tổng hạn mức lưu trú và phụ cấp công tác

**Dự án:** Smart Travel & Business Trip Management  
**Trạng thái:** Confirmed  
**Quyết định:** D-15 (2026-09-24), cập nhật D-16 (2026-09-24)

## Mục đích

Đánh giá chi phí chuyến đi như một tổng thể so với hạn mức kết hợp lưu trú + phụ cấp. BR-TR-01 và BR-TR-02 chỉ định nghĩa mức thành phần tham chiếu, không phát sinh cảnh báo riêng.

## Công thức (D-16)

```
Combined_Actual     = plannedBudget   (= estimatedBudget người dùng nhập)
tripDays            = (returnDate − departureDate) + 1  [date-only UTC]
hotelNights         = max(tripDays − 1, 0)
destinationType     = resolveDestinationType(destination)  [tự suy từ tên điểm đến]
Hotel_Limit_Total   = HOTEL_LIMIT_PER_NIGHT[jobGrade] × hotelNights
Per_Diem_Limit_Total = tripDays × PER_DIEM_RATE[destinationType]
Combined_Limit      = Hotel_Limit_Total + Per_Diem_Limit_Total
exceeded            = Combined_Actual > Combined_Limit
```

**Lưu ý quan trọng (D-16):**
- `jobGrade` lấy từ user đăng nhập tại BE — **không nhận từ client**.
- `destinationType` do BE tự suy ra từ chuỗi `destination` bằng hàm `resolveDestinationType()` (`policyRules.ts`). Client **không** cần gửi trường `destinationType` nữa.
- Không có ô nhập `hotelCostPerNight`, `perDiemBudget` từ client. Form chỉ có `estimatedBudget`.

## Mức thành phần (hằng số BE, không cho user nhập)

**BR-TR-01 — Hotel_Limit_Per_Night theo jobGrade:**

| jobGrade | Hạn mức/đêm |
|---|---|
| STAFF | 1.000.000 VNĐ |
| MANAGER_GRADE | 1.800.000 VNĐ |
| DIRECTOR | 3.000.000 VNĐ |

**BR-TR-02 — Per_Diem_Rate theo destinationType:**

| destinationType | Mức/ngày |
|---|---|
| TIER1_CITY (Hà Nội, TP.HCM, Đà Nẵng) | 400.000 VNĐ |
| OTHER | 300.000 VNĐ |

## resolveDestinationType — alias được nhận dạng

| Nhóm | Alias (sau bỏ dấu, hạ thường) |
|---|---|
| Hà Nội → TIER1_CITY | "ha noi", "hanoi", "hn" |
| TP.HCM → TIER1_CITY | "ho chi minh", "tp ho chi minh", "tp hcm", "tphcm", "hcm", "sai gon", "saigon", "thanh pho ho chi minh" |
| Đà Nẵng → TIER1_CITY | "da nang", "danang" |
| Tất cả còn lại | → OTHER |

## Điều kiện và hành vi

1. Chỉ đánh giá khi `tripDays ≥ 1` (returnDate ≥ departureDate). Nếu dữ liệu lệch → bỏ qua, không báo lỗi riêng.
2. Nếu `Combined_Actual > Combined_Limit`: Policy Check hiển thị **đúng một cảnh báo tổng hợp** (`COMBINED_COST_LIMIT_EXCEEDED`), kèm `plannedBudget`, `combinedLimit`, `tripDays`, `hotelNights`, `jobGrade`, `destinationType`. Cảnh báo này **tính là vi phạm Policy** → duyệt 2 cấp (BR-TR-04).
3. Nếu `Combined_Actual ≤ Combined_Limit`: không cảnh báo.
4. **Không** có cảnh báo riêng cho khách sạn hay per diem.
5. **Không** yêu cầu Employee nhập lý do/giải trình. Không chặn submit.
6. Các validate đầu vào khác (ngày âm, ngân sách ≤ 0) không thay đổi.

## Ví dụ chuẩn

**Staff, đi TP.HCM, 3 ngày (2 đêm):**
- Hotel_Limit_Total = 1.000.000 × 2 = 2.000.000 VNĐ
- Per_Diem_Limit_Total = 3 × 400.000 = 1.200.000 VNĐ
- Combined_Limit = 3.200.000 VNĐ
- `plannedBudget = 3.300.000` → vượt → cảnh báo + vi phạm Policy → **duyệt 2 cấp**
- `plannedBudget = 3.200.000` (hoặc thấp hơn, không dính điều kiện khác) → không cảnh báo → **1 cấp**

## approvalReasons snapshot (D-16)

Khi `exceeded = true`, `buildApprovalReasons()` tạo lý do:
```json
{
  "code": "COMBINED_COST_LIMIT_EXCEEDED",
  "title": "Vượt tổng hạn mức lưu trú và phụ cấp",
  "detail": "Vi phạm chính sách: Ngân sách dự kiến 3.300.000 VNĐ vượt tổng hạn mức lưu trú và phụ cấp 3.200.000 VNĐ (Staff, 3 ngày / 2 đêm, Hà Nội / TP.HCM / Đà Nẵng).",
  "data": {
    "plannedBudget": 3300000,
    "combinedLimit": 3200000,
    "hotelLimitTotal": 2000000,
    "perDiemLimitTotal": 1200000,
    "tripDays": 3,
    "hotelNights": 2,
    "jobGrade": "STAFF",
    "destinationType": "TIER1_CITY"
  }
}
```

## Tài liệu liên quan

`business-rules.md`, `US-01-create-trip-request.md`, `US-03-itinerary-builder.md`, `US-04-policy-check.md`, `US-05-manager-approve.md`, `US-06-travel-admin-approve-l2.md`, `user-stories.md`, `requirements.md`, `TRACEABILITY.md`, `decision-log.md`, `policyRules.ts`.
