# Assumptions & Open Questions - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 - MIS3032_1

Tách riêng khỏi `03-domain/business-rules.md` để khớp cấu trúc Vault chuẩn (business-rules.md chỉ chứa Business Rules đã Confirmed; giả định/câu hỏi mở nằm ở đây cho đến khi được chốt).

### Giả định (Assumptions)
- **ASM-TR-01:** Mỗi nhân viên tham gia hệ thống thuộc về 1 phòng ban và có 1 Quản lý trực tiếp (Manager) được gán cố định trong bảng Người dùng.
- **ASM-TR-02:** Tất cả các chuyến công tác trong phạm vi MVP đều sử dụng đồng tiền cơ sở là Việt Nam Đồng (VND).
- **ASM-TR-03:** Các chứng từ, hóa đơn đính kèm trong Expense Claim được lưu trữ dưới dạng mock file/ảnh tải lên cục bộ hoặc link cloud tĩnh.

### Câu hỏi mở (Open Questions) — đã đóng, chính thức thành Decision Record

- **Q-TR-01:** Có cho phép 1 Trip Request bao gồm một đoàn nhiều nhân viên đi cùng nhau không?  
  *→ Trạng thái:* **Đóng — xem Decision Record `D-13`** trong `08-decisions/decision-log.md`. Không cần tra cứu ở đây nữa, mục này chỉ giữ lại để truy vết lịch sử câu hỏi gốc.
- **Q-TR-02:** Nếu Manager không duyệt sau 48h, hệ thống có tự động escalation lên cấp cao hơn không?  
  *→ Trạng thái:* **Đóng — xem Decision Record `D-14`** trong `08-decisions/decision-log.md`. Không cần tra cứu ở đây nữa, mục này chỉ giữ lại để truy vết lịch sử câu hỏi gốc.

### Quyết định liên quan đã chốt
- **D-09:** Chu kỳ trạng thái Trip Request canonical; loại bỏ `APPROVED_MANAGER` khỏi API/UI.
- **D-10:** Per Diem vượt mức là warning khi tạo/submit; được xem xét ở bước policy/approval.
- **D-11:** Owner chỉnh sửa itinerary ở mọi trạng thái trừ `CLOSED`.
- **D-12:** PDF export chỉ dành cho owner hoặc FINANCE và các trạng thái đã liệt kê trong Decision Log.
- **D-13:** Q-TR-01 đóng — không cho phép nhiều nhân viên trong 1 Trip Request.
- **D-14:** Q-TR-02 đóng — không tự động escalation sau 48h, chỉ nhắc nhở in-app.

> Chi tiết đầy đủ (ngày chốt, lý do, artifact bị ảnh hưởng) của D-05 → D-14 nằm tại `08-decisions/decision-log.md` — đây chỉ là bản tóm tắt nhanh.
