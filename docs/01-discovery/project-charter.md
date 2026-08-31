# Project Charter - Smart Travel & Business Trip Management

| Thuộc tính | Nội dung chi tiết |
|---|---|
| **Dự án & Nhóm** | **Smart Travel & Business Trip Management** — Nhóm 11 (MIS3032_1) |
| **Problem** | Quy trình xin đi công tác hiện tại diễn ra thủ công qua Email/Chat/Excel: thiếu thông tin hạn mức ngân sách theo cấp bậc, không rõ số cấp phê duyệt, lập lịch trình tốn thời gian và sai sót khi đối chiếu chi phí thực tế hậu công tác. Hệ quả gây chậm trễ chuyến đi, vượt ngân sách và phát sinh xung đột thanh toán. |
| **Primary Users** | **Employee** (Tạo request, nhận lịch trình, nộp chi phí) • **Manager** (Duyệt Cấp 1) • **Travel Admin** (Kiểm tra policy, duyệt Cấp 2) • **Finance** (Đối chiếu chi phí, đóng hồ sơ). |
| **Value Proposition** | Số hóa toàn trình chuỗi `Request → Approve → Itinerary → Trip → Expense → Close`. Tích hợp AI sinh lịch trình nháp theo constraint và tự động gắn cờ vi phạm chính sách trước khi trình duyệt, loại bỏ 70% thời gian xử lý thủ công. |
| **MVP Scope** | Tạo Trip Request; Luồng duyệt 2 cấp phân quyền; AI sinh Itinerary nháp theo ngày/ngân sách; Engine kiểm tra Policy Violation; Lập Expense Claim đối chiếu chênh lệch dự toán; Finance nghiệm thu & Close hồ sơ; Dashboard 4 vai trò. |
| **Out of Scope** | Đặt vé máy bay/khách sạn qua API bên thứ ba; Cổng thanh toán trực tuyến thật; Tích hợp ERP kế toán phức tạp; App di động riêng biệt; Đa ngoại tệ. |
| **Success Signals** | • Đạt ≥80% độ chính xác trên bộ 20 câu hỏi Q&A Benchmark của Vault có trích nguồn.<br>• Luồng nghiệp vụ chạy thông suốt 100% end-to-end từ Request đến Close.<br>• 0% trường hợp Trip Request vượt hạn mức mà không bị hệ thống cảnh báo vi phạm. |
| **Constraints** | Thời gian: 12 tuần môn học; Nền tảng: Desktop Web; Dữ liệu: Demo/Seed data; Nhóm 5 thành viên chịu trách nhiệm chéo toàn bộ luồng. |

### Definition of Done & Team Agreement
- **User Story DoD:** Đủ Code + Unit/Integration Test Pass + Pull Request được Review + Merge nhánh `main` + Traceability cập nhật.
- **Artifact DoD:** Có ID duy nhất, tiêu chí đo lường rõ ràng, tuân thủ Business Rules và được thành viên nhóm đối soát.
- **Quy tắc phối hợp:** Mọi quyết định kỹ thuật/nghiệp vụ ghi vào `decision-log.md`; 100% commit qua nhánh riêng và mở PR; không bypass test.