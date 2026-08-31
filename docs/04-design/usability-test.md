# **Usability Test Plan — Trip Request Flow (prototype.html)**

**Dự án:** Smart Travel & Business Trip Management · **Nhóm:** Nhóm 11 **Đối tượng test:** prototype.html — flow "Tạo Trip Request" (happy path, 3 bước) **Người phụ trách:** UX/UI

> File này gồm 2 phần: (1) **kịch bản test sẵn sàng chạy** với ≥3 người dùng thật — điền kết quả vào bảng ở mục 4 sau khi thực hiện; (2) **heuristic self-review** mà tôi đã tự thực hiện trên chính prototype để phát hiện sớm các vấn đề trước khi test với người dùng thật.

## **1\. Mục tiêu test**

* Xác nhận Employee có thể hoàn tất Trip Request mà **không cần hướng dẫn thêm**.  
* Kiểm tra người dùng có **hiểu đúng** các cảnh báo chính sách (hạn mức khách sạn, urgent trip, cấp duyệt) khi nhìn thấy trên UI, không chỉ là "thấy nhưng lướt qua".  
* Đo thời gian hoàn tất so với mục tiêu JTBD: **\< 5 phút**.

## **2\. Đối tượng & phương pháp**

* **Số lượng:** tối thiểu 3 người, ưu tiên tuyển theo persona: 1 người vai trò tương tự Employee/Sales, 1 người quản lý (proxy cho việc hiểu luồng duyệt), 1 người bất kỳ (kiểm tra tính trực quan không cần kiến thức nghiệp vụ).  
* **Hình thức:** Moderated, think-aloud, remote hoặc trực tiếp, \~15 phút/người.  
* **Công cụ:** Mở trực tiếp prototype.html trên trình duyệt, ghi màn hình \+ ghi âm nếu người tham gia đồng ý.

## **3\. Kịch bản (Task Script)**

Đọc nguyên văn cho người tham gia trước khi bắt đầu:

> "Bạn là nhân viên Sales, vừa được yêu cầu đi công tác TP.HCM gặp khách hàng. Hãy dùng ứng dụng này để tạo yêu cầu công tác đó. Cứ nói to bất cứ điều gì bạn đang nghĩ hoặc thắc mắc trong lúc thao tác."

**Task 1 — Khởi tạo:** Tìm và bắt đầu tạo một Trip Request mới. **Task 2 — Điền thông tin:** Nhập điểm đến, ngày đi/về, mục đích, ngân sách. **Task 3 — Diễn giải:** Sau khi thấy ghi chú hạn mức khách sạn/per diem — hỏi: *"Theo bạn, con số này có ý nghĩa gì?"* **Task 4 — AI Itinerary:** Yêu cầu hệ thống gợi ý lịch trình bằng AI, đọc kết quả và cho biết có tin tưởng dùng kết quả này để nộp không. **Task 5 — Gửi duyệt:** Xem lại thông tin ở bước cuối và gửi yêu cầu. Hỏi: *"Bạn nghĩ yêu cầu này giờ đang chờ ai duyệt?"* **Task 6 — Xác nhận:** Nhìn vào màn hình xác nhận, hỏi: *"Bước tiếp theo là gì, và khi nào bạn biết được kết quả?"*

## **4\. Ghi nhận kết quả (điền sau khi test — ≥3 người)**

| Participant | Vai trò/proxy | Thời gian hoàn tất | Task khó nhất | Lỗi/nhầm lẫn quan sát được | Trích lời (nguyên văn ngắn) | Mức hài lòng (1–5) |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| P-A |  |  |  |  |  |  |
| P-B |  |  |  |  |  |  |
| P-C |  |  |  |  |  |  |

## **5\. Success metrics cần đối chiếu sau test**

| Chỉ số | Ngưỡng mục tiêu |
| ----- | ----- |
| Task completion rate (Task 1–5) | 100% không cần trợ giúp |
| Thời gian hoàn tất trung bình | \< 5 phút |
| Hiểu đúng ý nghĩa cảnh báo policy (Task 3\) | ≥ 2/3 người diễn giải đúng |
| Hiểu đúng "ai đang duyệt tiếp theo" (Task 5–6) | 3/3 người trả lời đúng |

## **6\. Quy trình tổng hợp vấn đề**

Mọi vấn đề phát hiện được **phải chuyển thành issue/decision**, không chỉ ghi lại bằng lời:

1. Log vấn đề vào bảng mục 7 bên dưới ngay trong lúc test (không đợi tổng hợp cuối buổi).  
2. Phân loại mức độ: Blocker (không hoàn tất được task) / Major (hoàn tất nhưng hiểu sai) / Minor (khó chịu nhưng không ảnh hưởng kết quả).  
3. Mọi issue Blocker/Major phải được sửa trên prototype và thêm 1 dòng vào decision-log.md của nhóm nếu thay đổi này ảnh hưởng đến flow hoặc business rule hiển thị.

## **7\. Issue Log (điền song song lúc test)**

| \# | Mức độ | Mô tả vấn đề | Task liên quan | Đề xuất sửa | Trạng thái |
| ----- | ----- | ----- | ----- | ----- | ----- |
|  |  |  |  |  |  |

## **8\. Heuristic Self-Review (đã thực hiện trên prototype.html)**

Trước khi test với người dùng thật, tôi tự rà soát prototype theo 10 heuristics của Nielsen để loại bớt lỗi hiển nhiên. Kết quả:

| \# | Heuristic | Quan sát trên prototype | Mức độ | Đề xuất |
| ----- | ----- | ----- | ----- | ----- |
| 1 | Visibility of system status | AI Itinerary có trạng thái loading rõ (spinner \+ text); stepper luôn hiển thị bước hiện tại | — | OK, giữ nguyên |
| 2 | Match giữa hệ thống và thế giới thực | Dùng đúng thuật ngữ nghiệp vụ (Manager, Travel Admin, Per diem) theo Business Glossary | — | OK |
| 3 | User control & freedom | Có nút "Quay lại" ở mọi bước, nhưng **chưa có cách sửa lại thông tin sau khi đã submit** ở màn hình xác nhận | Minor | Bản đầy đủ cần thêm link "Xem chi tiết yêu cầu" từ Dashboard để chỉnh trước khi Manager duyệt |
| 4 | Consistency & standards | Màu trạng thái nhất quán: vàng \= pending, xanh teal \= approved/ok, đỏ \= vi phạm/reject | — | OK |
| 5 | Error prevention | Cảnh báo urgent-trip xuất hiện **ngay khi chọn ngày**, trước khi người dùng đi tiếp — ngăn lỗi sớm thay vì báo lỗi ở bước cuối | — | OK, đúng chủ đích |
| 6 | Recognition rather than recall | Hạn mức khách sạn/per diem hiển thị ngay trong form nhập ngân sách, không bắt người dùng nhớ hoặc tra cẩm nang | — | Đúng insight từ Theme 1 (user-research.md) |
| 7 | Flexibility & efficiency | Chưa có flow "nộp nhanh không dùng AI" được nhấn mạnh — nút AI trông giống bắt buộc dù thực ra là tùy chọn | Major | Thêm label phụ "(tuỳ chọn)" cạnh nút Sinh lịch trình AI, và cho phép bấm "Bỏ qua, tự nhập lịch trình" |
| 8 | Aesthetic & minimalist design | Mật độ thông tin ở bước Review vừa phải; không bị quá tải | — | OK |
| 9 | Giúp người dùng nhận diện & phục hồi lỗi | Chưa có state lỗi khi để trống trường bắt buộc (VD: bỏ trống điểm đến rồi bấm Tiếp tục) | Major | Thêm validate \+ thông báo lỗi inline trước khi cho qua bước tiếp theo |
| 10 | Help & documentation | Ghi chú hạn mức đóng vai trò "help" tại chỗ, phù hợp cho tác vụ ngắn | — | OK |

### **Ưu tiên sửa trước vòng test với người dùng thật**

1. **Major \#7** — làm rõ bước AI là tuỳ chọn, thêm lối tắt "tự nhập lịch trình".  
2. **Major \#9** — thêm validate bắt buộc trước khi chuyển bước.  
3. **Minor \#3** — cho phép quay lại sửa từ Dashboard trước khi có người duyệt.

Ba mục này nên được đưa vào Issue Log (mục 7\) làm issue có sẵn Status: Open trước khi bắt đầu buổi test với người dùng thật, để không phải phát hiện lại từ đầu.

