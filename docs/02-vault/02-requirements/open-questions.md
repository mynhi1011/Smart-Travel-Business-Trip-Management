# Assumptions & Open Questions - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 - MIS3032_1

Tách riêng khỏi `03-domain/business-rules.md` để khớp cấu trúc Vault chuẩn (business-rules.md chỉ chứa Business Rules đã Confirmed; giả định/câu hỏi mở nằm ở đây cho đến khi được chốt).

### Giả định (Assumptions)
- **ASM-TR-01:** Mỗi nhân viên tham gia hệ thống thuộc về 1 phòng ban và có 1 Quản lý trực tiếp (Manager) được gán cố định trong bảng Người dùng.
- **ASM-TR-02:** Tất cả các chuyến công tác trong phạm vi MVP đều sử dụng đồng tiền cơ sở là Việt Nam Đồng (VND).
- **ASM-TR-03:** Các chứng từ, hóa đơn đính kèm trong Expense Claim được lưu trữ dưới dạng mock file/ảnh tải lên cục bộ hoặc link cloud tĩnh.

### Câu hỏi mở (Open Questions)
- **Q-TR-01:** Có cho phép 1 Trip Request bao gồm một đoàn nhiều nhân viên đi cùng nhau không?  
  *→ Quyết định cho MVP:* Không, trong phạm vi MVP mỗi Trip Request chỉ áp dụng cho 1 nhân viên chủ trì để đơn giản hóa luồng phê duyệt và quyết toán.
- **Q-TR-02:** Nếu Manager không duyệt sau 48h, hệ thống có tự động escalation lên cấp cao hơn không?  
  *→ Quyết định cho MVP:* Chưa tự động escalation trong MVP; chỉ gửi thông báo nhắc nhở trên giao diện.