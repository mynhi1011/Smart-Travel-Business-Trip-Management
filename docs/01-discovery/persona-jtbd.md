# Personas & Jobs-To-Be-Done (JTBD)

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  

---

## 1. Danh sách Persona

### Persona 1: Nguyễn Văn Nam - Sales Executive (The Business Traveler)
- **Khẩu hiệu:** *"Tôi muốn chuẩn bị chuyến đi nhanh nhất để tập trung vào mục tiêu doanh số với khách hàng."*
- **Đặc điểm:** 26 tuổi, năng động, thường xuyên đi công tác các tỉnh miền Trung/miền Nam, không thành thạo các thủ tục giấy tờ hành chính phức tạp.
- **Pain points:**
  - Mất cả buổi sáng để lập lịch trình và dò tìm khách sạn phù hợp với ngân sách công ty cho phép.
  - Không biết yêu cầu công tác của mình đang nằm ở cấp duyệt nào (Manager hay Travel Admin).
  - Lo sợ bị từ chối thanh toán chi phí sau chuyến đi vì lỡ chi vượt định mức mà không biết trước.
- **Mục tiêu cốt lõi:** Tạo yêu cầu công tác trong dưới 5 phút, có lịch trình hợp lý và theo dõi được tiến độ duyệt trực tiếp.

---

### Persona 2: Trần Đình Hùng - Engineering Manager (The Line Manager / Approver)
- **Khẩu hiệu:** *"Duyệt đúng người, đúng việc, đúng ngân sách mà không làm gián đoạn tiến độ dự án."*
- **Đặc điểm:** 35 tuổi, bận rộn với các cuộc họp kỹ thuật, quản lý nhóm 14 người, cần kiểm soát ngân sách OPEX của bộ phận.
- **Pain points:**
  - Nhận quá nhiều email xin duyệt thiếu thông tin chi tiết về dự toán.
  - Không có thời gian kiểm tra lại xem chi phí khách sạn, đi lại của nhân viên có đúng quy chế công ty hay không.
- **Mục tiêu cốt lõi:** Nhìn thấy tóm tắt lý do, lịch trình, tổng chi phí dự kiến và các cảnh báo vi phạm chỉ trong 1 màn hình để ra quyết định Approve/Reject trong vòng 30 giây.

---

### Persona 3: Lê Thị Mai - Travel Coordinator (The Travel Admin)
- **Khẩu hiệu:** *"Đảm bảo 100% chuyến đi tuân thủ quy chế an toàn, chính sách công ty và tối ưu chi phí."*
- **Đặc điểm:** 29 tuổi, phụ trách quản lý hậu cần di chuyển, khách sạn và điều phối công tác cho toàn công ty.
- **Pain points:**
  - Nhân viên tự lên lịch trình không tối ưu (khách sạn quá xa nơi làm việc, chọn giờ bay đắt đỏ).
  - Phải rà soát thủ công từng dòng chi phí đối chiếu với cẩm nang chính sách dày 20 trang.
- **Mục tiêu cốt lõi:** Có công cụ tự động phát hiện vi phạm chính sách và công cụ AI hỗ trợ gợi ý lịch trình công tác hợp lý theo điểm đến và trần ngân sách.

---

### Persona 4: Phạm Thu Trang - Senior Accountant (The Finance Controller)
- **Khẩu hiệu:** *"Chính xác đến từng đồng, minh bạch chứng từ và không thất thoát ngân sách."*
- **Đặc điểm:** 32 tuổi, cẩn trọng, tuân thủ nguyên tắc tài chính doanh nghiệp.
- **Pain points:**
  - Nhân viên nộp chi phí vượt quá dự toán đã duyệt ban đầu mà không có lý do hợp lệ.
  - Mất thời gian đối chiếu từng dòng hoá đơn nộp vào với đề xuất ban đầu đã được Manager phê duyệt.
- **Mục tiêu cốt lõi:** Đối chiếu tự động bảng kê chi phí thực tế với dự toán ban đầu, phát hiện sai lệch và đóng hồ sơ quyết toán (Close Trip) nhanh chóng.

---

## 2. Jobs-To-Be-Done (JTBD) Framework

| Persona | Khi bối cảnh là... (When...) | Tôi muốn... (I want to...) | Để tôi có thể... (So that...) | Tiêu chí thành công (Success Metric) |
|---|---|---|---|---|
| **Employee** | Được chỉ định đi công tác tại tỉnh/thành phố khác | Nhập điểm đến, ngày đi/về, lý do và nhận gợi ý lịch trình cùng ngân sách hợp lệ | Gửi yêu cầu phê duyệt nhanh chóng mà không vi phạm quy chế | Tạo xong Trip Request hoàn chỉnh trong < 5 phút |
| **Manager** | Nhận được thông báo yêu cầu công tác mới của nhân viên | Xem bản tóm tắt mục đích, dự toán và các cảnh báo vi phạm policy | Ra quyết định Duyệt hoặc Từ chối kèm lý do ngay lập tức | Ra quyết định chính xác trong < 30 giây |
| **Travel Admin** | Xử lý một yêu cầu công tác đã qua duyệt cấp 1 | Hệ thống tự động kiểm tra vi phạm trần ngân sách/thời gian và sinh lịch trình tối ưu | Đảm bảo chuyến đi khả thi, an toàn và tối ưu chi phí doanh nghiệp | Phát hiện 100% các vi phạm trần chi phí |
| **Employee** | Kết thúc chuyến công tác trở về | Nhập danh sách các khoản chi thực tế và đính kèm chứng từ theo từng hạng mục | Nộp hồ sơ hoàn ứng/thanh toán mà không cần giải trình nhiều lần | Hoàn tất Expense Claim trong 1 biểu mẫu duy nhất |
| **Finance** | Nhận hồ sơ quyết toán chi phí công tác | Hệ thống tự động so sánh chi phí thực tế so với hạn mức dự toán ban đầu | Phê duyệt thanh toán chính xác hoặc yêu cầu giải trình phần chi phí vượt mức | Giảm 70% thời gian đối chiếu thủ công từng dòng chi |