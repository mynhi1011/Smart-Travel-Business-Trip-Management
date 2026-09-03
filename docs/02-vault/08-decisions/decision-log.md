# Decision Log - Nhóm 11

Ghi lại mọi quyết định quan trọng của dự án — không được để quyết định chỉ nằm trong chat rồi quên.

| ID | Ngày | Quyết định | Lý do / Alternatives đã cân nhắc | Người quyết định |
|---|---|---|---|---|
| D-01 | 22/08/2026 | Chọn đề tài "Smart Travel & Business Trip Management" | Đề tài phù hợp với workflow doanh nghiệp có nhiều vai trò rõ ràng (Employee/Manager/Travel Admin/Finance), dễ thiết kế business rule và AI feature có giá trị thật (sinh itinerary, kiểm tra policy) | Cả nhóm |
| D-02 | 22/08/2026 | Phân 5 vai trò: Product/BA (Mỹ Nhi), AI/Vault (Tuyết Nhi), UX/UI (Dung), Engineering (Tuyết), QA/Release (Bảo Ngọc) | Dựa theo năng lực và sở thích từng thành viên; đảm bảo đủ 5 mảng bắt buộc theo giáo trình | Cả nhóm |
| D-03 | 22/08/2026 | Workflow chính: Request → Approve → Itinerary → Trip → Expense → Close | Đây là chuỗi tối thiểu để mô phỏng đúng vòng đời một chuyến công tác doanh nghiệp | Mỹ Nhi (Product/BA) đề xuất, cả nhóm thống nhất |
| D-04 | 22/08/2026 | Đặt tên repo GitHub: `Smart-Travel-Business-Trip-Management-` | Khớp tên đề tài, tránh trùng ký tự đặc biệt gây lỗi khi clone | Mỹ Nhi |
| D-05 | 24-25/08/2026 | Không tích hợp thanh toán thật, đặt vé/khách sạn thật qua API bên thứ ba | Nằm ngoài phạm vi MVP; tập trung nguồn lực vào workflow phê duyệt + AI feature thay vì tích hợp bên thứ ba phức tạp, tốn thời gian | Cả nhóm |
| D-06 | 26/08/2026 | Thống nhất trần khách sạn Staff/Specialist là 1.000.000 VNĐ/đêm (BR-TR-01) thay vì 1.200.000 VNĐ trong phỏng vấn P3 | Số liệu 1.200.000 VNĐ trong `user-research.md` là chính sách công ty ngoài thực tế của P3. Nhóm chuẩn hoá lại trần 1.000.000 VNĐ cho hệ thống mẫu của nhóm nhằm dễ tính toán hạn mức phân tầng chẵn (Staff: 1M, Manager: 1.8M, Director: 3M) và khớp với seed data demo. | Mỹ Nhi (BA) & Cả nhóm |
| D-07 | 26/08/2026 | Quy định thời hạn gửi yêu cầu công tác nội bộ là trước 3 ngày làm việc (BR-TR-03) | Trong phỏng vấn P3 đề cập quy tắc "7 ngày" là bao gồm cả thời gian book vé máy bay giá rẻ/phòng của công ty ngoài. Trong phạm vi hệ thống nội bộ của nhóm (chỉ xử lý Request → Approval), quy định 3 ngày làm việc là thời gian tối thiểu hợp lý (SLA) để Manager và Travel Admin xử lý phê duyệt trước ngày khởi hành. | Mỹ Nhi (BA) |

## Cách dùng file này

- Mỗi khi nhóm đổi scope, đổi tech stack, đổi business rule quan trọng, hoặc bác bỏ 1 đề xuất (kể cả đề xuất từ AI) — phải thêm 1 dòng mới vào bảng trên.
- Không xoá quyết định cũ, kể cả khi sau này bị thay đổi — chỉ thêm quyết định mới và ghi rõ "Superseded D-0X" trong lý do nếu có.