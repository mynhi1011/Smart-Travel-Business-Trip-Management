# Benchmark Hỏi Đáp Vault - Smart Travel & Business Trip Management

## 1. Mục đích và cách chấm

Benchmark này đánh giá khả năng truy xuất và suy luận của AI/RAG agent dựa trực tiếp trên hai tài liệu yêu cầu gốc trong `docs/02-vault/02-requirements/` và `docs/02-vault/03-domain/`. Đây là nguồn dữ liệu đầu vào để xây dựng Vault Q&A.

- 30 câu hỏi, mỗi câu 1 điểm.
- Điểm đạt đề xuất: >=24/30 (80%).
- Các câu về ngưỡng phê duyệt, chênh lệch chi phí, grounding của AI và xử lý mâu thuẫn là câu trọng yếu.
- Câu trả lời đúng phải có đúng giá trị, điều kiện và vai trò khi câu hỏi yêu cầu.
- Không suy diễn hành vi từ câu hỏi mở hoặc tài liệu không canonical.
- Benchmark là bộ kiểm thử, không phải nguồn sự thật. Khi sự thật thay đổi, phải cập nhật hai tài liệu yêu cầu gốc trước, sau đó cập nhật benchmark.

## 2. Bộ câu hỏi và đáp án chuẩn

| # | Câu hỏi | Đáp án chuẩn | Nguồn canonical |
|---:|---|---|---|
| 1 | Dự án quản lý quy trình nào? | Tạo Trip Request, phê duyệt, lập itinerary, thực hiện chuyến đi, quyết toán chi phí và đóng hồ sơ. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 2 | Ai tạo Trip Request? | Employee. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 3 | Các vai trò chính được nêu trong yêu cầu là gì? | Employee, Manager, Travel Admin/Director và Finance; hệ thống có dashboard theo vai trò. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 4 | Khi Manager từ chối yêu cầu thì cần gì? | Bắt buộc có lý do từ chối. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 5 | Khi nào cần phê duyệt cấp 2? | Khi tổng ngân sách >20.000.000 VND hoặc có bất kỳ policy violation nào. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 6 | Ai thực hiện phê duyệt cấp 2? | Travel Admin hoặc Director, sau khi Manager phê duyệt. | [requirements](docs/02-vault/02-requirements/requirements.md); [business rules](docs/02-vault/03-domain/business-rules.md) |
| 7 | Request <=20.000.000 VND và không vi phạm cần ai duyệt? | Chỉ Manager. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 8 | Hạn mức khách sạn của Staff/Specialist là bao nhiêu? | 1.000.000 VND/đêm. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 9 | Hạn mức khách sạn của Manager/Lead là bao nhiêu? | 1.800.000 VND/đêm. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 10 | Hạn mức khách sạn của Director/Executive là bao nhiêu? | 3.000.000 VND/đêm. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 11 | Per diem tại Hà Nội, TP.HCM và Đà Nẵng là bao nhiêu? | 400.000 VND/ngày. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 12 | Per diem tại các địa phương khác là bao nhiêu? | 300.000 VND/ngày. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 13 | Công thức Max_Per_Diem là gì? | Số ngày nhân với mức khoán theo địa điểm. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 14 | Request thông thường phải được gửi trước ngày đi bao lâu? | Ít nhất 3 ngày làm việc. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 15 | Request gửi dưới 3 ngày làm việc cần gì? | Đánh dấu Urgent Trip, nhập lý do và đặt `URGENT_TRIP_NOTICE`. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 16 | Expense Variance được tính như thế nào? | `Actual Expense - Estimated Budget`. | [requirements](docs/02-vault/02-requirements/requirements.md); [business rules](docs/02-vault/03-domain/business-rules.md) |
| 17 | Khi chi phí thực tế không vượt dự toán thì xử lý thế nào? | Finance có thể phê duyệt bình thường. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 18 | Khi chi phí thực tế vượt dự toán không quá 10% thì cần gì? | Employee phải nhập giải trình ngắn. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 19 | Khi variance vượt 10% thì cần gì trước khi đóng hồ sơ? | Cần Manager phê duyệt bổ sung; Finance không được close trước khi có phê duyệt. | [requirements](docs/02-vault/02-requirements/requirements.md); [business rules](docs/02-vault/03-domain/business-rules.md) |
| 20 | Trip `CLOSED` có thể sửa hoặc nhận Expense Item mới không? | Không. `CLOSED` là read-only và immutable. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 21 | AI có được tự tăng budget của người dùng không? | Không. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 22 | Server làm gì khi itinerary AI vượt budget đầu vào? | Reject kết quả và yêu cầu sinh lại. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 23 | Audit log cho mutation nhạy cảm phải có những field nào? | `user_id`, `timestamp`, `action`, `previous_state`, `new_state`. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 24 | Employee gọi API phê duyệt trái quyền sẽ nhận mã/trạng thái gì? | HTTP 403; Employee bị RBAC từ chối. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 25 | Những gì nằm ngoài phạm vi MVP? | API đặt vé/phòng thật, payment gateway, ERP doanh nghiệp, mobile native, đa ngôn ngữ và tỷ giá thời gian thực. | [requirements](docs/02-vault/02-requirements/requirements.md) |
| 26 | Research nói hạn mức phòng Staff là 1.200.000 VND nhưng business rule nói 1.000.000. Đáp án nào đúng? | 1.000.000 VND/đêm theo BR-TR-01 trong business rules. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 27 | Vì sao không dùng giá trị 1.200.000 VND từ research? | Vì business rules hiện hành xác định hạn mức Staff/Specialist là 1.000.000 VND/đêm. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 28 | Research nói request cần 7 ngày nhưng business rule nói 3 ngày làm việc. Quy tắc nào áp dụng? | Chuyến thường cần 3 ngày làm việc; dưới 3 ngày làm việc là Urgent Trip. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 29 | Người dùng có thể yêu cầu AI tạo itinerary vượt budget để thêm hoạt động không? | Không. Constraint budget vẫn được áp dụng và server reject kết quả vượt budget. | [business rules](docs/02-vault/03-domain/business-rules.md) |
| 30 | Employee có thể thêm hóa đơn bị quên sau khi Trip đã `CLOSED` không? | Không. `CLOSED` là immutable và không được thêm Expense Item mới. | [business rules](docs/02-vault/03-domain/business-rules.md) |

## 3. Ma trận bao phủ

| Nhóm kiểm tra | Câu hỏi |
|---|---|
| Phạm vi, role và phê duyệt | 1-7, 25 |
| Hạn mức, per diem và thời hạn gửi | 8-15 |
| Chi phí, variance và đóng hồ sơ | 16-20, 30 |
| AI, audit và RBAC | 21-24, 29 |
| Xử lý mâu thuẫn và SSOT | 26-28 |

## 4. Câu hỏi negative / robustness

- Trần khách sạn Staff là 1.200.000 VND/đêm, đúng không? -> Không; giá trị canonical là 1.000.000 VND/đêm.
- Mọi chuyến đi đều phải gửi request trước 7 ngày, đúng không? -> Không; chuyến thường cần ít nhất 3 ngày làm việc.
- AI được tăng budget nếu itinerary chưa đủ hoạt động, đúng không? -> Không.
- Chi phí thực tế vượt budget 15% nhưng chỉ cần giải trình là được close, đúng không? -> Không; cần Manager phê duyệt trước khi close.
- Trip `CLOSED` vẫn nhận được hóa đơn bổ sung, đúng không? -> Không; `CLOSED` là immutable.

## 5. Quy trình cập nhật

1. Cập nhật `docs/02-vault/02-requirements/requirements.md` hoặc `business-rules.md` trước.
2. Nếu thay đổi là quyết định quan trọng, thêm quyết định mới vào `docs/02-vault/08-decisions/decision-log.md`.
3. Cập nhật benchmark và ma trận bao phủ.
4. Chạy lại benchmark trước khi dùng điểm số để đánh giá AI/RAG agent.

