# User Research & Synthesis - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Mục tiêu nghiên cứu:** Xác định các rào cản, điểm nghẽn (pain points) và kỳ vọng thực tế trong quy trình đề xuất công tác, phê duyệt, lên lịch trình và thanh quyết toán chi phí công tác tại doanh nghiệp.

---

## 1. Phương pháp & Đối tượng khảo sát

Nhóm đã thực hiện 4 cuộc phỏng vấn sâu (semi-structured interviews) và quan sát hành vi với các vai trò thực tế/proxy đại diện cho 4 tác nhân chính trong luồng công tác:

| ID | Vai trò / Chức danh | Đơn vị / Bối cảnh | Thâm niên | Hình thức |
|---|---|---|---|---|
| **P1** | Sales Executive (Employee) | Doanh nghiệp B2B phân phối thiết bị | 3 năm (đi công tác ~2 lần/tháng) | Phỏng vấn trực tiếp 30 phút |
| **P2** | Engineering Manager (Manager) | Công ty Công nghệ phần mềm | 5 năm (quản lý đội ngũ 14 kỹ sư) | Phỏng vấn trực tuyến 30 phút |
| **P3** | Trợ lý Hành chính kiêm Travel Coordinator (Travel Admin) | Doanh nghiệp logistics | 4 năm (điều phối 30-40 chuyến/tháng) | Phỏng vấn trực tiếp 45 phút |
| **P4** | Chuyên viên Kế toán Chi phí (Finance Officer) | Doanh nghiệp bán lẻ | 6 năm (kiểm toán hoá đơn & chi phí) | Phỏng vấn trực tiếp 40 phút |

---

## 2. Ghi chú phỏng vấn rút gọn (Fact & Observation)

### P1 - Employee (Người xin đi công tác)
- *"Mỗi lần cần đi gặp khách hàng ở tỉnh, em phải nhắn Slack/Email xin sếp, sau đó điền form Excel xin tạm ứng. Không ai nói rõ hạn mức khách sạn cho cấp Specialist là bao nhiêu nên toàn phải tự đoán, nhiều khi book xong về kế toán trừ tiền vì vượt quota."*
- *"Tự lên lịch trình rất mất thời gian: phải vừa xem lịch hẹn, tìm khách sạn gần nơi họp, vừa canh ngân sách cho khớp. Em chỉ mong có công cụ gợi ý sẵn lịch trình hợp lý để chọn cho nhanh."*
- *"Sau chuyến đi là ám ảnh thu thập hoá đơn. Giữ hoá đơn giấy cả tuần hay bị rách, mất hoặc quên ghi chú mục đích chi tiêu."*

### P2 - Line Manager (Người duyệt cấp 1)
- *"Mỗi tuần tôi nhận 5-7 yêu cầu công tác qua email/chat rời rạc. Vấn đề lớn nhất là nhân viên gửi request thiếu thông tin: không ghi rõ mục đích cụ thể, không đính kèm ước tính ngân sách hoặc không đối chiếu với hạn mức phòng ban."*
- *"Tôi mất nhiều thời gian hỏi đi hỏi lại (back-and-forth) xem chuyến này có thực sự cần thiết không và ngân sách lấy từ quỹ nào."*
- *"Tôi cần hệ thống cảnh báo ngay nếu request này vượt quota hoặc có điểm bất thường trước khi tôi bấm Approve."*

### P3 - Travel Admin (Người điều phối & kiểm tra Policy)
- *"Nhiều nhân viên chọn khách sạn cách địa điểm làm việc 15km chỉ vì thích, làm phát sinh tiền taxi nội thành rất nhiều."*
- *"Chính sách công tác tại công ty tôi quy định: đặt trước 7 ngày (để săn vé máy bay giá rẻ), vé máy bay phổ thông, trần khách sạn 1.200.000 VNĐ/đêm cho nhân viên. Nhưng hầu như không ai nhớ hết, tôi phải rà soát thủ công từng request rất mất thời gian."* *(Ghi chú: Nhóm đã chuẩn hóa thành 1.000.000 VNĐ và 3 ngày duyệt nội bộ trong hệ thống nhóm theo D-06, D-07).*
- *"Tôi muốn có một hệ thống tự động kiểm tra vi phạm chính sách (Policy Check) và tự động tạo khung lịch trình (Itinerary) chuẩn theo đúng điểm đến và ngân sách."*

### P4 - Finance Officer (Kế toán thanh quyết toán)
- *"Khâu quyết toán chi phí (Expense Settlement) là nơi hay cãi nhau nhất. Nhân viên nộp chi phí cao hơn dự toán ban đầu mà không có giải trình hoặc không có cấp duyệt bổ sung."*
- *"Hoá đơn VAT sai mã số thuế hoặc không hợp lệ vẫn nộp lên. Đối chiếu thủ công giữa Trip Request đã duyệt và Expense Claim thực tế tốn 30% thời gian làm việc mỗi tuần của tôi."*

---

## 3. Tổng hợp Pain Points & Insight Synthesis

```
[Phỏng vấn P1..P4] ──> [Phân tích & Gom cụm] ──> [3 Chủ đề cốt lõi] ──> [Yêu cầu hệ thống]
```

### Theme 1: Thông tin phân mảnh & Mơ hồ về Chính sách (Policy Ambiguity)
- **Bằng chứng:** 4/4 người phỏng vấn thừa nhận quy trình qua email/chat/excel gây thiếu minh bạch về hạn mức công tác và trạng thái duyệt.
- **Insight:** Nhân viên không cố tình vi phạm policy; họ vi phạm vì chính sách không được hiển thị/cảnh báo trực quan tại thời điểm tạo yêu cầu.
- **Hệ quả cho sản phẩm:** Hệ thống phải cấu hình rõ ràng Policy Matrix theo Role/Cấp bậc và tự động gắn nhãn vi phạm (Policy Violation Flags) ngay khi tạo request.

### Theme 2: Tắc nghẽn phê duyệt do thiếu dữ liệu chuẩn hóa (Approval Bottleneck)
- **Bằng chứng:** Manager (P2) và Travel Admin (P3) tốn 15-30 phút cho mỗi request chỉ để hỏi lại thông tin lịch trình, địa điểm, dự toán.
- **Insight:** Phê duyệt nhanh chỉ xảy ra khi Manager có đủ 3 yếu tố trên cùng 1 màn hình: Mục đích kinh doanh, Ước tính chi phí chi tiết, và Cảnh báo vi phạm chính sách.
- **Hệ quả cho sản phẩm:** Bắt buộc chuẩn hoá luồng Request với form có cấu trúc và tích hợp AI gợi ý Itinerary theo constraint thời gian/ngân sách.

### Theme 3: Xung đột và Rủi ro quyết toán chi phí hậu công tác (Expense Settlement Friction)
- **Bằng chứng:** Finance (P4) gặp khó khăn trong việc đối chiếu chi phí thực tế với dự toán đã được duyệt ban đầu.
- **Insight:** Khâu Expense không thể tách rời Trip Request ban đầu. Phải có cơ chế khóa (binding) chi phí thực tế với hạn mức dự toán ban đầu và luồng duyệt vượt hạn mức.
- **Hệ quả cho sản phẩm:** Cung cấp tính năng Expense Claim gắn chặt với Trip ID, tính chênh lệch tự động và bắt buộc giải trình nếu phát sinh chi phí vượt dự toán >10%.

---

## 4. Limitations của nghiên cứu
- Nghiên cứu thực hiện với mẫu đại diện (4 vai trò cốt lõi), tập trung vào các chuyến công tác nội địa doanh nghiệp quy mô vừa và nhỏ (SMB/Mid-market).
- Chưa khảo sát các trường hợp công tác quốc tế phức tạp liên quan đến đa ngoại tệ và thủ tục visa (được xác định nằm ngoài phạm vi MVP).