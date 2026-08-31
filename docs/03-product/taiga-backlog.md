# Taiga Backlog - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Cấu trúc phân rã:** Epic > User Story > Task (Chuẩn hóa để import vào Taiga)

---

## Bảng Kế Hoạch Backlog Chi Tiết

| Epic | Story ID | Story Title | Task ID | Tên Task chi tiết | Ước tính (Giờ) | Priority | Owner |
|---|---|---|---|---|---|---|---|
| **EP-01: Trip Request & Planning** | **US-01** | Khởi tạo Trip Request cơ bản | **TSK-101** | Thiết kế Data schema & API endpoint `POST /api/trips` (tạo Draft Trip) | 4h | Must | |
| | | | **TSK-102** | Xây dựng UI Form tạo Trip Request & validation ngày/địa điểm | 5h | Must | |
| | | | **TSK-103** | Cài đặt logic tính Per Diem theo đô thị loại 1/khác (`BR-TR-02`) & xử lý Urgent trip (`BR-TR-03`) | 3h | Must | |
| | | | **TSK-104** | Viết Unit test & API test cho luồng tạo Trip Request | 3h | Must | |
| | **US-02** | AI sinh gợi ý lịch trình công tác | **TSK-201** | Xây dựng AI Service Prompt & Client tích hợp LLM sinh Itinerary | 6h | Must | |
| | | | **TSK-202** | Thiết kế Server-side guardrail chặn AI vượt ngân sách (`BR-TR-07`) | 3h | Must | |
| | | | **TSK-203** | Xây dựng UI hiển thị kết quả AI Itinerary có Loading/Skeleton state | 4h | Must | |
| | **US-03** | Xem và tùy chỉnh Lịch trình công tác | **TSK-301** | Xây dựng API CRUD các mốc Itinerary (`/api/trips/:id/itinerary`) | 4h | Must | |
| | | | **TSK-302** | Thiết kế UI Itinerary Builder (thêm/sửa/xóa mốc di chuyển, khách sạn) | 5h | Must | |
| | | | **TSK-303** | Cài đặt validator cảnh báo trần khách sạn theo Role (`BR-TR-01`) | 3h | Must | |
| **EP-02: Policy Check & Approval Workflow** | **US-04** | Tự động kiểm tra vi phạm chính sách | **TSK-401** | Cài đặt Policy Check Engine tổng hợp (`BR-TR-01`, `02`, `03`, `04`) | 5h | Must | |
| | | | **TSK-402** | Thiết kế UI Component hiển thị nhãn cảnh báo Policy Violation | 3h | Must | |
| | | | **TSK-403** | Viết Test cases kiểm thử bộ rule vi phạm chính sách | 3h | Must | |
| | **US-05** | Quản lý trực tiếp duyệt Cấp 1 | **TSK-501** | Xây dựng API `POST /api/trips/:id/approve` và `/reject` cho Manager | 4h | Must | |
| | | | **TSK-502** | Xây dựng UI Màn hình duyệt Cấp 1 kèm tóm tắt dự toán & policy check | 5h | Must | |
| | | | **TSK-503** | Cài đặt logic tự động phân tầng Cấp 2 nếu >20M hoặc vi phạm (`BR-TR-04`) | 3h | Must | |
| | **US-06** | Travel Admin duyệt Cấp 2 & phát hành chuyến đi | **TSK-601** | Xây dựng API duyệt Cấp 2 cho Travel Admin | 4h | Must | |
| | | | **TSK-602** | Xây dựng UI Màn hình thẩm định & duyệt Cấp 2 của Travel Admin | 4h | Must | |
| | | | **TSK-603** | Viết Integration test luồng duyệt 2 cấp end-to-end | 4h | Must | |
| **EP-03: Expense Settlement & Trip Closure** | **US-07** | Lập và nộp Báo cáo chi phí (Expense Claim) | **TSK-701** | Thiết kế DB schema & API `POST /api/trips/:id/expenses` | 5h | Must | |
| | | | **TSK-702** | Xây dựng UI Form kê khai chi phí & upload chứng từ mock | 5h | Must | |
| | | | **TSK-703** | Cài đặt logic tính Variance chênh lệch & ràng buộc giải trình ≤10% (`BR-TR-05`) | 4h | Must | |
| | **US-08** | Finance đối chiếu chi phí & Đóng hồ sơ | **TSK-801** | Xây dựng API Finance duyệt chi phí & Close Trip (`BR-TR-06`) | 4h | Must | |
| | | | **TSK-802** | Cài đặt Business Rule chặn Close nếu vượt >10% chưa duyệt bổ sung (`BR-TR-05`) | 3h | Must | |
| | | | **TSK-803** | Xây dựng UI Màn hình đối chiếu chi phí cho Finance | 5h | Must | |
| | | | **TSK-804** | Viết E2E Test cho toàn bộ luồng từ Expense đến Close Trip | 4h | Must | |
| **EP-04: System Dashboard & Utilities** | **US-09** | Dashboard phân quyền theo vai trò | **TSK-901** | Xây dựng API Dashboard tổng hợp trạng thái chuyến đi theo Role | 4h | Must | |
| | | | **TSK-902** | Xây dựng UI Dashboard phân quyền (Employee, Manager, Admin, Finance) | 6h | Must | |
| | **US-10** | Thông báo nội bộ & Xuất báo cáo PDF | **TSK-1001** | Xây dựng In-app Notification service khi đổi trạng thái trip (`REQ-TR-11`) | 4h | Should | |
| | | | **TSK-1002** | Xây dựng chức năng Export PDF tóm tắt chuyến công tác (`REQ-TR-12`) | 5h | Should | |
| | | | **TSK-1003** | Kiểm thử UI hiển thị thông báo và tải file PDF | 2h | Should | |

---

## Bảng Tổng Hợp Tài Nguyên & Tiến Độ

- **Tổng số Epic:** 4 Epics
- **Tổng số User Stories:** 10 Stories (8 Must-have, 2 Should-have)
- **Tổng số Tasks:** 29 Tasks
- **Tổng thời gian ước tính:** 118 giờ phát triển

---

## Báo Cáo Đối Soát Danh Mục Yêu Cầu (Traceability Closure Check)

### 1. Phủ Yêu Cầu Chức Năng (Functional Requirements)
- `REQ-TR-01`: Đã phủ bởi **US-01** (Task TSK-101..104)
- `REQ-TR-02`: Đã phủ bởi **US-02** (Task TSK-201..203)
- `REQ-TR-03`: Đã phủ bởi **US-04** (Task TSK-401..403)
- `REQ-TR-04`: Đã phủ bởi **US-05** (Task TSK-501..503)
- `REQ-TR-05`: Đã phủ bởi **US-06** (Task TSK-601..603)
- `REQ-TR-06`: Đã phủ bởi **US-03** (Task TSK-301..303)
- `REQ-TR-07`: Đã phủ bởi **US-07** (Task TSK-701..702)
- `REQ-TR-08`: Đã phủ bởi **US-07** (Task TSK-703)
- `REQ-TR-09`: Đã phủ bởi **US-08** (Task TSK-801..804)
- `REQ-TR-10`: Đã phủ bởi **US-09** (Task TSK-901..902)
- `REQ-TR-11`: Đã phủ bởi **US-10** (Task TSK-1001, TSK-1003)
- `REQ-TR-12`: Đã phủ bởi **US-10** (Task TSK-1002, TSK-1003)

### 2. Phủ Quy Tắc Nghiệp Vụ (Business Rules)
- `BR-TR-01` (Trần khách sạn): Cài đặt trong **US-03**, **US-04**
- `BR-TR-02` (Per Diem): Cài đặt trong **US-01**, **US-04**
- `BR-TR-03` (Thời hạn 3 ngày): Cài đặt trong **US-01**, **US-04**
- `BR-TR-04` (Ma trận duyệt 2 cấp): Cài đặt trong **US-04**, **US-05**, **US-06**
- `BR-TR-05` (Variance Tolerance): Cài đặt trong **US-07**, **US-08**
- `BR-TR-06` (Dữ liệu Closed bất biến): Cài đặt trong **US-08**, **US-09**, **US-10**
- `BR-TR-07` (AI Grounding Rule): Cài đặt trong **US-02**

*Kết luận:* **100% REQs và BRs đều được phân rã thành công. Không có Orphan Requirement hoặc Orphan Business Rule.**