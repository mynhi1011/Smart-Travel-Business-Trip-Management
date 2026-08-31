# User Stories & Acceptance Criteria - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Tài liệu tham chiếu:** `requirements.md`, `business-rules.md`, `persona-jtbd.md`, `PRD.md`, `user-flow.mmd`

---

## Danh sách User Stories theo Luồng Nghiệp Vụ

### [US-01] Khởi tạo Trip Request cơ bản
- **User Story:** Là **Nguyễn Văn Nam (Employee)**, tôi muốn nhập thông tin chuyến đi (điểm đi, điểm đến, ngày đi, ngày về, mục đích và tổng dự toán) để tạo một yêu cầu công tác mới dưới dạng bản nháp.
- **Requirement gốc:** `REQ-TR-01`
- **Business Rule liên quan:** `BR-TR-02`, `BR-TR-03`
- **Acceptance Criteria:**
  - **AC 1.1 (Happy path - Tạo yêu cầu thông thường):**  
    *Given* Employee đã đăng nhập vào hệ thống  
    *When* Employee nhập đầy đủ Điểm xuất phát, Điểm đến, Ngày đi, Ngày về, Lý do công tác và Dự toán chi phí với ngày khởi hành cách ngày hiện tại ≥ 3 ngày làm việc (tuân thủ `BR-TR-03`)  
    *Then* Hệ thống lưu Trip Request với trạng thái `DRAFT` và cấp mã định danh chuyến đi.
  - **AC 1.2 (Kiểm tra phụ cấp Per Diem tự động):**  
    *Given* Employee đang lập dự toán cho mục phụ cấp cá nhân  
    *When* Employee chọn điểm đến là Đô thị loại 1 (Hà Nội, TP.HCM, Đà Nẵng) hoặc tỉnh thành khác  
    *Then* Hệ thống tự động tính hạn mức `Max_Per_Diem = Số ngày * Mức khoán` (400.000 VNĐ/ngày với Đô thị loại 1 hoặc 300.000 VNĐ/ngày với tỉnh khác theo `BR-TR-02`) và cảnh báo nếu mục phụ cấp nhập vượt công thức này.
  - **AC 1.3 (Xử lý chuyến đi khẩn cấp):**  
    *Given* Employee tạo yêu cầu công tác có ngày khởi hành < 3 ngày làm việc so với ngày tạo  
    *When* Employee bấm lưu/tiếp tục  
    *Then* Hệ thống bắt buộc Employee tích chọn "Chuyến đi khẩn cấp", nhập lý do khẩn cấp và gắn cờ cảnh báo `URGENT_TRIP_NOTICE` (theo `BR-TR-03`).

---

### [US-02] AI sinh gợi ý lịch trình công tác theo ràng buộc
- **User Story:** Là **Nguyễn Văn Nam (Employee)**, tôi muốn trợ lý AI tự động đề xuất lịch trình nháp theo ngày dựa trên điểm đến và ngân sách để tiết kiệm thời gian lập kế hoạch.
- **Requirement gốc:** `REQ-TR-02`
- **Business Rule liên quan:** `BR-TR-07`
- **Acceptance Criteria:**
  - **AC 2.1 (Sinh lịch trình hợp lệ):**  
    *Given* Trip Request đã có thông tin Điểm đến, Số ngày công tác và Tổng ngân sách  
    *When* Employee nhấn nút "Tạo lịch trình bằng AI"  
    *Then* Hệ thống gửi payload `{destination, days, budget}` sang AI Service và hiển thị danh sách hoạt động phân bổ theo từng ngày (buổi sáng, buổi chiều, buổi tối, gợi ý khách sạn) với tổng chi phí ước tính ≤ tổng ngân sách ban đầu (tuân thủ `BR-TR-07`).
  - **AC 2.2 (Guardrail chặn AI vượt ngân sách):**  
    *Given* AI Service sinh ra lịch trình có tổng chi phí ước tính vượt quá ngân sách Employee đã nhập  
    *When* Hệ thống thực hiện kiểm tra server-side validation  
    *Then* Hệ thống từ chối áp dụng bản nháp đó, thông báo "Lịch trình gợi ý vượt ngân sách cho phép, đang điều chỉnh lại" và yêu cầu AI tái phân bổ theo đúng `BR-TR-07`.

---

### [US-03] Xem và tùy chỉnh chi tiết Lịch trình công tác
- **User Story:** Là **Nguyễn Văn Nam (Employee)**, tôi muốn tự do xem, thêm, sửa, xóa các mốc hoạt động trong lịch trình để phù hợp với lịch làm việc thực tế với đối tác.
- **Requirement gốc:** `REQ-TR-06`
- **Business Rule liên quan:** `BR-TR-01`
- **Acceptance Criteria:**
  - **AC 3.1 (Tùy chỉnh hoạt động lịch trình):**  
    *Given* Lịch trình đang ở trạng thái bản nháp (do AI sinh ra hoặc tự nhập)  
    *When* Employee thực hiện thêm mốc làm việc mới, sửa giờ họp hoặc xóa một địa điểm di chuyển  
    *Then* Hệ thống cập nhật bảng lịch trình chi tiết theo từng ngày và tính toán lại tổng dự toán tương ứng.
  - **AC 3.2 (Kiểm soát chi phí lưu trú khi sửa lịch trình):**  
    *Given* Employee nhập hoặc sửa chi phí khách sạn cho 1 đêm  
    *When* Chi phí khách sạn nhập vào vượt quá hạn mức theo cấp bậc của Employee (Staff: 1.000.000 VNĐ/đêm, Manager: 1.800.000 VNĐ/đêm theo `BR-TR-01`)  
    *Then* Hệ thống hiển thị cảnh báo vi phạm hạn mức lưu trú và yêu cầu nhập giải trình trước khi cho phép xác nhận lịch trình.

---

### [US-04] Tự động kiểm tra vi phạm chính sách công tác (Policy Check)
- **User Story:** Là **Nguyễn Văn Nam (Employee)** hoặc **Lê Thị Mai (Travel Admin)**, tôi muốn hệ thống tự động kiểm tra vi phạm chính sách trước khi nộp để phát hiện sớm các điểm không hợp lệ.
- **Requirement gốc:** `REQ-TR-03`
- **Business Rule liên quan:** `BR-TR-01`, `BR-TR-02`, `BR-TR-03`, `BR-TR-04`
- **Acceptance Criteria:**
  - **AC 4.1 (Kiểm tra hợp lệ - Không vi phạm):**  
    *Given* Trip Request và Itinerary thỏa mãn toàn bộ hạn mức lưu trú (`BR-TR-01`), phụ cấp (`BR-TR-02`) và thời hạn gửi (`BR-TR-03`)  
    *When* Hệ thống chạy Policy Check engine  
    *Then* Giao diện hiển thị nhãn "Policy Check: Pass" màu xanh và cho phép nộp yêu cầu trình duyệt.
  - **AC 4.2 (Phát hiện vi phạm chính sách):**  
    *Given* Trip Request có ít nhất 1 vi phạm (khách sạn vượt trần hoặc gửi muộn < 3 ngày)  
    *When* Hệ thống thực hiện Policy Check  
    *Then* Giao diện hiển thị cờ cảnh báo đỏ/vàng `POLICY_VIOLATION_*`, bắt buộc nhập lý do giải trình và đánh dấu request này thuộc diện cần duyệt Cấp 2 theo `BR-TR-04`.

---

### [US-05] Quản lý trực tiếp phê duyệt yêu cầu công tác (Cấp 1)
- **User Story:** Là **Trần Đình Hùng (Line Manager)**, tôi muốn xem xét tóm tắt mục đích, dự toán, lịch trình và kết quả kiểm tra chính sách để phê duyệt hoặc từ chối yêu cầu của nhân viên.
- **Requirement gốc:** `REQ-TR-04`
- **Business Rule liên quan:** `BR-TR-04`
- **Acceptance Criteria:**
  - **AC 5.1 (Manager Approve yêu cầu chuẩn ≤ 20 triệu):**  
    *Given* Trip Request có trạng thái `SUBMITTED`, tổng dự toán ≤ 20.000.000 VNĐ và không có vi phạm policy  
    *When* Manager bấm "Approve"  
    *Then* Hệ thống cập nhật trạng thái chuyến đi thành `APPROVED` (theo `BR-TR-04`), sẵn sàng để nhân viên khởi hành.
  - **AC 5.2 (Manager Approve yêu cầu > 20 triệu hoặc có vi phạm Policy):**  
    *Given* Trip Request có tổng dự toán > 20.000.000 VNĐ hoặc có cờ cảnh báo vi phạm policy  
    *When* Manager bấm "Approve"  
    *Then* Hệ thống chuyển trạng thái sang `PENDING_ADMIN_APPROVAL` để chuyển tiếp lên Cấp 2 theo `BR-TR-04`.
  - **AC 5.3 (Manager Reject yêu cầu):**  
    *Given* Trip Request đang chờ duyệt  
    *When* Manager bấm "Reject" và nhập lý do từ chối  
    *Then* Hệ thống chuyển trạng thái thành `REJECTED`, lưu lý do từ chối vào audit trail và đóng yêu cầu.

---

### [US-06] Travel Admin phê duyệt Cấp 2 và phát hành chuyến đi
- **User Story:** Là **Lê Thị Mai (Travel Coordinator / Travel Admin)**, tôi muốn thẩm định các yêu cầu công tác vượt ngân sách hoặc vi phạm chính sách để quyết định phê duyệt cấp 2 và phát hành chuyến đi.
- **Requirement gốc:** `REQ-TR-05`
- **Business Rule liên quan:** `BR-TR-04`
- **Acceptance Criteria:**
  - **AC 6.1 (Travel Admin Approve Cấp 2):**  
    *Given* Trip Request đang ở trạng thái `PENDING_ADMIN_APPROVAL`  
    *When* Travel Admin kiểm tra tính khả thi của lịch trình và bấm "Approve Cấp 2"  
    *Then* Hệ thống chuyển trạng thái sang `APPROVED`, phát hành chuyến đi chính thức và cho phép Employee bước vào giai đoạn thực hiện chuyến đi.
  - **AC 6.2 (Travel Admin Reject Cấp 2):**  
    *Given* Trip Request đang ở trạng thái `PENDING_ADMIN_APPROVAL`  
    *When* Travel Admin bấm "Reject" kèm lý do không khả thi/vượt ngân sách không hợp lý  
    *Then* Hệ thống chuyển trạng thái sang `REJECTED` và ghi nhận lịch sử xử lý.

---

### [US-07] Lập và nộp Báo cáo chi phí công tác (Expense Claim)
- **User Story:** Là **Nguyễn Văn Nam (Employee)**, tôi muốn kê khai các khoản chi thực tế và đính kèm biên nhận sau chuyến đi để xin thanh quyết toán.
- **Requirement gốc:** `REQ-TR-07`, `REQ-TR-08`
- **Business Rule liên quan:** `BR-TR-05`
- **Acceptance Criteria:**
  - **AC 7.1 (Kê khai các mục chi phí):**  
    *Given* Chuyến đi đã được duyệt (`APPROVED`) và hoàn thành  
    *When* Employee mở form Expense Claim và thêm các Expense Item (Ngày chi, Danh mục chi, Số tiền, Mô tả chứng từ, Đính kèm biên nhận mock)  
    *Then* Hệ thống lưu danh sách chi phí gắn chặt với `trip_id` tương ứng.
  - **AC 7.2 (Tự động tính chênh lệch Variance):**  
    *Given* Danh sách Expense Items đã được nhập  
    *When* Employee xem bảng tổng hợp trước khi nộp  
    *Then* Hệ thống tự động tính `Tổng chi thực tế`, hiển thị bảng đối chiếu `Dự toán ban đầu` vs `Thực tế` và tỷ lệ chênh lệch `% Variance` (theo `REQ-TR-08`).
  - **AC 7.3 (Yêu cầu giải trình khi chi phí vượt dự toán ≤ 10%):**  
    *Given* Tổng chi phí thực tế vượt tổng dự toán ban đầu ở mức ≤ 10%  
    *When* Employee bấm nộp Expense Claim  
    *Then* Hệ thống yêu cầu nhập lý do giải trình phát sinh trước khi chuyển trạng thái sang `EXPENSE_SUBMITTED` (theo `BR-TR-05`).

---

### [US-08] Finance đối chiếu, duyệt quyết toán và Đóng hồ sơ công tác (Close Trip)
- **User Story:** Là **Phạm Thu Trang (Finance Officer)**, tôi muốn kiểm tra đối chiếu chi phí thực tế với dự toán ban đầu và đóng hồ sơ quyết toán chuyến đi.
- **Requirement gốc:** `REQ-TR-09`
- **Business Rule liên quan:** `BR-TR-05`, `BR-TR-06`
- **Acceptance Criteria:**
  - **AC 8.1 (Finance duyệt chi phí hợp lệ & Đóng hồ sơ):**  
    *Given* Expense Claim có tổng chi thực tế ≤ tổng dự toán (hoặc vượt ≤10% có giải trình hợp lệ)  
    *When* Finance kiểm tra chứng từ hợp lệ và bấm "Approve Expense & Close"  
    *Then* Hệ thống chuyển trạng thái chuyến đi sang `CLOSED` và toàn bộ hồ sơ trở thành dữ liệu chỉ đọc bất biến (tuân thủ `BR-TR-06`).
  - **AC 8.2 (Xử lý chi phí vượt trần > 10%):**  
    *Given* Expense Claim có tổng chi phí thực tế vượt dự toán ban đầu > 10%  
    *When* Finance xem xét hồ sơ  
    *Then* Nút Approve của Finance bị vô hiệu hóa; hệ thống bắt buộc chuyển yêu cầu về cho Manager phê duyệt bổ sung phần ngân sách vượt mức trước khi cho phép Finance đóng hồ sơ (theo `BR-TR-05`).
  - **AC 8.3 (Yêu cầu điều chỉnh / Từ chối chứng từ):**  
    *Given* Chứng từ hoặc chi phí không hợp lệ  
    *When* Finance bấm "Yêu cầu giải trình / Điều chỉnh"  
    *Then* Hồ sơ chuyển về trạng thái `EXPENSE_REJECTED` để Employee bổ sung lại.

---

### [US-09] Theo dõi trạng thái chuyến đi qua Dashboard theo vai trò
- **User Story:** Là bất kỳ người dùng nào (**Employee**, **Manager**, **Travel Admin**, **Finance**), tôi muốn xem Dashboard phân quyền hiển thị danh sách các chuyến đi theo trạng thái để nắm bắt tiến độ công việc.
- **Requirement gốc:** `REQ-TR-10`
- **Business Rule liên quan:** `BR-TR-06`
- **Acceptance Criteria:**
  - **AC 9.1 (Dashboard của Employee):**  
    *Given* Employee đăng nhập  
    *When* Truy cập trang chủ/Dashboard  
    *Then* Hệ thống hiển thị danh sách các chuyến đi cá nhân phân theo tab trạng thái (`Draft`, `Submitted`, `Approved`, `Ongoing`, `Settling`, `Closed`).
  - **AC 9.2 (Dashboard của Approvers - Manager/Admin/Finance):**  
    *Given* Manager / Travel Admin / Finance đăng nhập  
    *When* Truy cập trang chủ/Dashboard  
    *Then* Hệ thống hiển thị widget danh sách các yêu cầu đang chờ mình xử lý (`Pending My Approval` / `Pending Settlement`) kèm bộ lọc tìm kiếm nhanh theo nhân viên, ngày tháng, trạng thái.

---

### [US-10] Thông báo trạng thái nội bộ và Xuất báo cáo PDF
- **User Story:** Là **Người dùng hệ thống**, tôi muốn nhận thông báo khi trạng thái chuyến đi thay đổi và có thể xuất báo cáo PDF tóm tắt chuyến công tác để phục vụ lưu trữ kế toán.
- **Requirement gốc:** `REQ-TR-11`, `REQ-TR-12`
- **Business Rule liên quan:** `BR-TR-06`
- **Acceptance Criteria:**
  - **AC 10.1 (Thông báo In-app khi trạng thái thay đổi):**  
    *Given* Trip Request hoặc Expense Claim được Approve hoặc Reject  
    *When* Hành động xử lý hoàn tất  
    *Then* Hệ thống tự động tạo thông báo in-app gửi đến Employee/Manager liên quan và hiển thị số đếm trên icon chuông thông báo (theo `REQ-TR-11`).
  - **AC 10.2 (Xuất báo cáo PDF chuyến công tác):**  
    *Given* Chuyến đi ở trạng thái `APPROVED` hoặc `CLOSED`  
    *When* Người dùng bấm nút "Export PDF Summary"  
    *Then* Hệ thống tải xuống file PDF định dạng chuẩn chứa đầy đủ: Thông tin nhân viên, Lịch trình chi tiết, Bảng kê chi phí đối chiếu và Lịch sử phê duyệt (theo `REQ-TR-12`).

---

## Bảng Ma Trận Truy Vết (Traceability Matrix)

| Story ID | Tên User Story | REQ-ID liên quan | Business Rule (BR-ID) | Priority |
|---|---|---|---|---|
| **US-01** | Khởi tạo Trip Request cơ bản | `REQ-TR-01` | `BR-TR-02`, `BR-TR-03` | Must |
| **US-02** | AI sinh gợi ý lịch trình công tác theo ràng buộc | `REQ-TR-02` | `BR-TR-07` | Must |
| **US-03** | Xem và tùy chỉnh chi tiết Lịch trình công tác | `REQ-TR-06` | `BR-TR-01` | Must |
| **US-04** | Tự động kiểm tra vi phạm chính sách công tác | `REQ-TR-03` | `BR-TR-01`, `BR-TR-02`, `BR-TR-03`, `BR-TR-04` | Must |
| **US-05** | Quản lý trực tiếp phê duyệt yêu cầu (Cấp 1) | `REQ-TR-04` | `BR-TR-04` | Must |
| **US-06** | Travel Admin phê duyệt Cấp 2 và phát hành chuyến đi | `REQ-TR-05` | `BR-TR-04` | Must |
| **US-07** | Lập và nộp Báo cáo chi phí (Expense Claim) | `REQ-TR-07`, `REQ-TR-08` | `BR-TR-05` | Must |
| **US-08** | Finance đối chiếu chi phí và Đóng hồ sơ (Close Trip) | `REQ-TR-09` | `BR-TR-05`, `BR-TR-06` | Must |
| **US-09** | Theo dõi trạng thái chuyến đi qua Dashboard theo vai trò | `REQ-TR-10` | `BR-TR-06` | Must |
| **US-10** | Thông báo trạng thái nội bộ và Xuất báo cáo PDF | `REQ-TR-11`, `REQ-TR-12` | `BR-TR-06` | Should |

---

## Kiểm Tra Độ Phủ (Coverage & Orphan Check)
- **Functional Requirements Covered:** 12/12 (`REQ-TR-01` đến `REQ-TR-12` - Đạt 100%). Không có requirement mồ côi (No Orphan Requirements).
- **Business Rules Covered:** 7/7 (`BR-TR-01` đến `BR-TR-07` - Đạt 100%). Toàn bộ rules đều được cài cắm trực tiếp vào Acceptance Criteria.