# BR-TR-08 — Kiểm tra tổng hạn mức lưu trú và phụ cấp công tác

**Dự án:** Smart Travel & Business Trip Management  
**Trạng thái:** Confirmed  
**Quyết định:** D-15 (2026-09-24)

## Mục đích
Đánh giá chi phí lưu trú và phụ cấp công tác như một tổng thể. BR-TR-01 và BR-TR-02 chỉ định nghĩa mức thành phần, không phát sinh cảnh báo riêng.

## Công thức
- `Hotel_Actual = hotelCostPerNight × hotelNights`
- `Per_Diem_Actual = perDiemBudget`
- `Combined_Actual = Hotel_Actual + Per_Diem_Actual`
- `Hotel_Limit_Total = Hotel_Limit[jobGrade] × hotelNights`
- `Per_Diem_Limit_Total = tripDays × Per_Diem_Rate[destinationType]`
- `Combined_Limit = Hotel_Limit_Total + Per_Diem_Limit_Total`

Các giá trị mức thành phần lấy từ BR-TR-01 (hạn mức khách sạn theo cấp bậc) và BR-TR-02 (400.000 VNĐ/ngày cho `TIER1_CITY`; 300.000 VNĐ/ngày cho `OTHER`).

## Điều kiện và hành vi
1. Chỉ thực hiện phép tính khi dữ liệu chi phí tương ứng có sẵn; field tùy chọn bị bỏ trống không được tự gán thành một khoản chi phí.
2. Nếu `Combined_Actual > Combined_Limit`, Policy Check hiển thị **một cảnh báo tổng hợp**.
3. Nếu `Combined_Actual <= Combined_Limit`, không hiển thị cảnh báo tổng hợp.
4. Không hiển thị cảnh báo riêng do khách sạn hoặc per diem vượt mức thành phần.
5. Không yêu cầu Employee nhập lý do/giải trình cho cảnh báo BR-TR-08.
6. Quy tắc này không thay đổi kiểm tra dữ liệu đầu vào (ví dụ số tiền âm/sai kiểu) và không thay đổi các điều kiện khẩn cấp BR-TR-03 hoặc định tuyến phê duyệt BR-TR-04.

## Ví dụ
Staff đi công tác 2 đêm, 3 ngày tại `TIER1_CITY`: hạn mức khách sạn = 2 × 1.000.000 = 2.000.000 VNĐ; hạn mức per diem = 3 × 400.000 = 1.200.000 VNĐ; tổng hạn mức = 3.200.000 VNĐ. Nếu tổng chi phí khách sạn và per diem là 3.300.000 VNĐ thì hiển thị một cảnh báo tổng hợp; không yêu cầu nhập lý do.

## Tài liệu liên quan
`business-rules.md`, `US-01-create-trip-request.md`, `US-03-itinerary-builder.md`, `US-04-policy-check.md`, `user-stories.md`, `requirements.md`, `TRACEABILITY.md`, `decision-log.md`.
