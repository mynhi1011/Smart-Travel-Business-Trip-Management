# Requirements Inventory - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Quy ước Priority:** `Must` (Bắt buộc cho MVP) | `Should` (Quan trọng, làm nếu kịp) | `Could` (Mở rộng)  
**Quy ước Trạng thái:** `Draft` | `Confirmed` | `Superseded`

---

## 1. Functional Requirements (Yêu cầu chức năng)

| ID | Loại | Yêu cầu nghiệp vụ cụ thể | Nguồn gốc | Priority | Rationale / Cách kiểm tra | Trạng thái |
|---|---|---|---|---|---|---|
| **REQ-TR-01** | FR | Hệ thống cho phép Employee tạo mới Trip Request gồm: Điểm xuất phát, Điểm đến, Ngày đi, Ngày về, Mục đích chuyến đi, và Dự toán chi phí. | User Research P1; Charter MVP | **Must** | Employee điền form hợp lệ và submit thành công vào DB với status `SUBMITTED`. | Confirmed |
| **REQ-TR-02** | FR | Hệ thống hỗ trợ tính năng AI sinh bản nháp lịch trình (AI Itinerary Generation) chi tiết theo ngày dựa trên điểm đến, số ngày công tác và hạn mức ngân sách. | De_Tai Nhóm 11; Charter | **Must** | Gửi payload `{destination, days, budget}` → AI trả về danh sách hoạt động, khách sạn gợi ý trong giới hạn chi phí. | Confirmed |
| **REQ-TR-03** | FR | Hệ thống tự động kiểm tra vi phạm chính sách (Policy Check engine) trước khi submit và hiển thị nhãn cảnh báo vi phạm (VD: vượt trần khách sạn, nộp muộn <3 ngày). | User Research P3; BR-TR-01..04 | **Must** | Request vi phạm hiển thị cảnh báo đỏ/vàng trên giao diện tạo và màn hình duyệt. | Confirmed |
| **REQ-TR-04** | FR | Hệ thống chuyển Trip Request đến Manager trực tiếp của Employee để phê duyệt (Cấp 1). Manager có thể Approve hoặc Reject kèm lý do bắt buộc. | Charter Workflow; User Research P2 | **Must** | Manager đăng nhập thấy danh sách chờ duyệt; bấm Approve chuyển status `APPROVED_MANAGER`, Reject chuyển `REJECTED`. | Confirmed |
| **REQ-TR-05** | FR | Hệ thống hỗ trợ định tuyến phê duyệt Cấp 2 (Travel Admin / Director) tự động nếu tổng ngân sách dự kiến > 20.000.000 VNĐ hoặc có vi phạm Policy nghiêm trọng. | BR-TR-04; User Research P2, P3 | **Must** | Request có dự toán >20M sau khi Manager duyệt sẽ chuyển sang `PENDING_ADMIN_APPROVAL` thay vì Approved ngay. | Confirmed |
| **REQ-TR-06** | FR | Hệ thống cho phép Employee xem và chỉnh sửa các mốc trong Lịch trình chi tiết (Itinerary Builder) trước khi chuyến đi diễn ra. | Charter Workflow; User Research P1 | **Must** | Thêm/sửa/xóa các item trong lịch trình: ngày giờ, địa điểm làm việc, phương tiện di chuyển, lưu trú. | Confirmed |
| **REQ-TR-07** | FR | Hệ thống cho phép Employee tạo và nộp Báo cáo chi phí (Expense Claim) sau chuyến đi, gắn trực tiếp với Trip Request đã được duyệt. | Charter Workflow; User Research P4 | **Must** | Form Expense cho phép nhập từng khoản chi: Ngày chi, Danh mục, Số tiền, Mô tả chứng từ, Đính kèm biên nhận (mock). | Confirmed |
| **REQ-TR-08** | FR | Hệ thống tự động tính tổng chi phí thực tế và so sánh độ lệch chênh lệch (Variance) giữa Dự toán ban đầu và Chi phí thực tế. | User Research P4; BR-TR-05 | **Must** | Hiển thị bảng so sánh chi tiết: `Dự toán` vs `Thực tế` vs `Chênh lệch (+/- %)`. | Confirmed |
| **REQ-TR-09** | FR | Hệ thống cho phép Finance duyệt chi phí thực tế, yêu cầu giải trình nếu chi phí vượt mức dự toán >10%, và thực hiện Đóng hồ sơ (Close Trip). | Charter Workflow; User Research P4 | **Must** | Finance bấm "Approve Expense & Close" → Trip Request chuyển sang status `CLOSED`. | Confirmed |
| **REQ-TR-10** | FR | Hệ thống cung cấp Dashboard theo vai trò (Role-based Dashboard) hiển thị danh sách chuyến đi theo trạng thái (Draft, Pending, Approved, Ongoing, Settling, Closed). | Charter MVP | **Must** | Mỗi role (Employee, Manager, Travel Admin, Finance) hiển thị đúng widget và bộ lọc trạng thái tương ứng. | Confirmed |
| **REQ-TR-11** | FR | Hệ thống gửi thông báo nội bộ (In-app Notification) cho người dùng khi trạng thái Trip Request hoặc Expense Claim thay đổi. | User Research P1, P2 | **Should** | Có icon chuông thông báo và danh sách thông báo khi có hành động Approve/Reject. | Confirmed |
| **REQ-TR-12** | FR | Hệ thống cho phép xuất file tóm tắt chi phí và lịch trình chuyến công tác dưới dạng PDF/báo cáo in ấn phục vụ lưu trữ kế toán. | User Research P4 | **Should** | Bấm Export PDF tải về file tóm tắt đầy đủ thông tin chuyến đi và chi phí. | Confirmed |

---

## 2. Non-Functional Requirements (Yêu cầu phi chức năng)

| ID | Loại | Tiêu chí kỹ thuật đo lường cụ thể | Nguồn gốc | Priority | Rationale / Cách kiểm tra | Trạng thái |
|---|---|---|---|---|---|---|
| **NFR-TR-01** | NFR | **Response Time:** Thời gian phản hồi của các API CRUD cơ bản (tạo request, duyệt, nộp chi phí) phải ≤ 1.0 giây với điều kiện mạng chuẩn. | Giáo trình Chuẩn NFR | **Must** | Kiểm thử bằng công cụ API testing (Postman/Bruno) với 95% request đạt ngưỡng. | Confirmed |
| **NFR-TR-02** | NFR | **AI Generation Latency:** Thời gian sinh lịch trình nháp từ AI Service phải ≤ 5.0 giây; giao diện có trạng thái Loading/Skeleton trực quan. | Giáo trình Chuẩn NFR | **Must** | Đo thời gian từ khi bấm "Generate AI Itinerary" đến khi render kết quả. | Confirmed |
| **NFR-TR-03** | NFR | **Role-Based Access Control (RBAC):** Bảo vệ toàn bộ endpoint backend theo đúng vai trò; tuyệt đối không cho Employee truy cập API duyệt của Manager/Finance (HTTP 403 Forbidden). | Giáo trình NFR Security | **Must** | Automated test gửi request với JWT token của Employee vào endpoint `/api/admin/*` nhận về HTTP 403. | Confirmed |
| **NFR-TR-04** | NFR | **Audit Logging:** Toàn bộ các thao tác tạo request, duyệt, từ chối, thay đổi ngân sách và đóng hồ sơ phải được ghi log kèm `user_id`, `timestamp`, `action`, `previous_state`, `new_state`. | Giáo trình NFR Audit | **Must** | Kiểm tra bảng `audit_logs` có bản ghi tương ứng sau mỗi mutation nhạy cảm. | Confirmed |
| **NFR-TR-05** | NFR | **Data Integrity & Consistency:** Dữ liệu tiền tệ và trạng thái chuyển đổi quy trình phải được xử lý bên trong Database Transaction nguyên tử, chống race condition. | Giáo trình NFR Reliability | **Must** | Hai thao tác duyệt/sửa đồng thời trên cùng một request không gây sai lệch dữ liệu trạng thái. | Confirmed |
| **NFR-TR-06** | NFR | **Usability & Accessibility:** Giao diện tương thích hoàn toàn trên trình duyệt máy tính để bàn (Desktop Web) độ phân giải từ 1280x720 trở lên; hỗ trợ phím tắt và thông báo lỗi rõ ràng. | Giáo trình Chuẩn UX | **Should** | Đạt chuẩn tương phản màu sắc và không có lỗi vỡ layout khi thao tác. | Confirmed |

---

## 3. Scope Boundaries (Phạm vi dự án)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MVP SCOPE (MUST)                               │
│  • Tạo & quản lý vòng đời Trip Request (Draft -> Submitted -> Closed)        │
│  • Phê duyệt đa cấp phân quyền (Employee -> Manager -> Travel Admin)        │
│  • AI sinh lịch trình theo constraint & Engine kiểm tra Policy Violation     │
│  • Kê khai chi phí thực tế (Expense Claim) & Finance đối chiếu quyết toán   │
│  • Role-based Dashboard & Audit Trail                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► SHOULD: In-app Notification, Export PDF Summary Report
         │
         └──► OUT OF SCOPE:
              • Tích hợp API đặt vé máy bay / phòng khách sạn thật (Agoda, Sabre,...)
              • Tích hợp Cổng thanh toán trực tuyến thật (VNPay, Stripe, Momo)
              • Tích hợp hệ thống ERP kế toán doanh nghiệp lớn (SAP, Oracle)
              • Ứng dụng di động Native (Android/iOS riêng biệt)
              • Hỗ trợ đa ngôn ngữ và tính toán tỷ giá ngoại tệ thời gian thực
```