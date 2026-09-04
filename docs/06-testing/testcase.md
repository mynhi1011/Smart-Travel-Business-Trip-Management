# QA Test Foundation

## Phạm vi và quy ước

Tài liệu này là test foundation cho `US-01` đến `US-10`, được đối chiếu với `docs/02-vault/02-requirements/requirements.md`, `docs/02-vault/03-domain/business-rules.md`, `docs/02-vault/03-domain/workflows.md`, toàn bộ `docs/05-technical/story-specs/`, API contract và mã nguồn hiện có. Không có kết quả thực thi được ghi nhận trong tài liệu này.

`NOT RUN` nghĩa là ca có thể được chuẩn bị để thực thi nhưng chưa có evidence chạy. `NOT READY` chỉ dùng cho ca PDF vì implementation hiện tại trả `text/html` thay vì `application/pdf`.

## US-01

### TC-001
- US: `US-01`
- Tên Test Case: Lưu nháp Trip Request hợp lệ, không khẩn cấp
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: Đăng nhập với role `EMPLOYEE`; ngày đi cách ngày hiện tại ít nhất 3 ngày làm việc.
- Test Data: Đủ `origin`, `destination`, `destinationType`, ngày đi/về, `purpose` và `estimatedBudget` dương.
- Các bước thực hiện: Gửi `POST /api/v1/trips` với dữ liệu hợp lệ.
- Kết quả mong đợi: Trả `201`; tạo trip có `status = DRAFT`, `isUrgent = false` và `tripId`.
- Trace:
  - Requirement: `REQ-TR-01`
  - Business Rule: `BR-TR-03`
  - Acceptance Criteria: `AC 1.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-002
- US: `US-01`
- Tên Test Case: Cảnh báo Per Diem vượt `Max_Per_Diem` nhưng vẫn cho lưu nháp
- Loại kiểm thử: Business Rule Validation
- Mức độ ưu tiên: High
- Preconditions: Đăng nhập với role `EMPLOYEE`.
- Test Data: `destinationType = TIER1_CITY`, `tripDays = 3`, `perDiemBudget = 2000000`.
- Các bước thực hiện: Nhập dữ liệu vào form và lưu nháp.
- Kết quả mong đợi: UI hiển thị cảnh báo vàng; request vẫn được phép tạo theo contract US-01.
- Trace:
  - Requirement: `REQ-TR-01`
  - Business Rule: `BR-TR-02`
  - Acceptance Criteria: `AC 1.2`
- Layer: E2E
- Mode: Manual
- Status: NOT RUN

### TC-003
- US: `US-01`
- Tên Test Case: Bắt buộc `urgencyReason` cho chuyến đi khẩn cấp
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: High
- Preconditions: Đăng nhập với role `EMPLOYEE`.
- Test Data: `departureDate` dưới 3 ngày làm việc; không gửi `urgencyReason`.
- Các bước thực hiện: Gửi yêu cầu tạo trip.
- Kết quả mong đợi: Server gắn ngữ cảnh khẩn cấp và trả `400` khi thiếu `urgencyReason`.
- Trace:
  - Requirement: `REQ-TR-01`
  - Business Rule: `BR-TR-03`
  - Acceptance Criteria: `AC 1.3`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-004
- US: `US-01`
- Tên Test Case: Từ chối dữ liệu ngày hoặc ngân sách không hợp lệ
- Loại kiểm thử: Negative Case
- Mức độ ưu tiên: High
- Preconditions: Đăng nhập với role `EMPLOYEE`.
- Test Data: Lần lượt `returnDate < departureDate`, `departureDate` quá khứ, hoặc `estimatedBudget <= 0`.
- Các bước thực hiện: Gửi yêu cầu tạo trip cho từng bộ dữ liệu.
- Kết quả mong đợi: Mỗi yêu cầu bị từ chối với `400 VALIDATION_ERROR`; không tạo Trip Request.
- Trace:
  - Requirement: `REQ-TR-01`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 1.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-02

### TC-005
- US: `US-02`
- Tên Test Case: AI sinh itinerary trong budget
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: `EMPLOYEE` sở hữu trip chưa `CLOSED` có destination, `tripDays` và budget hợp lệ.
- Test Data: `days = 3`, `budget = 5000000`; provider trả `totalEstimatedCost = 4500000`.
- Các bước thực hiện: Gọi `POST /api/v1/ai/generate-itinerary`.
- Kết quả mong đợi: Trả `200`, `guardrailPass = true`, kết quả là itinerary draft có chi phí không vượt `budget`.
- Trace:
  - Requirement: `REQ-TR-02`
  - Business Rule: `BR-TR-07`
  - Acceptance Criteria: `AC 2.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-006
- US: `US-02`
- Tên Test Case: Chặn output AI vượt budget sau retry
- Loại kiểm thử: AI-specific Validation
- Mức độ ưu tiên: High
- Preconditions: Như TC-005; có deterministic provider fixture.
- Test Data: `budget = 5000000`; provider liên tục trả `totalEstimatedCost = 5500000`.
- Các bước thực hiện: Gọi endpoint generate itinerary và quan sát các lần retry.
- Kết quả mong đợi: Không trả itinerary vượt budget; sau tối đa hai retry theo đặc tả, trả `422 AI_BUDGET_GUARDRAIL_FAILED`.
- Trace:
  - Requirement: `REQ-TR-02`
  - Business Rule: `BR-TR-07`
  - Acceptance Criteria: `AC 2.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-007
- US: `US-02`
- Tên Test Case: Validate request AI không hợp lệ
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: High
- Preconditions: `EMPLOYEE` sở hữu trip hợp lệ.
- Test Data: Lần lượt `days > trip.tripDays`, `days` ngoài 1–30, `budget <= 0`, destination rỗng hoặc preferences dài hơn 500 ký tự.
- Các bước thực hiện: Gọi endpoint với từng dữ liệu không hợp lệ.
- Kết quả mong đợi: Server từ chối theo validation contract và không gọi provider.
- Trace:
  - Requirement: `REQ-TR-02`
  - Business Rule: `BR-TR-07`
  - Acceptance Criteria: `AC 2.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-008
- US: `US-02`
- Tên Test Case: Bảo vệ ownership, role và trạng thái `CLOSED` khi sinh AI
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Có trip của Employee A và trip đã `CLOSED`.
- Test Data: JWT của Employee B, `MANAGER`, và Employee owner của trip `CLOSED`.
- Các bước thực hiện: Gọi endpoint cho từng ngữ cảnh.
- Kết quả mong đợi: Employee không sở hữu nhận `403 NOT_OWNER`; role không được phép nhận `403 FORBIDDEN`; trip `CLOSED` nhận `409 TRIP_IMMUTABLE`.
- Trace:
  - Requirement: `REQ-TR-02`
  - Business Rule: `BR-TR-06`, `BR-TR-07`
  - Acceptance Criteria: `AC 2.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-03

### TC-009
- US: `US-03`
- Tên Test Case: CRUD itinerary item và tổng chi phí
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: `EMPLOYEE` sở hữu trip cho phép chỉnh sửa.
- Test Data: Itinerary item hợp lệ có `itemDate`, `timeSlot`, `location`, `activity`, `estimatedCost`.
- Các bước thực hiện: POST item, PATCH `location`, DELETE item; đọc lại itinerary sau mỗi bước.
- Kết quả mong đợi: Tạo `201`, sửa `200`, xóa `204`; timeline và `totalEstimatedCost` phản ánh dữ liệu hiện hành.
- Trace:
  - Requirement: `REQ-TR-06`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 3.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-010
- US: `US-03`
- Tên Test Case: Cảnh báo hạn mức hotel theo `jobGrade`
- Loại kiểm thử: Business Rule Validation
- Mức độ ưu tiên: High
- Preconditions: Employee có `jobGrade = STAFF`.
- Test Data: `hotelCostPerNight = 1200000`.
- Các bước thực hiện: Thêm hoặc chỉnh sửa item lưu trú trên Itinerary Builder.
- Kết quả mong đợi: UI hiển thị cảnh báo `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET` theo `BR-TR-01`.
- Trace:
  - Requirement: `REQ-TR-06`
  - Business Rule: `BR-TR-01`
  - Acceptance Criteria: `AC 3.2`
- Layer: E2E
- Mode: Manual
- Status: NOT RUN

### TC-011
- US: `US-03`
- Tên Test Case: Từ chối item ngoài thời gian trip hoặc chi phí âm
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: Medium
- Preconditions: `EMPLOYEE` sở hữu trip cho phép chỉnh sửa.
- Test Data: `itemDate < departureDate` hoặc `estimatedCost = -500`.
- Các bước thực hiện: POST itinerary item với từng dữ liệu.
- Kết quả mong đợi: Ngày ngoài trip bị từ chối `422`; chi phí âm bị từ chối `400`.
- Trace:
  - Requirement: `REQ-TR-06`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 3.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-012
- US: `US-03`
- Tên Test Case: Không cho ghi itinerary của trip `CLOSED` hoặc trip không sở hữu
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Có trip `CLOSED` và trip của Employee khác.
- Test Data: JWT owner trip `CLOSED`; JWT Employee không sở hữu.
- Các bước thực hiện: POST/PATCH itinerary item.
- Kết quả mong đợi: Trip `CLOSED` trả `409 TRIP_IMMUTABLE`; non-owner trả `403 NOT_OWNER`.
- Trace:
  - Requirement: `REQ-TR-06`
  - Business Rule: `BR-TR-06`
  - Acceptance Criteria: `AC 3.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-04

### TC-013
- US: `US-04`
- Tên Test Case: Policy check không vi phạm
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: Trip đang `DRAFT`, owner là `EMPLOYEE` có `jobGrade = STAFF`.
- Test Data: hotel `800000`, per diem đúng mức, ngày đi cách 7 ngày.
- Các bước thực hiện: Submit trip để chạy PolicyCheckEngine.
- Kết quả mong đợi: `passed = true`; UI hiển thị banner xanh và không yêu cầu Level 2.
- Trace:
  - Requirement: `REQ-TR-03`
  - Business Rule: `BR-TR-01`, `BR-TR-02`, `BR-TR-03`, `BR-TR-04`
  - Acceptance Criteria: `AC 4.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-014
- US: `US-04`
- Tên Test Case: Phát hiện hotel và Per Diem vượt chính sách
- Loại kiểm thử: Business Rule Validation
- Mức độ ưu tiên: High
- Preconditions: Trip `DRAFT` thuộc Employee `STAFF`.
- Test Data: hotel `1500000`; hoặc TIER1_CITY 3 ngày với `perDiemBudget = 2000000`.
- Các bước thực hiện: Submit từng trip.
- Kết quả mong đợi: Có lần lượt `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET` hoặc `POLICY_VIOLATION_PER_DIEM_EXCEEDED`; trip vẫn theo luồng submit được đặc tả.
- Trace:
  - Requirement: `REQ-TR-03`
  - Business Rule: `BR-TR-01`, `BR-TR-02`
  - Acceptance Criteria: `AC 4.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-015
- US: `US-04`
- Tên Test Case: Đánh dấu urgent và định tuyến Level 2
- Loại kiểm thử: Status / State Transition
- Mức độ ưu tiên: High
- Preconditions: Trip `DRAFT` hợp lệ.
- Test Data: Một trip `isUrgent = true`; một trip `estimatedBudget = 25000000`.
- Các bước thực hiện: Submit từng trip.
- Kết quả mong đợi: Urgent có `URGENT_TRIP_NOTICE` với severity `WARNING`; trip vượt 20M có `POLICY_VIOLATION_BUDGET_THRESHOLD` và `requiresLevel2 = true`.
- Trace:
  - Requirement: `REQ-TR-03`
  - Business Rule: `BR-TR-03`, `BR-TR-04`
  - Acceptance Criteria: `AC 4.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-016
- US: `US-04`
- Tên Test Case: Không submit lại trip đã `SUBMITTED`
- Loại kiểm thử: Status / State Transition
- Mức độ ưu tiên: Medium
- Preconditions: Trip đã `SUBMITTED`.
- Test Data: Trip ID hợp lệ.
- Các bước thực hiện: Gọi submit lần hai.
- Kết quả mong đợi: Trả `409 INVALID_STATE`; không tạo kết quả policy check mới.
- Trace:
  - Requirement: `REQ-TR-03`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 4.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-05

### TC-017
- US: `US-05`
- Tên Test Case: Manager duyệt Level 1 không vi phạm
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: Manager trực tiếp; trip `SUBMITTED`, budget `8000000`, không vi phạm.
- Test Data: Trip hợp lệ và JWT Manager trực tiếp.
- Các bước thực hiện: Gọi `POST /trips/:tripId/approve`.
- Kết quả mong đợi: Trip chuyển `APPROVED`, `approvalLevel = LEVEL_1` và có audit `MANAGER_APPROVED`.
- Trace:
  - Requirement: `REQ-TR-04`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 5.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-018
- US: `US-05`
- Tên Test Case: Manager approve chuyển đúng sang Level 2
- Loại kiểm thử: Status / State Transition
- Mức độ ưu tiên: High
- Preconditions: Manager trực tiếp; trip `SUBMITTED`.
- Test Data: Budget `25000000`, hoặc budget `15000000` có một policy violation.
- Các bước thực hiện: Manager approve trip.
- Kết quả mong đợi: Trip chuyển `PENDING_ADMIN_APPROVAL`, không chuyển thẳng `APPROVED`.
- Trace:
  - Requirement: `REQ-TR-04`, `REQ-TR-05`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 5.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-019
- US: `US-05`
- Tên Test Case: Manager reject bắt buộc comment
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: High
- Preconditions: Manager trực tiếp; trip `SUBMITTED`.
- Test Data: Lần lượt reject không có comment và reject có comment.
- Các bước thực hiện: Gọi endpoint reject.
- Kết quả mong đợi: Thiếu comment trả `400 VALIDATION_ERROR`; comment hợp lệ chuyển trip `REJECTED` và lưu approval record.
- Trace:
  - Requirement: `REQ-TR-04`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 5.3`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-020
- US: `US-05`
- Tên Test Case: Chặn approver không đúng quyền hoặc không quản lý nhân viên
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Có trip `SUBMITTED` của Employee A.
- Test Data: JWT `EMPLOYEE`; JWT Manager không phải quản lý Employee A.
- Các bước thực hiện: Gọi approve cho từng JWT.
- Kết quả mong đợi: Đều trả `403 FORBIDDEN`; trạng thái trip không đổi.
- Trace:
  - Requirement: `REQ-TR-04`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 5.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-06

### TC-021
- US: `US-06`
- Tên Test Case: Travel Admin duyệt Level 2
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: `TRAVEL_ADMIN`; trip `PENDING_ADMIN_APPROVAL`.
- Test Data: Trip cần Level 2.
- Các bước thực hiện: Gọi approve.
- Kết quả mong đợi: Trip chuyển `APPROVED`, `approvalLevel = LEVEL_2`, có audit `ADMIN_APPROVED`.
- Trace:
  - Requirement: `REQ-TR-05`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 6.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-022
- US: `US-06`
- Tên Test Case: Travel Admin reject bắt buộc comment
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: High
- Preconditions: `TRAVEL_ADMIN`; trip `PENDING_ADMIN_APPROVAL`.
- Test Data: Reject không comment và reject có comment.
- Các bước thực hiện: Gọi reject cho mỗi dữ liệu.
- Kết quả mong đợi: Thiếu comment trả `400`; comment hợp lệ chuyển `REJECTED` và lưu comment.
- Trace:
  - Requirement: `REQ-TR-05`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 6.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-023
- US: `US-06`
- Tên Test Case: Chỉ Travel Admin xử lý đúng trạng thái Level 2
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Có trip `SUBMITTED` và trip `PENDING_ADMIN_APPROVAL`.
- Test Data: JWT `MANAGER`, `EMPLOYEE`, và `TRAVEL_ADMIN`.
- Các bước thực hiện: Gọi approve ở các tổ hợp role/trạng thái không hợp lệ.
- Kết quả mong đợi: `MANAGER` và `EMPLOYEE` nhận `403`; Admin approve trip chưa qua L1 nhận `409 INVALID_STATE`.
- Trace:
  - Requirement: `REQ-TR-05`
  - Business Rule: `BR-TR-04`
  - Acceptance Criteria: `AC 6.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-07

### TC-024
- US: `US-07`
- Tên Test Case: Tạo Expense Claim cho trip được duyệt và tính tổng
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: Employee sở hữu trip `APPROVED` hoặc `ONGOING`.
- Test Data: Ba Expense Item hợp lệ.
- Các bước thực hiện: Tạo expense, thêm ba item, đọc Expense Claim.
- Kết quả mong đợi: Tạo `201`; `estimatedBudgetSnapshot` bằng `trip.estimatedBudget`; `totalActual` bằng tổng item.
- Trace:
  - Requirement: `REQ-TR-07`, `REQ-TR-08`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 7.1`, `AC 7.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-025
- US: `US-07`
- Tên Test Case: Bắt buộc giải trình khi variance lớn hơn 0 và không quá 10%
- Loại kiểm thử: Business Rule Validation
- Mức độ ưu tiên: High
- Preconditions: Expense `DRAFT` có item tạo variance `5%`.
- Test Data: Submit không `justification`, sau đó submit có `justification`.
- Các bước thực hiện: Gọi `/expense/submit` cho hai bộ dữ liệu.
- Kết quả mong đợi: Thiếu giải trình trả `422 JUSTIFICATION_REQUIRED`; có giải trình chuyển `SUBMITTED`.
- Trace:
  - Requirement: `REQ-TR-07`, `REQ-TR-08`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 7.3`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-026
- US: `US-07`
- Tên Test Case: Gắn yêu cầu Manager reapprove khi variance trên 10%
- Loại kiểm thử: Boundary Case
- Mức độ ưu tiên: High
- Preconditions: Expense `DRAFT` có ít nhất một item.
- Test Data: Variance `15%` và variance `0%`.
- Các bước thực hiện: Submit từng Expense Claim.
- Kết quả mong đợi: `15%` submit thành công với `managerReapprovalRequired = true`; `0%` có `managerReapprovalRequired = false`.
- Trace:
  - Requirement: `REQ-TR-08`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 7.3`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-027
- US: `US-07`
- Tên Test Case: Chặn tạo hoặc sửa Expense Claim sai trạng thái/dữ liệu
- Loại kiểm thử: Negative Case
- Mức độ ưu tiên: Medium
- Preconditions: Có trip `DRAFT`; có expense `SUBMITTED`.
- Test Data: Tạo expense trên trip `DRAFT`, item `amount = 0`, submit không item, thêm item vào expense `SUBMITTED`.
- Các bước thực hiện: Thực hiện các thao tác tương ứng.
- Kết quả mong đợi: Trả `409 INVALID_STATE` hoặc lỗi validation; không thay đổi dữ liệu không hợp lệ.
- Trace:
  - Requirement: `REQ-TR-07`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 7.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-08

### TC-028
- US: `US-08`
- Tên Test Case: Finance approve Expense rồi close trip tuần tự
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: `FINANCE`; Expense `SUBMITTED`, variance `5%`, đã có `justification`.
- Test Data: Trip và expense hợp lệ.
- Các bước thực hiện: Gọi `POST /expense/approve`, xác nhận expense `APPROVED`, rồi gọi `POST /close`.
- Kết quả mong đợi: Expense chuyển `APPROVED`, sau đó trip chuyển `CLOSED`; không bỏ qua request approve.
- Trace:
  - Requirement: `REQ-TR-09`
  - Business Rule: `BR-TR-05`, `BR-TR-06`
  - Acceptance Criteria: `AC 8.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-029
- US: `US-08`
- Tên Test Case: Finance bị chặn khi variance trên 10% chưa được reapprove
- Loại kiểm thử: Business Rule Validation
- Mức độ ưu tiên: High
- Preconditions: `FINANCE`; Expense `SUBMITTED`, `managerReapprovalRequired = true`, `managerReapproved = false`.
- Test Data: Expense variance `15%`.
- Các bước thực hiện: Gọi approve; sau đó Manager trực tiếp reapprove và gọi approve lại.
- Kết quả mong đợi: Lần đầu trả `422 EXPENSE_VARIANCE_EXCEEDED`; sau reapprove, Finance có thể approve.
- Trace:
  - Requirement: `REQ-TR-09`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 8.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-030
- US: `US-08`
- Tên Test Case: Finance reject Expense bắt buộc comment
- Loại kiểm thử: Input Validation
- Mức độ ưu tiên: High
- Preconditions: `FINANCE`; Expense `SUBMITTED`.
- Test Data: Reject không comment và reject có comment.
- Các bước thực hiện: Gọi endpoint reject.
- Kết quả mong đợi: Thiếu comment trả `400`; comment hợp lệ chuyển Expense `REJECTED`.
- Trace:
  - Requirement: `REQ-TR-09`
  - Business Rule: `BR-TR-05`
  - Acceptance Criteria: `AC 8.3`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-031
- US: `US-08`
- Tên Test Case: Hồ sơ `CLOSED` bất biến và chỉ Finance được close
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Một trip `CLOSED`; một Expense `APPROVED` chưa close.
- Test Data: JWT owner và JWT không phải `FINANCE`.
- Các bước thực hiện: Thử POST itinerary/PATCH trip sau close; thử gọi close bằng role khác `FINANCE`.
- Kết quả mong đợi: Mọi write trên trip `CLOSED` trả `409 TRIP_IMMUTABLE`; role không phải Finance bị `403 FORBIDDEN`.
- Trace:
  - Requirement: `REQ-TR-09`
  - Business Rule: `BR-TR-06`
  - Acceptance Criteria: `AC 8.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

## US-09

### TC-032
- US: `US-09`
- Tên Test Case: Dashboard Employee chỉ hiển thị dữ liệu của chính mình
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Employee A có 1 trip `DRAFT`, 1 trip `SUBMITTED`; Employee B có trip riêng.
- Test Data: JWT Employee A, kể cả request thêm `?employeeId=<Employee-B>`.
- Các bước thực hiện: Gọi `GET /api/v1/dashboard`.
- Kết quả mong đợi: `byStatus.DRAFT = 1`, `byStatus.SUBMITTED = 1`; không trả trip Employee B và query param không override server filter.
- Trace:
  - Requirement: `REQ-TR-10`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 9.1`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-033
- US: `US-09`
- Tên Test Case: Dashboard theo role approver trả đúng queue
- Loại kiểm thử: Happy Path
- Mức độ ưu tiên: High
- Preconditions: Có 3 subordinate trips `SUBMITTED`, 2 expense `SUBMITTED` và một trip `PENDING_ADMIN_APPROVAL`.
- Test Data: JWT `MANAGER`, `FINANCE`, `TRAVEL_ADMIN`.
- Các bước thực hiện: Gọi dashboard bằng từng role.
- Kết quả mong đợi: Manager có `pendingApprovals.count = 3`; Finance có `pendingExpenses.count = 2`; Travel Admin thấy `pendingAdminApprovals`.
- Trace:
  - Requirement: `REQ-TR-10`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 9.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT RUN

### TC-034
- US: `US-09`
- Tên Test Case: Dashboard không dữ liệu hiển thị empty state
- Loại kiểm thử: Edge Case
- Mức độ ưu tiên: Medium
- Preconditions: Employee không có trip.
- Test Data: JWT Employee không có dữ liệu.
- Các bước thực hiện: Mở Dashboard.
- Kết quả mong đợi: Hiển thị empty state "Chưa có chuyến đi nào", không hiển thị lỗi.
- Trace:
  - Requirement: `REQ-TR-10`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 9.1`
- Layer: E2E
- Mode: Manual
- Status: NOT RUN

## US-10

### TC-035
- US: `US-10`
- Tên Test Case: Notification SSE, badge và mark read theo owner
- Loại kiểm thử: Integration
- Mức độ ưu tiên: High
- Preconditions: User đã đăng nhập, SSE active, có action nghiệp vụ tạo notification.
- Test Data: Notification chưa đọc của owner và notification của user khác.
- Các bước thực hiện: Tạo sự kiện approve; nhận SSE; mark một notification đã đọc; thử mark notification của user khác.
- Kết quả mong đợi: Owner nhận event và badge tăng; mark read cập nhật `isRead = true` và badge giảm; resource không thuộc owner bị từ chối theo contract.
- Trace:
  - Requirement: `REQ-TR-11`
  - Business Rule: UNKNOWN / CẦN XÁC NHẬN
  - Acceptance Criteria: `AC 10.1`
- Layer: E2E
- Mode: Manual
- Status: NOT RUN

### TC-036
- US: `US-10`
- Tên Test Case: Xuất PDF cho trip `APPROVED`/`CLOSED` có đủ nội dung
- Loại kiểm thử: Integration
- Mức độ ưu tiên: High
- Preconditions: Employee owner hoặc `FINANCE`; trip `APPROVED` và trip `CLOSED` có itinerary, expense, approval history.
- Test Data: Trip ID hợp lệ.
- Các bước thực hiện: Gọi `GET /api/v1/trips/:tripId/export-pdf` cho từng trạng thái.
- Kết quả mong đợi: `UNKNOWN / CẦN XÁC NHẬN` cho execution hiện tại; specification yêu cầu `200`, `Content-Type: application/pdf`, file `trip-report-<tripId>.pdf` gồm thông tin nhân viên, itinerary, chi phí/variance và lịch sử phê duyệt.
- Trace:
  - Requirement: `REQ-TR-12`
  - Business Rule: `BR-TR-06`
  - Acceptance Criteria: `AC 10.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT READY

### TC-037
- US: `US-10`
- Tên Test Case: Chặn PDF ở trạng thái hoặc role không hợp lệ
- Loại kiểm thử: Role / Permission
- Mức độ ưu tiên: High
- Preconditions: Có trip `DRAFT`/`SUBMITTED` và trip của Employee khác.
- Test Data: JWT owner, Employee non-owner và `MANAGER`.
- Các bước thực hiện: Gọi export cho các tổ hợp nêu trên.
- Kết quả mong đợi: Specification yêu cầu `409 INVALID_STATE` cho `DRAFT`/`SUBMITTED`, `403 NOT_OWNER` cho Employee non-owner và `403 FORBIDDEN` cho `MANAGER`; chưa thể xác nhận end-to-end PDF trước khi PDF generator đáp ứng contract.
- Trace:
  - Requirement: `REQ-TR-12`
  - Business Rule: `BR-TR-06`
  - Acceptance Criteria: `AC 10.2`
- Layer: Integration
- Mode: Automated Candidate
- Status: NOT READY

# Traceability Matrix

| US | Requirement | Business Rule | AC | Test Case IDs | Coverage |
|----|-------------|---------------|----|---------------|----------|
| US-01 | REQ-TR-01 | BR-TR-02, BR-TR-03 | AC 1.1, AC 1.2, AC 1.3 | TC-001–TC-004 | Covered |
| US-02 | REQ-TR-02 | BR-TR-06, BR-TR-07 | AC 2.1, AC 2.2 | TC-005–TC-008 | Covered |
| US-03 | REQ-TR-06 | BR-TR-01, BR-TR-06 | AC 3.1, AC 3.2 | TC-009–TC-012 | Covered |
| US-04 | REQ-TR-03 | BR-TR-01, BR-TR-02, BR-TR-03, BR-TR-04 | AC 4.1, AC 4.2 | TC-013–TC-016 | Covered |
| US-05 | REQ-TR-04, REQ-TR-05 | BR-TR-04 | AC 5.1, AC 5.2, AC 5.3 | TC-017–TC-020 | Covered |
| US-06 | REQ-TR-05 | BR-TR-04 | AC 6.1, AC 6.2 | TC-021–TC-023 | Covered |
| US-07 | REQ-TR-07, REQ-TR-08 | BR-TR-05 | AC 7.1, AC 7.2, AC 7.3 | TC-024–TC-027 | Covered |
| US-08 | REQ-TR-09 | BR-TR-05, BR-TR-06 | AC 8.1, AC 8.2, AC 8.3 | TC-028–TC-031 | Covered |
| US-09 | REQ-TR-10 | BR-TR-06 | AC 9.1, AC 9.2 | TC-032–TC-034 | Covered |
| US-10 | REQ-TR-11, REQ-TR-12 | BR-TR-06 | AC 10.1 | TC-035 | Covered |
| US-10 | REQ-TR-12 | BR-TR-06 | AC 10.2 | TC-036–TC-037 | Not Ready |

# Coverage Summary

- Tổng số User Stories: 10.
- Tổng số Test Cases: 37.
- Số Test Case theo US: US-01: 4; US-02: 4; US-03: 4; US-04: 4; US-05: 4; US-06: 3; US-07: 4; US-08: 4; US-09: 3; US-10: 3.
- Số Test Case theo loại kiểm thử: Happy Path 8; Business Rule Validation 7; Input Validation 6; Role / Permission 7; Status / State Transition 3; AI-specific Validation 1; Boundary Case 1; Negative Case 2; Edge Case 1; Integration 1.
- Số Test Case theo Layer: Integration 31; E2E 6; Unit 0; Non-functional 0.
- Số Test Case theo Status: `NOT RUN`: 35; `NOT READY`: 2.
- AC Covered: 22/24; AC Partial: 0; AC Not Covered: 0; AC Not Ready: 2 (`AC 10.2`); AC Unknown: 0.
- Coverage tốt: US-01 đến US-09 có tất cả AC được map vào tối thiểu một test case.
- Phụ thuộc chưa sẵn sàng: US-10 PDF (`AC 10.2`) chưa đáp ứng contract implementation.
- Cần clarification: US-01/BR-TR-02, workflow status `APPROVED_MANAGER`, và các API contract gaps của US-02 được nêu bên dưới.

# QA Findings

## [QA FINDING]
- ID: QAF-001
- Severity: High
- Vị trí: `docs/02-vault/02-requirements/requirements.md` REQ-TR-01; `docs/03-product/user-stories.md` AC 1.1; `docs/05-technical/story-specs/US-01-create-trip-request.md`.
- Vấn đề: REQ-TR-01 mô tả submit thành `SUBMITTED`, trong khi AC 1.1 và story spec mô tả `POST /api/v1/trips` lưu `DRAFT`.
- Evidence: Cùng chức năng tạo Trip Request có hai trạng thái kết quả khác nhau.
- Impact: Không thể kết luận một expected result duy nhất cho hành vi “submit/tạo” ở cấp requirement.
- Đề xuất xử lý: PO/BA xác nhận rõ tách “Lưu nháp” và “Submit”; cập nhật traceability sau khi chốt.

## [QA FINDING]
- ID: QAF-002
- Severity: Medium
- Vị trí: `docs/02-vault/03-domain/business-rules.md` BR-TR-02; `docs/05-technical/story-specs/US-01-create-trip-request.md`.
- Vấn đề: BR-TR-02 nói không cho phép dự toán Per Diem vượt công thức, nhưng US-01 quy định cảnh báo vàng và vẫn cho phép submit/lưu.
- Evidence: Hai artifact mô tả khác nhau về xử lý khi vượt `Max_Per_Diem`.
- Impact: Kỳ vọng pass/fail cho TC-002 và policy flow có thể mâu thuẫn.
- Đề xuất xử lý: Product owner xác nhận hành vi authoritative theo từng thời điểm (lưu nháp, submit, duyệt), rồi đồng bộ Business Rule và story spec.

## [QA FINDING]
- ID: QAF-003
- Severity: High
- Vị trí: `docs/02-vault/03-domain/workflows.md`; `docs/05-technical/ai/ai-feature-spec.md` §11–12; OpenAPI status enum.
- Vấn đề: Workflow dùng `APPROVED_MANAGER`, nhưng API status enum được ghi nhận không có giá trị này.
- Evidence: `ai-feature-spec.md` xác định đây là API Contract Gap.
- Impact: Test state transition Level 1 không thể xác định đầy đủ giữa workflow và API contract.
- Đề xuất xử lý: Architecture/API owner chốt enum và transition canonical trước khi mở rộng regression automation.

## [QA FINDING]
- ID: QAF-004
- Severity: High
- Vị trí: `docs/05-technical/ai/ai-feature-spec.md` §5, §6, §10, §12.
- Vấn đề: Timeout provider 8 giây mâu thuẫn với NFR client-visible ≤ 5 giây; retry semantics và AI apply/`isAiGenerated` chưa nhất quán với itinerary API.
- Evidence: Các API Contract Gap được đặc tả trực tiếp trong `ai-feature-spec.md`.
- Impact: Không thể lập tiêu chí pass/fail quyết định cho timeout end-to-end và apply AI itinerary.
- Đề xuất xử lý: Chốt timeout/latency, số lần retry, endpoint hoặc semantics apply trước khi tạo test case apply/latency có expected result xác định.

## [QA FINDING]
- ID: QAF-005
- Severity: High
- Vị trí: `src/backend/src/controllers/pdf.controller.ts`; `docs/05-technical/story-specs/US-10-notification-pdf.md`.
- Vấn đề: Controller PDF hiện trả `Content-Type: text/html` và file `.html`, trong khi story spec yêu cầu `application/pdf` và file `.pdf`.
- Evidence: `pdf.controller.ts` ghi rõ “deliver HTML as fallback” và set hai header HTML; story spec mô tả Puppeteer/PDF binary.
- Impact: `AC 10.2` không thể thực thi theo specification; TC-036 và TC-037 là `NOT READY`.
- Đề xuất xử lý: Hoàn thiện PDF generator và trả đúng response contract trước khi chạy các ca PDF.

# Future Automation Candidates

| Test Case ID | Lý do phù hợp để automation | Dependency | Điều kiện cần trước khi automation |
|---|---|---|---|
| TC-001 | API deterministic, response/status rõ ràng | DB seed, JWT test user | Fixture ngày giờ ổn định và reset DB |
| TC-003 | Validation server-side có expected result xác định | JWT, clock control | Fixture working-day calendar |
| TC-006 | Guardrail và error code có giá trị regression cao | Deterministic AI provider fixture | Chốt retry semantics trong QAF-004 |
| TC-014–TC-016 | Policy engine và routing có dữ liệu đầu vào xác định | Policy/user seed data | Seed `jobGrade`, destinationType và trip state |
| TC-017–TC-023 | RBAC/state transition dễ lặp lại | Role JWT, transaction-capable DB | Seed hierarchy Manager–Employee |
| TC-024–TC-031 | Công thức variance, immutable guard và workflow có expected rõ | Expense/trip fixtures | Isolated DB transaction fixtures |
| TC-032–TC-033 | Server-side data isolation và aggregate count dễ assert | Multi-user fixtures | Seed dữ liệu theo role |
| TC-036–TC-037 | Contract download có regression value cao | PDF generator | Hoàn thành QAF-005 và PDF text-extraction assertion |
