# Business Rules - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Mục đích:** Quy định toàn bộ logic nghiệp vụ, công thức tính toán, hạn mức chi phí và quy tắc phê duyệt bắt buộc của hệ thống.

---

## 1. Danh sách Quy tắc Nghiệp vụ (Business Rules)

| ID | Tên Quy tắc | Nội dung logic & Công thức áp dụng | Xử lý vi phạm / Ràng buộc hệ thống | Nguồn gốc / Quyết định |
|---|---|---|---|---|
| **BR-TR-01** | Hạn mức lưu trú theo Cấp bậc (Accommodation Limit) | Hạn mức **tham chiếu** chi phí phòng khách sạn tối đa cho 1 đêm theo cấp bậc người dùng đăng nhập: **Staff/Specialist:** 1.000.000 VNĐ; **Manager/Lead:** 1.800.000 VNĐ; **Director/Executive:** 3.000.000 VNĐ. Hằng số `HOTEL_LIMIT_PER_NIGHT` trong `policyRules.ts`. | **Không** phát sinh cảnh báo hoặc yêu cầu nhập lý do riêng. Hạn mức được dùng để tính tổng hạn mức kết hợp tại BR-TR-08. | Decision **D-06**, cập nhật **D-16** |
| **BR-TR-02** | Phụ cấp công tác phí hàng ngày (Per Diem Allowance) | Mức phụ cấp **tham chiếu** theo loại điểm đến: **Đô thị Tier 1** (Hà Nội, TP.HCM, Đà Nẵng): 400.000 VNĐ/ngày; **các tỉnh thành khác:** 300.000 VNĐ/ngày. Hằng số `PER_DIEM_RATE` trong `policyRules.ts`. | **Không** phát sinh cảnh báo hoặc yêu cầu nhập lý do riêng. Mức phụ cấp được dùng để tính tổng hạn mức kết hợp tại BR-TR-08. | Travel Policy Standard, cập nhật **D-10**, **D-16** |
| **BR-TR-03** | Quy tắc thời gian gửi yêu cầu trước chuyến đi (Advance Notice Rule) | Yêu cầu công tác phải được tạo và gửi phê duyệt trước ngày khởi hành tối thiểu **3 ngày làm việc** (bỏ Thứ 7, Chủ nhật). Nếu gửi dưới 3 ngày làm việc: hệ thống xác định là **chuyến đi khẩn cấp**, yêu cầu tích `Chuyến đi khẩn cấp` và nhập lý do (≥ 10 ký tự). | Gắn cờ `isUrgent = true`, lưu `urgencyReason`. **Chuyến khẩn cấp dẫn tới duyệt 2 cấp** (xem BR-TR-04 điều kiện 1). Violation `URGENT_TRIP_NOTICE` được đưa vào `approvalReasons` snapshot. | Decision **D-07**, cập nhật **D-16** |
| **BR-TR-04** | Ma trận cấp bậc phê duyệt (Approval Level Matrix) | Yêu cầu bắt buộc duyệt 2 cấp (Manager cấp 1 → Travel Admin/Director cấp 2, status `PENDING_ADMIN_APPROVAL`) khi thỏa **bất kỳ** điều kiện nào: **(1) URGENT_TRIP** — chuyến đi khẩn cấp (BR-TR-03); **(2) BUDGET_OVER_THRESHOLD** — `plannedBudget > 20.000.000 VNĐ`; **(3) COMBINED_COST_LIMIT_EXCEEDED** — vi phạm BR-TR-08. Nếu không thỏa điều kiện nào → 1 cấp (Manager), status `APPROVED` sau khi Manager duyệt. | Hệ thống tính `approvalReasons[]` tại lúc submit, lưu snapshot vào `Trip.approvalReasons`. `requiresLevel2 = approvalReasons.length > 0`. Sau khi Manager duyệt, nếu `requiresLevel2 = true` → status `PENDING_ADMIN_APPROVAL`. Lý do hiển thị chi tiết cho Manager (cấp 1) và Travel Admin (cấp 2). | Workflow Standard, cập nhật **D-16** |
| **BR-TR-05** | Ngưỡng cho phép vượt chi phí quyết toán (Expense Variance Tolerance) | Khi nộp Expense Claim sau chuyến đi: `Tổng chi thực tế ≤ Tổng dự toán` → Finance duyệt bình thường. Vượt ≤ 10%: cần giải trình. Vượt > 10%: cần Manager duyệt bổ sung trước khi Finance đóng hồ sơ. | Chặn nút Approve của Finance nếu vượt >10% chưa có chữ ký Manager. | Financial Governance |
| **BR-TR-06** | Tính bất biến của hồ sơ đã đóng (Closed Trip Immutability) | Khi Trip đã `CLOSED`: toàn bộ thông tin, lịch trình, chi phí là chỉ đọc. `approvalReasons` snapshot cũng bất biến. | Chặn write; `409 TRIP_IMMUTABLE`. | Audit Trail Standard |
| **BR-TR-07** | Nguyên tắc kiểm soát AI Itinerary (AI Grounding Rule) | AI chỉ sinh lịch trình dựa trên `plannedBudget` người dùng nhập. Không tự tăng ngân sách. | Engine reject kết quả AI nếu tổng cost > `plannedBudget`. | AI Guardrail Rule |
| **BR-TR-08** | Kiểm tra tổng hạn mức lưu trú và phụ cấp công tác ([đặc tả riêng](BR-TR-08-combined-cost-limit.md)) | `Combined_Actual = plannedBudget`; `Combined_Limit = (HOTEL_LIMIT[jobGrade] × hotelNights) + (tripDays × PER_DIEM_RATE[destinationType])`. `jobGrade` lấy từ user đăng nhập (không từ client). `destinationType` tự suy từ tên điểm đến (`resolveDestinationType`). | Nếu `Combined_Actual > Combined_Limit`: **đúng một cảnh báo tổng hợp** `COMBINED_COST_LIMIT_EXCEEDED`, tính là vi phạm Policy → duyệt 2 cấp. Nếu ≤: không cảnh báo. Không yêu cầu nhập lý do, không chặn submit. | D-15, **D-16** |

---

## 2. Ghi chú bổ sung

### BR-TR-04 — approvalReasons hiển thị

Mỗi lý do là object `{ code, title, detail, data }`:
- `URGENT_TRIP` → "Yêu cầu gửi dưới 3 ngày làm việc trước ngày khởi hành. Lý do khẩn cấp: …"
- `BUDGET_OVER_THRESHOLD` → "Ngân sách dự kiến X VNĐ vượt ngưỡng 20.000.000 VNĐ."
- `COMBINED_COST_LIMIT_EXCEEDED` → "Vi phạm chính sách: Ngân sách dự kiến X VNĐ vượt tổng hạn mức Y VNĐ (cấp bậc, N ngày / M đêm, điểm đến)."

Snapshot được tính tại lúc Employee submit, lưu vào `Trip.approvalReasons` (JSON). Trip bị từ chối → Employee sửa → gửi lại thì tính lại và ghi đè. Trip CLOSED thì snapshot bất biến (BR-TR-06).

### BR-TR-03 — Chuyến khẩn cấp

Chuyến đi khẩn cấp (gửi dưới 3 ngày làm việc) **tự động dẫn tới duyệt 2 cấp** theo BR-TR-04 điều kiện 1. Đây là hành vi có chủ đích (D-07, D-16).
