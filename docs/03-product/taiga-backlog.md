# Taiga Backlog - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Mục đích:** Danh mục Backlog chuẩn hóa cấu trúc **Epic > User Story > Task** sẵn sàng import/nhập trực tiếp lên Taiga Web để quản lý Sprint, phân công thành viên và kiểm soát tiến độ.

---

## 1. Cấu hình & Quy ước trên Taiga (Taiga Configuration)

- **Workflow Statuses (Cột trạng thái Kanban/Taskboard):**  
  `New` ➔ `Ready` ➔ `In Progress` ➔ `Review` ➔ `QA` ➔ `Done`
- **Definition of Ready (DoR):** Story có user value, AC dạng Given/When/Then, Design link, API contract, Points ≤ 3 pts.
- **Definition of Done (DoD):** Tất cả AC pass, code có PR review + merge `main`, có automated tests pass, không có blocker/critical bug.
- **Quy ước Story Points:** Mỗi Story ước tính từ 1 đến 3 points (theo chuẩn giáo trình, không vượt quá 3 points).
- **Phân vai nhóm (Team Members & Roles):**
  - **Product / BA:** Nguyễn Thị Mỹ Nhi (Đặc tả Business Logic, Business Rules, Scope, Story Specs, Acceptance Criteria)
  - **AI / Vault:** Nguyễn Ngọc Tuyết Nhi (Project Vault, Q&A Benchmark, AI Prompt Engineering, AI Service Spec)
  - **UX / UI:** Hoàng Thị Kim Dung (Prototype, Figma Design System, UI Components, UX Copy, Usability Test)
  - **Engineering (BE/Fullstack):** Nguyễn Thị Ánh Tuyết (Architecture, Database Schema, REST APIs, Backend Services, Auth/RBAC, Server Guardrails)
  - **QA / Release:** Hà Gia Bảo Ngọc (Test Strategy, Test Automation, Bug Tracking, QA Report, Runbook/Release)

---

## 2. Danh sách Epics (Khả năng hệ thống)

| Epic ID | Tên Epic | Mô tả khả năng (Capability) | Story IDs trực thuộc |
|---|---|---|---|
| **EP-01** | **Trip Request & Planning** | Quản lý khởi tạo yêu cầu công tác, AI sinh lịch trình theo constraint và chỉnh sửa mốc lịch trình. | `US-01`, `US-02`, `US-03` |
| **EP-02** | **Policy Check & Approval Workflow** | Động cơ kiểm tra tuân thủ chính sách và quy trình phê duyệt đa cấp phân quyền (Manager & Travel Admin). | `US-04`, `US-05`, `US-06` |
| **EP-03** | **Expense Settlement & Trip Closure** | Kê khai chi phí thực tế sau chuyến đi, đối chiếu variance và Finance nghiệm thu đóng hồ sơ. | `US-07`, `US-08` |
| **EP-04** | **System Dashboard & Utilities** | Dashboard phân quyền theo vai trò, thông báo nội bộ và xuất báo cáo PDF tóm tắt chuyến đi. | `US-09`, `US-10` |

---

## 3. Bảng Phân Rã Chi Tiết (Epic > Story > Task Breakdown)

| Epic | Story ID & Tiêu đề | Pts | Task ID | Tên Task (Deliverable kiểm chứng được) | Owner | Est (h) | Expected Output & Verify Check | Priority |
|---|---|---|---|---|---|---|---|---|
| **EP-01** | **US-01: Khởi tạo Trip Request cơ bản** *(REQ-TR-01, BR-TR-02, BR-TR-03)* | **3** | **TSK-101** | Đặc tả Business Logic & Rule Validation cho Trip Request (`BR-TR-02`, `BR-TR-03`) | Mỹ Nhi (Product/BA) | 3h | Tài liệu Story Spec US-01; bảng ma trận validation ngày & Per Diem | Must |
| | | | **TSK-102** | Thiết kế Data model, migration & API `POST /api/trips` (tạo Draft Trip) | Ánh Tuyết (Engineering) | 5h | DB Schema bảng `trips`; API tạo trip draft; validate Per Diem server-side | Must |
| | | | **TSK-103** | Xây dựng UI Form tạo Trip Request & validation ngày/địa điểm | Kim Dung (UX/UI) | 5h | Form React responsive, validate ngày đi/về, feedback lỗi trực quan | Must |
| | | | **TSK-104** | Viết Unit test & Integration test cho luồng tạo Trip Request | Bảo Ngọc (QA) | 3h | Test suite tạo request (happy path, boundary, validation pass) | Must |
| | **US-02: AI sinh gợi ý lịch trình công tác** *(REQ-TR-02, BR-TR-07)* | **3** | **TSK-201** | Xây dựng AI Prompt Schema & kết nối LLM sinh Itinerary | Tuyết Nhi (AI/Vault) | 6h | Prompt structured output JSON; LLM client kết nối ổn định | Must |
| | | | **TSK-202** | Xây dựng Backend API tích hợp AI & Guardrail chặn AI vượt ngân sách (`BR-TR-07`) | Ánh Tuyết (Engineering) | 4h | API `/api/ai/itinerary`; server-side guardrail check budget ≤ max; retry logic | Must |
| | | | **TSK-203** | Xây dựng UI hiển thị kết quả AI Itinerary có Loading/Skeleton state | Kim Dung (UX/UI) | 4h | Component render itinerary theo ngày; skeleton loading animation | Must |
| | **US-03: Xem và tùy chỉnh Lịch trình công tác** *(REQ-TR-06, BR-TR-01)* | **2** | **TSK-301** | Xây dựng API CRUD các mốc Itinerary (`/api/trips/:id/itinerary`) & check trần khách sạn (`BR-TR-01`) | Ánh Tuyết (Engineering) | 5h | Endpoints thêm/sửa/xóa mốc; server check trần phòng theo role | Must |
| | | | **TSK-302** | Thiết kế UI Itinerary Builder (thêm/sửa/xóa mốc di chuyển, khách sạn) | Kim Dung (UX/UI) | 5h | Giao diện kéo thả/chỉnh sửa mốc thời gian, tự động tính lại tổng tiền | Must |
| | | | **TSK-303** | Đặc tả Story Spec & Test cases nghiệp vụ cho Itinerary Customization | Mỹ Nhi (Product/BA) | 2h | Spec chi tiết US-03; checklist kiểm tra ràng buộc ngân sách | Must |
| **EP-02** | **US-04: Tự động kiểm tra vi phạm chính sách** *(REQ-TR-03, BR-TR-01..04)* | **3** | **TSK-401** | Đặc tả thuật toán & Ma trận Policy Check Engine (`BR-TR-01`, `02`, `03`, `04`) | Mỹ Nhi (Product/BA) | 3h | Tài liệu đặc tả logic Policy Engine; định nghĩa bộ cờ `VIOLATIONS` | Must |
| | | | **TSK-402** | Lập trình Backend Policy Check Engine & API kiểm tra vi phạm | Ánh Tuyết (Engineering) | 5h | Service PolicyChecker trả về status `PASS` hoặc mảng `violations[]` | Must |
| | | | **TSK-403** | Thiết kế UI Component hiển thị nhãn cảnh báo Policy Violation | Kim Dung (UX/UI) | 3h | Badge/Alert đỏ-vàng trực quan kèm modal nhập lý do giải trình | Must |
| | | | **TSK-404** | Viết Test cases tự động kiểm thử bộ rules vi phạm chính sách | Bảo Ngọc (QA) | 3h | Suite test 8 test cases bao phủ toàn bộ tổ hợp vi phạm policy | Must |
| | **US-05: Quản lý trực tiếp duyệt Cấp 1** *(REQ-TR-04, BR-TR-04)* | **2** | **TSK-501** | Xây dựng API `POST /api/trips/:id/approve` & `/reject` kèm logic định tuyến Cấp 2 (`BR-TR-04`) | Ánh Tuyết (Engineering) | 5h | Endpoint duyệt/từ chối; RBAC check role Manager; auto route L2 nếu >20M | Must |
| | | | **TSK-502** | Xây dựng UI Màn hình duyệt Cấp 1 kèm tóm tắt dự toán & policy | Kim Dung (UX/UI) | 5h | Screen duyệt 1-click có tóm tắt lý do, chi phí, cờ vi phạm | Must |
| | | | **TSK-503** | Soạn thảo kịch bản duyệt & Definition of Acceptance cho Approval Workflow | Mỹ Nhi (Product/BA) | 2h | Tài liệu bàn giao nghiệp vụ luồng duyệt; checklist nghiệm thu | Must |
| | **US-06: Travel Admin duyệt Cấp 2 & phát hành** *(REQ-TR-05, BR-TR-04)* | **2** | **TSK-601** | Xây dựng API duyệt Cấp 2 cho Travel Admin & cập nhật status chuyến đi | Ánh Tuyết (Engineering) | 4h | Endpoint duyệt Cấp 2; update status `APPROVED`; emit log event | Must |
| | | | **TSK-602** | Xây dựng UI Màn hình thẩm định & duyệt Cấp 2 của Travel Admin | Kim Dung (UX/UI) | 4h | Screen thẩm định lịch trình, chi phí & phê duyệt cấp 2 | Must |
| | | | **TSK-603** | Viết Integration test luồng duyệt 2 cấp end-to-end | Bảo Ngọc (QA) | 4h | Test suite mô phỏng Employee ➔ Manager ➔ Admin duyệt | Must |
| **EP-03** | **US-07: Lập và nộp Báo cáo chi phí (Expense Claim)** *(REQ-TR-07, REQ-TR-08, BR-TR-05, BR-TR-06)* | **3** | **TSK-701** | Đặc tả quy tắc tính Variance chênh lệch & ràng buộc giải trình (`BR-TR-05`) | Mỹ Nhi (Product/BA) | 3h | Công thức tính % variance; điều kiện kích hoạt duyệt bổ sung | Must |
| | | | **TSK-702** | Thiết kế DB schema & Lập trình Backend API Expense Management (`POST /api/trips/:id/expenses`) | Ánh Tuyết (Engineering) | 6h | Schema `expenses`, `expense_items`; API tính variance server-side | Must |
| | | | **TSK-703** | Xây dựng UI Form kê khai chi phí & upload chứng từ mock | Kim Dung (UX/UI) | 5h | Form nhập từng khoản chi, đính kèm biên nhận, xem preview variance | Must |
| | **US-08: Finance đối chiếu chi phí & Đóng hồ sơ** *(REQ-TR-09, BR-TR-05, BR-TR-06)* | **3** | **TSK-801** | Lập trình Backend API Finance Close Trip & Khóa dữ liệu bất biến (`BR-TR-06`, `BR-TR-05`) | Ánh Tuyết (Engineering) | 5h | Endpoint `/close`; chặn đóng nếu lệch >10% chưa duyệt; set read-only DB | Must |
| | | | **TSK-802** | Xây dựng UI Màn hình đối chiếu chi phí cho Finance | Kim Dung (UX/UI) | 5h | Bảng đối chiếu `Dự toán` vs `Thực tế` vs `Lệch %`; nút Close | Must |
| | | | **TSK-803** | Viết E2E Test cho toàn bộ luồng từ Expense đến Close Trip | Bảo Ngọc (QA) | 4h | Playwright/Cypress E2E test happy path quyết toán & close trip | Must |
| **EP-04** | **US-09: Dashboard phân quyền theo vai trò** *(REQ-TR-10, BR-TR-06)* | **2** | **TSK-901** | Xây dựng Backend API Dashboard tổng hợp trạng thái chuyến đi theo Role | Ánh Tuyết (Engineering) | 4h | Endpoint query aggregate count chuyến đi theo từng role RBAC | Must |
| | | | **TSK-902** | Xây dựng UI Dashboard phân quyền (Employee, Manager, Admin, Finance) | Kim Dung (UX/UI) | 6h | Dashboard 4 tab view, widget thống kê, filter nhanh theo trạng thái | Must |
| | **US-10: Thông báo nội bộ & Xuất báo cáo PDF** *(REQ-TR-11, REQ-TR-12, BR-TR-06)* | **2** | **TSK-1001** | Xây dựng Backend Service In-app Notification khi đổi trạng thái trip (`REQ-TR-11`) | Ánh Tuyết (Engineering) | 4h | Service push notification khi có Approve/Reject; badge đếm | Should |
| | | | **TSK-1002** | Xây dựng chức năng Export PDF tóm tắt chuyến công tác (`REQ-TR-12`) | Tuyết Nhi (AI/Vault) | 5h | Endpoint render template PDF tóm tắt trip & expense đầy đủ | Should |
| | | | **TSK-1003** | Kiểm thử UI hiển thị thông báo và tải file PDF | Bảo Ngọc (QA) | 2h | Test case kiểm tra chuông thông báo và tính toàn vẹn file PDF | Should |

---

## 4. Bảng Tổng Hợp Chỉ Số Phân Bổ (Sprint Estimation & Workload Allocation)

### 4.1. Tổng quan Dự án
- **Tổng số Epics:** 4 Epics
- **Tổng số User Stories:** 10 User Stories (8 Must-have, 2 Should-have; 100% Story Points từ 2-3 pts)
- **Tổng Story Points:** 25 Story Points
- **Tổng số Tasks:** 30 Tasks
- **Tổng thời gian ước tính:** 122 giờ làm việc

### 4.2. Phân bổ khối lượng chuẩn xác theo Thành viên & Vai trò

| Thành viên | Vai trò chính | Số Story phụ trách | Số Tasks phụ trách | Tổng giờ ước tính | Trách nhiệm & Deliverable chính |
|---|---|---|---|---|---|
| **Nguyễn Thị Mỹ Nhi** | **Product / BA** | `US-01`, `US-04`, `US-07` | 5 Tasks | 13h | Requirements, Story Specs, Ma trận Policy Engine, Variance rules, AC & DoA |
| **Nguyễn Thị Ánh Tuyết** | **Engineering** | `US-05`, `US-06`, `US-08` | 11 Tasks | 52h | Database Models, REST APIs, Backend Services, Server Guardrails, RBAC, DB Transactions |
| **Hoàng Thị Kim Dung** | **UX / UI** | `US-03`, `US-09` | 7 Tasks | 33h | Giao diện React/Figma, Design tokens, Forms, Components, Dashboard |
| **Nguyễn Ngọc Tuyết Nhi** | **AI / Vault** | `US-02`, `US-10` | 2 Tasks | 11h | AI Service Prompt/LLM integration, PDF generation, Vault Single Source |
| **Hà Gia Bảo Ngọc** | **QA / Release** | Phụ trách Quality Gate | 5 Tasks | 17h | Test Strategy, Unit/Integration/E2E test suites, Policy check test cases |
| **TỔNG CỘNG** | **Cả Squad (5 SV)** | **10 Stories** | **30 Tasks** | **122h** | **Chuẩn vai trò 100%, không bị chéo task kỹ thuật sang BA** |

---

## 5. Hướng dẫn các bước tạo nhanh trên Taiga Web

1. **Tạo Project trên Taiga:** Chọn template **Scrum** hoặc **Kanban** với tên `Smart Travel & Business Trip Management`.
2. **Kích hoạt Epics:** Vào *Admin > Attributes > Epics*, bật tính năng Epics và tạo 4 Epics (`EP-01` đến `EP-04`).
3. **Tạo User Stories:**
   - Vào tab *Backlog*, bấm *New User Story*.
   - Đặt tiêu đề theo format `[US-xx] Tên Story`, gán Epic tương ứng, điền Points (2 hoặc 3 pts).
   - Dán nội dung User Story + Acceptance Criteria (Given/When/Then) từ `user-stories.md` vào phần Description.
4. **Tạo Tasks cho từng Story:**
   - Mở từng Story, bấm *New Task*.
   - Nhập Task ID + Tiêu đề, chọn *Assigned to* (tên thành viên theo bảng trên), nhập *Estimated hours*.
5. **Gán thẻ (Tags) để lọc:** Gán các tag `Must`, `Should`, `Frontend`, `Backend`, `BA`, `AI`, `QA` để dễ dàng theo dõi trên Taskboard.