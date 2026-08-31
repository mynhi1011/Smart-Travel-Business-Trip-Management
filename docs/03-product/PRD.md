

# **1**           **OVERVIEW**

## **1.1**       **Purpose**

Tài liệu Product Requirements Document (PRD) này được xây dựng nhằm mô tả đầy đủ mục tiêu sản phẩm, phạm vi, đối tượng người dùng, luồng nghiệp vụ và yêu cầu phi chức năng của Hệ thống Smart Travel & Business Trip Management, làm nguồn tham chiếu chung cho toàn bộ nhóm khi thiết kế, triển khai và kiểm thử sản phẩm.

Mục đích của tài liệu là:

* Trình bày rõ vấn đề nghiệp vụ (business objectives) mà hệ thống hướng tới giải quyết, dựa trên kết quả user research.
* Xác định phạm vi sản phẩm (scope), đối tượng người dùng và các chức năng chính cần xây dựng.
* Làm cầu nối giữa yêu cầu nghiệp vụ (`requirements.md`, `business-rules.md`) và các artifact triển khai chi tiết hơn (`user-stories.md`, `architecture.md`), giúp cả nhóm có cùng cách hiểu về sản phẩm trước khi bắt tay vào thiết kế/code.
* Là nguồn tham chiếu xuyên suốt vòng đời dự án, có thể cập nhật khi yêu cầu thay đổi (ghi lại thay đổi trong `decision-log.md`).

> Chi tiết Acceptance Criteria cho từng chức năng được tách riêng vào tài liệu [`user-stories.md`](user-stories.md) để dễ quản lý theo từng User Story — xem mục 2.1 và 3 bên dưới để biết cách 2 tài liệu liên kết với nhau.

## **1.2**       **Business objectives**

Quy trình quản lý công tác hiện tại chủ yếu được thực hiện thông qua email, chat và excel. Thông tin về yêu cầu công tác, ngân sách, chính sách và tình trạng phê duyệt bị phân tán giữa nhiều kênh, dẫn đến việc xử lý thiếu nhất quán và mất nhiều thời gian. Kết quả nghiên cứu người dùng xác định 4 vấn đề chính cần được giải quyết.

1. Thiếu minh bạch về chính sách và hạn mức 

   Nhân viên chưa được cung cấp thông tin đầy đủ về hạn mức chi phí và các chính sách áp dụng tại thời điểm tạo yêu cầu. Điều này dẫn đến việc:

* Khó xác định chi phí phù hợp với quy định.  
* Phát sinh yêu cầu vượt hạn mức.  
* Tăng khả năng chi phí bị từ chối khi quyết toán.  
* Nhân viên điều phối công tác phải thực hiện kiểm tra thủ công.   
2. Quy trình phê duyệt thiếu thông tin tập trung 

   Quản lý thường tiếp nhận yêu cầu công tác thông qua nhiều kênh khác nhau và không phải lúc nào cũng có đầy đủ thông tin cần thiết để đưa ra quyết định. Các thông tin thường thiếu bao gồm: 

* Mục đích chuyến đi.  
* Lịch trình.  
* Dự toán chi phí.  
* Thông tin ngân sách.  
* Tình trạng tuân thủ chính sách.  
3. Lập và kiểm tra lịch trình mất nhiều thời gian 

   Nhân viên phải tự tổng hợp thông tin về điểm đến, thời gian, địa điểm làm việc, khách sạn và ngân sách để xây dựng lịch trình. Nhân viên điều phối công tác sau đó phải kiểm tra lại tính phù hợp của lịch trình và mức chi phí.

4. Đối chiếu chi phí sau chuyến đi còn thủ công

   Chi phí thực tế chưa được liên kết chặt chẽ với yêu cầu và ngân sách đã được phê duyệt. Bộ phận tài chính phải thực hiện đối chiếu giữa yêu cầu công tác, ngân sách được duyệt, chi phí thực tế và chứng từ, làm tăng thời gian xử lý và nguy cơ phát sinh sai lệch. 

Từ các vấn đề trên, dự án Smart Travel & Business Trip Management được đề xuất nhằm xây dựng một nền tảng quản lý tập trung, kết nối các bên tham gia trong toàn bộ quy trình công tác, bao gồm nhân viên, quản lý, nhân viên điều phối công tác và bộ phận tài chính.

Mục tiêu cuối cùng là giúp người dùng hiểu rõ yêu cầu đang ở trạng thái nào, cần thực hiện hành động gì tiếp theo và cơ sở nào dẫn đến quyết định xử lý yêu cầu, từ đó giảm thời gian xử lý, hạn chế sai sót và nâng cao khả năng kiểm soát chi phí công tác. 

## **1.3**       **Scope**

- ### **Organization Scope:** Hệ thống được định hướng sử dụng trong môi trường doanh nghiệp, tập trung vào quy trình quản lý các chuyến công tác nội địa. Phạm vi tổ chức bao gồm các bộ phận và vai trò tham gia vào quy trình nhân viên có nhu cầu đi công tác, quản lý phụ trách phê duyệt yêu cầu, nhân viên điều phối công tác phụ trách kiểm tra chính sách và hỗ trợ điều phối, bộ phận tài chính phụ trách kiểm tra, đối chiếu và quyết toán chi phí. 

- ### **User Scope:** Tài liệu Acceptance Criteria áp dụng cho các đối tượng:

* **Nhân viên (Employee):** tạo và gửi yêu cầu công tác, theo dõi trạng thái yêu cầu, thêm/xem/chỉnh sửa/ xóa lịch trình, lập yêu cầu thanh toán chi phí.  
* **Quản lý (Manager):** xem yêu cầu công tác cần phê duyệt, phê duyệt hoặc từ chối yêu cầu.  
* **Nhân viên điều phối công tác (Travel Admin):** xem yêu cầu công tác, phê duyệt cấp 2\.  
* **Bộ phận tài chính (Finance):** xem chi phí, đóng hồ sơ.

- ### **Functional Scope**

* Trip Request Management   
* Policy Check   
* Approval Management   
* Itinerary Management   
* Trip Management   
* Expense Management   
* Trip Closing 

- ### **Integration Scope:** Hiện tại chưa bao gồm tích hợp với hệ thống bên ngoài (third-party systems).

- ### **Included Design Artifacts:** Tài liệu này có bao gồm các thành phần hỗ trợ phân tích và thiết kế, cụ thể:

* User Flow   
* Database Design   
* Screenflow  
* Design System

- ### **Out of Scope**

* Tích hợp API đặt vé máy bay / phòng khách sạn thật (Agoda, Sabre,...)  
* Tích hợp Cổng thanh toán trực tuyến thật (VNPay, Stripe, Momo)  
* Tích hợp hệ thống ERP kế toán doanh nghiệp lớn (SAP, Oracle)  
* Ứng dụng di động Native (Android/iOS riêng biệt)  
* Hỗ trợ đa ngôn ngữ và tính toán tỷ giá ngoại tệ thời gian thực

# **2**           **OVERALL DESCRIPTION**

## **2.1**       **User stories**

Toàn bộ 10 User Stories (US-01 đến US-10) được viết chi tiết trong [`user-stories.md`](user-stories.md), tách theo 4 nhóm nghiệp vụ chính:

| Nhóm | User Stories |
|---|---|
| Trip Request & Itinerary | US-01, US-02, US-03 |
| Policy Check & Approval Workflow | US-04, US-05, US-06 |
| Expense Settlement & Trip Closure | US-07, US-08 |
| Dashboard & Notification | US-09, US-10 |

Mỗi story bám theo đúng 1 hoặc nhiều Functional Requirement trong [`requirements.md`](../02-vault/02-requirements/requirements.md) và lồng ghép các Business Rule liên quan trong [`business-rules.md`](../02-vault/03-domain/business-rules.md) vào Acceptance Criteria — xem bảng Traceability Matrix ở cuối `user-stories.md`.

## **2.2**       **User workflow**

Luồng nghiệp vụ tổng thể (Trip Request → Policy Check → Approval → Itinerary → Trip → Expense → Close) được minh hoạ chi tiết trong sơ đồ [`user-flow.mmd`](../03-product/user-flow.mmd) (định dạng Mermaid flowchart). Điểm mấu chốt của luồng:

* Request có vi phạm Policy vẫn được gửi duyệt (kèm cờ cảnh báo), không bị chặn lại để sửa trước — theo `BR-TR-04`.
* Sau khi Manager duyệt, hệ thống tự động rẽ nhánh: nếu ngân sách ≤ 20 triệu và không vi phạm → phát hành chuyến đi ngay (1 cấp duyệt); ngược lại → chuyển tiếp Travel Admin duyệt Cấp 2.

# **3**           **ACCEPTANCE CRITERIA**

Acceptance Criteria cho từng User Story được viết đầy đủ theo định dạng Given/When/Then trong [`user-stories.md`](user-stories.md) (mục "Acceptance Criteria" của từng story). Tài liệu PRD này không lặp lại nội dung AC để tránh 2 nguồn dữ liệu (single source of truth), chỉ tham chiếu sang.

# **4**           **NON-FUNCTIONAL REQUIREMENTS**

## **4.1**       **Performance requirements**

| ID | Non-functional requirements |
| ----- | ----- |
| NFR-01 | Thời gian phản hồi của các API CRUD cơ bản (tạo request, duyệt, nộp chi phí) phải ≤ 1.0 giây với điều kiện mạng chuẩn. |
| NFR-02 | Thời gian sinh lịch trình nháp từ AI Service phải ≤ 5.0 giây; giao diện có trạng thái Loading/Skeleton trực quan. |
| NFR-03 | Bảo vệ toàn bộ endpoint backend theo đúng vai trò; tuyệt đối không cho Employee truy cập API duyệt của Manager/Finance (HTTP 403 Forbidden). |
| NFR-04 | Toàn bộ các thao tác tạo request, duyệt, từ chối, thay đổi ngân sách và đóng hồ sơ phải được ghi log kèm \`user\_id\`, \`timestamp\`, \`action\`, \`previous\_state\`, \`new\_state\`. |
| NFR-05 | Dữ liệu tiền tệ và trạng thái chuyển đổi quy trình phải được xử lý bên trong Database Transaction nguyên tử, chống race condition. |
| NFR-06 | iao diện tương thích hoàn toàn trên trình duyệt máy tính để bàn (Desktop Web) độ phân giải từ 1280x720 trở lên; hỗ trợ phím tắt và thông báo lỗi rõ ràng. |

 **4.2**       **Supportability requirements**

| ID | Non-functional requirements |
| ----- | ----- |
| NFR-01 | Hệ thống dễ bảo trì, cho phép cập nhật và sửa lỗi mà không ảnh hưởng đến toàn bộ hệ thống. |
| NFR-02 | Hệ thống có khả năng mở rộng (scalable) khi số lượng người dùng tăng. |

# **5**           **SCREEN SPECIFICATION**

## **5.1**       **Screen flow**

Screen flow chi tiết (wireframe/click-through) được xây dựng trong Prototype (xem link Figma/Prototype URL trong `usability-test.md`), bám theo đúng thứ tự bước trong `user-flow.mmd` ở mục 2.2. Danh sách màn hình chính: Trip Request Form, Itinerary Builder, Approval Screen (Manager), Approval Screen Cấp 2 (Travel Admin), Expense Claim Form, Finance Reconciliation Screen, Role-based Dashboard.

## **5.2**       **Design System**

Design tokens (màu sắc, typography, spacing, component states) được định nghĩa trong [`design-system.md`](../04-design/design-system.md) — cập nhật ở Lớp 3 song song với prototype.

#      **6**           **DATABASE DESIGN**

Data model chi tiết (ERD, bảng, quan hệ) được thiết kế trong [`architecture.md`](../05-technical/architecture.md) và `data-model.md` do Engineering phụ trách, tham chiếu trực tiếp các entity xuất hiện trong Functional Scope ở mục 1.3: Trip Request, Itinerary, Approval, Expense, Policy.

# **7**          **REFERENCES**

