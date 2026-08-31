# Business Rules - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management  
**Nhóm:** Nhóm 11 - MIS3032_1  
**Mục đích:** Quy định toàn bộ logic nghiệp vụ, công thức tính toán, hạn mức chi phí và quy tắc phê duyệt bắt buộc của hệ thống.

---

## 1. Danh sách Quy tắc Nghiệp vụ (Business Rules)

| ID | Tên Quy tắc | Nội dung logic & Công thức áp dụng | Xử lý vi phạm / Ràng buộc hệ thống | Nguồn gốc / Quyết định |
|---|---|---|---|---|
| **BR-TR-01** | Hạn mức lưu trú theo Cấp bậc (Accommodation Limit) | Hạn mức chi phí phòng khách sạn tối đa cho 1 đêm: <br>• **Staff/Specialist:** Tối đa 1.000.000 VNĐ/đêm <br>• **Manager/Lead:** Tối đa 1.800.000 VNĐ/đêm <br>• **Director/Executive:** Tối đa 3.000.000 VNĐ/đêm | Nếu chi phí khách sạn dự toán/thực tế vượt hạn mức, hệ thống gắn cờ cảnh báo `POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET`. Bắt buộc nhập trường lý do giải trình. | Decision **D-06** (Chuẩn hoá trần cho hệ thống nhóm) |
| **BR-TR-02** | Phụ cấp công tác phí hàng ngày (Per Diem Allowance) | Mức công tác phí (ăn uống, đi lại nội địa) cố định khoán theo ngày: <br>• Đô thị loại 1 (Hà Nội, TP.HCM, Đà Nẵng): **400.000 VNĐ/ngày** <br>• Các tỉnh thành khác: **300.000 VNĐ/ngày** | Hệ thống tự động tính `Max_Per_Diem = Số ngày * Mức khoán`. Không cho phép dự toán mục Per Diem vượt quá công thức này. | Travel Policy Standard |
| **BR-TR-03** | Quy tắc thời gian gửi yêu cầu trước chuyến đi (Advance Notice Rule) | Yêu cầu công tác phải được tạo và gửi phê duyệt trước ngày khởi hành tối thiểu: <br>• Chuyến đi thông thường: **Trước ít nhất 3 ngày làm việc** <br>• Chuyến đi khẩn cấp (Urgent Trip): Dưới 3 ngày | Nếu gửi dưới 3 ngày, hệ thống yêu cầu tích chọn `Chuyến đi khẩn cấp` và bắt buộc nhập lý do khẩn cấp; gắn cờ cảnh báo `URGENT_TRIP_NOTICE`. | Decision **D-07** (SLA phê duyệt nội bộ hệ thống) |
| **BR-TR-04** | Ma trận cấp bậc phê duyệt ngân sách (Approval Level Matrix) | Phân tầng cấp phê duyệt dựa trên tổng dự toán chuyến đi: <br>• **Tổng ngân sách ≤ 20.000.000 VNĐ và Không vi phạm Policy:** Chỉ cần 1 cấp duyệt (**Manager**). <br>• **Tổng ngân sách > 20.000.000 VNĐ HOẶC Có vi phạm Policy:** Bắt buộc 2 cấp duyệt (**Manager** duyệt Cấp 1 → chuyển tiếp **Travel Admin / Director** duyệt Cấp 2). | Hệ thống tự động chuyển tiếp trạng thái duyệt: sau khi Manager duyệt, nếu thỏa điều kiện cấp 2, status chuyển sang `PENDING_ADMIN_APPROVAL` thay vì `APPROVED`. | Workflow Standard |
| **BR-TR-05** | Ngưỡng cho phép vượt chi phí quyết toán (Expense Variance Tolerance) | Khi nộp Expense Claim sau chuyến đi: <br>• Nếu `Tổng chi thực tế ≤ Tổng dự toán`: Finance duyệt bình thường. <br>• Nếu `Tổng chi thực tế > Tổng dự toán` nhưng trong mức **≤ 10%**: Cần Employee nhập giải trình ngắn. <br>• Nếu `Tổng chi thực tế vượt > 10%`: Bắt buộc chuyển lại cho Manager phê duyệt bổ sung phần chênh lệch trước khi Finance được phép bấm Close. | Chặn nút Approve của Finance nếu phát sinh vượt >10% chưa có chữ ký duyệt bổ sung của Manager. | Financial Governance |
| **BR-TR-06** | Tính bất biến của hồ sơ đã đóng (Closed Trip Immutability) | Khi Trip Request đã chuyển sang trạng thái `CLOSED` (đã quyết toán chi phí): Toàn bộ thông tin yêu cầu, lịch trình, danh sách chi phí trở thành dữ liệu chỉ đọc (Read-only / Immutable). | Chặn toàn bộ hành vi sửa/xóa dữ liệu; không cho phép thêm bất kỳ Expense Item nào vào Trip đã đóng. | Audit Trail Standard |
| **BR-TR-07** | Nguyên tắc kiểm soát AI Itinerary (AI Grounding Rule) | Khi AI sinh gợi ý lịch trình: AI chỉ được sinh danh sách hoạt động và phân bổ chi phí dựa trên điểm đến và trần ngân sách được người dùng nhập vào. AI **không được** tự ý tăng ngân sách dự toán vượt quá số tiền Employee đã nhập. | Engine kiểm tra server-side: Nếu tổng chi phí trong itinerary AI sinh ra vượt quá budget đầu vào, hệ thống tự động reject kết quả của AI và yêu cầu prompt lại. | AI Guardrail Rule |

---

