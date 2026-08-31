# Business Glossary - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Mục đích:** Thống nhất định nghĩa 20 thuật ngữ cốt lõi được sử dụng xuyên suốt trong tài liệu nghiệp vụ, thiết kế hệ thống, mã nguồn và câu hỏi kiểm chuẩn (Vault Benchmark).

---

| # | Thuật ngữ (Term) | Tên Tiếng Việt | Định nghĩa chuẩn xác trong hệ thống |
|---|---|---|---|
| 1 | **Trip Request** | Yêu cầu công tác | Phiếu đề xuất đi công tác do Nhân viên khởi tạo, chứa các thông tin cơ bản: điểm đi, điểm đến, thời gian, lý do công tác và tổng dự toán chi phí. |
| 2 | **Employee (Requester)** | Nhân viên đề xuất | Người dùng hệ thống có quyền khởi tạo yêu cầu công tác, tạo lịch trình, theo dõi tiến độ và nộp báo cáo chi phí sau khi chuyến đi kết thúc. |
| 3 | **Line Manager (Approver 1)** | Quản lý trực tiếp | Cấp quản lý trực tiếp của nhân viên, chịu trách nhiệm xem xét mục đích kinh doanh và thực hiện phê duyệt/từ chối yêu cầu công tác ở Cấp 1. |
| 4 | **Travel Admin (Approver 2)** | Quản trị viên công tác | Bộ phận quản lý hành chính và điều phối công tác, chịu trách nhiệm kiểm tra tính tuân thủ quy chế công tác và duyệt Cấp 2 cho các yêu cầu đặc biệt. |
| 5 | **Finance Officer** | Kế toán thanh toán | Chuyên viên tài chính kế toán chịu trách nhiệm kiểm tra chứng từ chi phí thực tế, đối chiếu với dự toán ban đầu và hoàn tất thủ tục đóng hồ sơ chuyến đi. |
| 6 | **Travel Policy** | Chính sách công tác | Tập hợp các quy định của doanh nghiệp về tiêu chuẩn lưu trú, hạn mức phụ cấp, thời hạn nộp yêu cầu và quy trình phê duyệt công tác. |
| 7 | **Policy Violation** | Vi phạm chính sách | Trạng thái một yêu cầu công tác hoặc khoản chi tiêu vượt quá hạn mức hoặc không tuân thủ các điều kiện quy định trong Travel Policy. |
| 8 | **Estimated Budget** | Ngân sách dự toán | Tổng số tiền dự kiến chi trả cho chuyến công tác (bao gồm di chuyển, khách sạn, công tác phí và chi phí khác) được phê duyệt trước chuyến đi. |
| 9 | **Actual Expense** | Chi phí thực tế | Tổng số tiền thực tế nhân viên đã chi tiêu trong suốt chuyến công tác và có chứng từ/hóa đơn kê khai sau chuyến đi. |
| 10 | **Itinerary** | Lịch trình công tác | Kế hoạch chi tiết theo từng ngày của chuyến công tác, bao gồm thời gian, địa điểm làm việc, phương tiện di chuyển, nơi lưu trú và nội dung công việc. |
| 11 | **AI Itinerary Generator** | Trợ lý AI tạo lịch trình | Tính năng AI tự động đề xuất lịch trình phân bổ theo ngày dựa trên địa điểm, số ngày và hạn mức ngân sách của người dùng. |
| 12 | **Expense Claim** | Báo cáo thanh quyết toán chi phí | Bộ hồ sơ do nhân viên lập sau khi kết thúc chuyến đi để kê khai các khoản chi thực tế kèm chứng từ nhằm xin thanh toán hoặc hoàn ứng. |
| 13 | **Expense Item** | Khoản chi thành phần | Một dòng chi tiêu cụ thể trong Expense Claim (ví dụ: tiền phòng đêm 1, tiền vé taxi, tiền ăn trưa ngày 2). |
| 14 | **Per Diem Allowance** | Phụ cấp công tác phí | Khoản tiền khoán cố định hàng ngày mà công ty chi trả cho nhân viên để trang trải chi phí ăn uống và sinh hoạt cá nhân khi đi công tác. |
| 15 | **Approval Workflow** | Luồng phê duyệt | Trình tự các bước chuyển trạng thái của một Trip Request từ lúc khởi tạo đến khi được các cấp có thẩm quyền chấp thuận hoặc từ chối. |
| 16 | **Expense Variance** | Chênh lệch chi phí | Tỷ lệ phần trăm hoặc số tiền chênh lệch giữa Chi phí thực tế so với Ngân sách dự toán ban đầu (`Actual - Estimated`). |
| 17 | **Urgent Trip** | Chuyến đi khẩn cấp | Yêu cầu công tác được gửi trước ngày khởi hành dưới 3 ngày làm việc, bắt buộc phải có lý do giải trình đặc biệt. |
| 18 | **Audit Trail / Audit Log** | Nhật ký kiểm toán | Bản ghi dữ liệu bất biến lưu lại toàn bộ lịch sử thao tác: người thực hiện, thời gian, hành động và thay đổi trạng thái của hồ sơ. |
| 19 | **Closed Trip** | Hồ sơ chuyến đi đã đóng | Trạng thái kết thúc hoàn toàn vòng đời của một chuyến công tác sau khi Finance đã nghiệm thu chi phí; dữ liệu chuyển sang chế độ chỉ đọc. |
| 20 | **Role-Based Access Control (RBAC)** | Phân quyền theo vai trò | Cơ chế kiểm soát quyền truy cập hệ thống và các API dựa trên vai trò của người dùng (Employee, Manager, Travel Admin, Finance, Admin). |