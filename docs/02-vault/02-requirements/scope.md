# MVP Scope - Smart Travel & Business Trip Management

Trích từ `docs/01-discovery/project-charter.md` (canonical), chuẩn hoá theo khung Must/Should/Could/Out of Scope để Vault/AI tra cứu trực tiếp.

| Must | Should | Could | Out of Scope |
|---|---|---|---|
| Tạo Trip Request (REQ-TR-01) | Escalation tự động nếu Manager không duyệt sau 48h (Q-TR-02 — chưa làm ở MVP, để ở đây làm mốc mở rộng) | Đề xuất khách sạn/chuyến bay tham khảo có đánh giá (review) | Đặt vé máy bay/khách sạn thật qua API bên thứ ba |
| Luồng duyệt 2 cấp (Manager → Travel Admin) theo BR-TR-04 | Trip Request nhiều nhân viên trong 1 đoàn (Q-TR-01 — chưa làm ở MVP) | Xuất báo cáo chi phí PDF nâng cao | Cổng thanh toán trực tuyến thật |
| AI sinh Itinerary nháp theo ngày/ngân sách (REQ-TR-02, BR-TR-07) | | | Tích hợp ERP kế toán phức tạp |
| Policy Violation engine tự động (REQ-TR-03) | | | Ứng dụng di động riêng biệt |
| Itinerary Builder cho Employee chỉnh sửa (REQ-TR-06) | | | Đa ngoại tệ / đa ngôn ngữ |
| Expense Claim + đối chiếu chênh lệch dự toán (REQ-TR-07, BR-TR-05) | | | |
| Finance nghiệm thu & Close hồ sơ (BR-TR-06) | | | |
| Dashboard theo 4 vai trò (Employee/Manager/Travel Admin/Finance) | | | |

**Nguồn:** `project-charter.md` (MVP/Out of scope), `requirements.md`, `business-rules.md`.
**Lưu ý:** Bảng này không phải nguồn tạo mới business rule — khi Should/Could được xác nhận triển khai, phải cập nhật `requirements.md` với ID mới và ghi vào `decision-log.md`.
