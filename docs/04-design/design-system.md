## **1\. Design Tokens**

### **1.1 Bảng màu (Color Palette)**

Tông chủ đạo navy gần đen kết hợp xanh lá emerald làm màu thương hiệu, cam làm điểm nhấn nhãn phân loại, 4 màu trạng thái riêng cho quy trình phê duyệt.

| Token | Hex | Dùng cho |
| ----- | ----- | ----- |
| `color/navy-800` | `#1B2A38` | Header, nút Primary, nền stepper |
| `color/brand-green` | `#0F9D68` | Logo, link, trạng thái thành công |
| `color/accent-orange` | `#E8730A` | Eyebrow label, bước đang active |
| `color/page-bg` | `#F5F6F8` | Nền toàn trang |
| `color/ink-900` | `#111827` | Text tiêu đề chính |
| `color/ink-500` | `#6B7280` | Text phụ, mô tả |
| `color/line-200` | `#E5E7EB` | Viền input, viền card |
| `color/white` | `#FFFFFF` | Nền card, input |

### **1.2 Màu trạng thái (Status Colors)**

4 cặp màu nền-nhạt / chữ-đậm dùng riêng cho badge trạng thái trong luồng phê duyệt.

| Trạng thái | Nền | Chữ |
| ----- | ----- | ----- |
| Chờ duyệt cấp 1 (Amber) | `#FDF1CC` | `#B4790C` |
| Chờ duyệt cấp 2 (Blue) | `#DCEBFE` | `#2563C9` |
| Đã duyệt (Green) | `#E4F8EF` | `#0C8557` |
| Đã khai chi phí (Purple) | `#EFE6FB` | `#7C3FC4` |

### **1.3 Hệ màu theo vai trò (Role Identity)**

Mỗi vai trò có màu logo/thương hiệu riêng để nhận diện dashboard. Phần còn lại của UI (nền, chữ, card) giữ nguyên hệ trung tính.

| Role | Màu |
| ----- | ----- |
| `role/employee` | `#0F9D68` |
| `role/manager` | `#12A79B` |
| `role/admin` | `#7C3AED` |
| `role/finance` | `#E8890B` |

### **1.4 Typography**

Font: Inter. Tiêu đề đậm (800), text phụ nhẹ màu xám, eyebrow viết hoa giãn chữ màu cam.

| Style | Ví dụ | Size / Weight |
| ----- | ----- | ----- |
| H1 | "Chào mừng trở lại" | 32px / 800 |
| H2 | "Tạo yêu cầu công tác" | 22px / 800 |
| H3 | "Đà Nẵng → TP.HCM" | 16px / 700 |
| Eyebrow | "NEW TRIP REQUEST" | 12px / 700 / uppercase |
| Body | "Theo dõi, tạo mới hoặc khai báo chi phí thực tế." | 15px / 400 |
| Label | "Email" | 13px / 600 |
| Muted/Caption | "Hoàn tất 3 bước — hệ thống tự kiểm tra chính sách." | 13.5px / 400 |

### **1.5 Spacing & Bo góc**

**Spacing scale:** `4 (xs)` · `8 (sm)` · `16 (md)` · `24 (lg)` · `32 (xl)` · `48 (2xl)`

**Radius:** `sm 6px` · `md 10px` · `lg 16px` · `full`

---

## **2\. Components & States**

> Mỗi component dưới đây liệt kê đủ **Default / Hover / Focus / Disabled / Loading / Error / Empty** khi state đó áp dụng được cho component đó. State không áp dụng được thì ghi "—".

### **2.1 Navbar**

Nền navy đậm, logo bo vuông trái, cụm role \+ tên người dùng ở giữa-phải, chuông thông báo (chấm đỏ báo số chưa đọc) \+ nút đăng xuất viền mảnh ở ngoài cùng phải.

| State | Mô tả |
| ----- | ----- |
| Default | Logo màu theo role, chuông không chấm đỏ |
| Có thông báo mới | Chấm đỏ nhỏ góc trên-phải icon chuông, kèm số lượng nếu ≤9 (10+ hiện "9+") |
| Hover (nút đăng xuất) | Viền đậm hơn, nền `#FFFFFF1A` (trắng 10% trên navy) |
| Loading (đang tải thông tin user) | Skeleton bar thay avatar/tên, giữ nguyên layout |

### **2.2 Nút bấm (Buttons)**

3 cấp: Primary (navy đặc), Secondary (viền mảnh nền trắng), Ghost (không viền).

| State | Primary | Secondary | Ghost |
| ----- | ----- | ----- | ----- |
| Default | Nền `navy-800`, chữ trắng | Viền `line-200`, chữ `ink-900` | Không viền, chữ `ink-500` |
| Hover | Nền tối hơn 8% | Nền `page-bg` | Chữ `ink-900`, nền `page-bg` nhạt |
| Focus (bàn phím) | Viền outline 2px màu brand-green, offset 2px | như trên | như trên |
| Disabled | Nền `#9CA3AF`, chữ `#E5E7EB`, không hover | Viền/chữ opacity 40%, không hover | Chữ opacity 40% |
| Loading | Spinner thay icon/chữ, giữ nguyên kích thước nút, disable click | như Primary | như Primary |

**Quy tắc riêng:** nút quyết định (Duyệt/Từ chối) không dùng navy — dùng cặp ngữ nghĩa xanh lá–đỏ (xem 2.9 Decision Panel).

### **2.3 Trường nhập liệu (Form Fields)**

Nền trắng, viền xám 1px, bo 10px, label đậm nhỏ phía trên.

| State | Mô tả |
| ----- | ----- |
| Default | Viền `line-200` |
| Focus | Viền `navy-800` hoặc `brand-green` 1.5px, không đổ bóng ngoài |
| Filled | Viền `line-200`, chữ `ink-900` |
| Disabled | Nền `#F3F4F6`, chữ `ink-500`, con trỏ `not-allowed` |
| Error | Viền đỏ `#DC2626` 1.5px, icon cảnh báo đỏ bên phải input, dòng helper text đỏ ngay dưới field |
| Loading (validate async, vd check email trùng) | Spinner nhỏ bên phải input, viền giữ `line-200` |

### **2.4 Badge trạng thái**

Pill, chữ đậm, thể hiện trạng thái xuyên suốt vòng đời hồ sơ.

| Loại | State |
| ----- | ----- |
| Status badge | 6 trạng thái cố định (Chờ duyệt cấp 1 → Đã đóng hồ sơ) — không có state tương tác, chỉ hiển thị |
| Flag badge | Ẩn mặc định (Default \= không hiện); chỉ xuất hiện khi hồ sơ có ⚠ Cảnh báo hoặc ⊘ Vi phạm (đây chính là "error state" ở cấp hồ sơ) |
| Counter badge | Ẩn khi số đếm \= 0 (Empty); hiện số khi \> 0; hiện "9+" khi \> 9 |

### **2.5 Thẻ chuyến đi (Trip Card)**

Card hàng ngang: tuyến đi \+ mã hồ sơ trái, nút hành động phụ \+ badge trạng thái phải.

| State | Mô tả |
| ----- | ----- |
| Default | Nền trắng, viền `line-200` |
| Hover | Đổ bóng nhẹ `shadow-sm`, viền đậm hơn, con trỏ pointer (cả card clickable) |
| Loading (skeleton khi tải danh sách) | Khối xám bo góc thay text, animate pulse |
| Empty (không có trip nào) | Xem UX Copy §3.2 — illustration nhạt \+ CTA "+ Tạo Trip Request" |
| Vi phạm chính sách | Viền trái 3px màu đỏ, kèm Flag badge |

### **2.6 Stepper ngang (Wizard 3 bước)**

Nền navy full-width, bước hiện tại tô cam, các bước còn lại mờ 45% opacity trắng.

| State | Mô tả |
| ----- | ----- |
| Chưa tới (upcoming) | Opacity 45%, số bước trong vòng tròn viền mảnh |
| Đang active | Nền cam đặc, chữ trắng, không mờ |
| Đã hoàn tất | Icon ✓ thay số, nền `brand-green` |
| Có lỗi ở bước đã qua | Icon ⚠ đỏ thay ✓, cho phép click quay lại sửa |

### **2.7 Timeline phê duyệt (dọc)**

Chuỗi vòng tròn nối đường thẳng đứng.

| State | Màu |
| ----- | ----- |
| Hoàn tất | Xanh lá `brand-green` |
| Đang xử lý | Navy `navy-800`, có thể thêm icon đồng hồ nhỏ (loading state) |
| Chưa tới lượt | Xám `#D1D5DB` |
| Bị từ chối (dừng luồng) | Đỏ `#DC2626`, các bước sau chuyển xám vĩnh viễn, không còn "chưa tới lượt" mà là "đã huỷ" |

### **2.8 Stat Card (KPI tổng quan — Finance)**

Label xám nhỏ trên, số liệu lớn đậm dưới.

| State | Mô tả |
| ----- | ----- |
| Default | Số liệu màu theo ý nghĩa (cam \= đang chờ, xanh lá \= hoàn tất, tím \= số tiền) |
| Loading | Số liệu thay bằng skeleton bar, label vẫn hiện |
| Empty (0 hồ sơ trong kỳ) | Hiện "0" thật, không ẩn card — tránh gây hiểu nhầm là lỗi tải dữ liệu |

### **2.9 Tabs có bộ đếm**

Lọc danh sách hồ sơ theo trạng thái. Tab active dùng màu role của dashboard.

| State | Mô tả |
| ----- | ----- |
| Default (inactive) | Chữ `ink-500`, không viền dưới |
| Active | Chữ đậm màu role, viền dưới 2px cùng màu |
| Hover (inactive) | Chữ `ink-900`, nền `page-bg` nhạt |
| Counter \= 0 | Vẫn hiện số "0" mờ, không ẩn tab |
| Disabled (tab chưa có quyền xem) | Chữ opacity 30%, không click được, có thể kèm tooltip lý do |

### **2.10 Decision Panel (Duyệt / Từ chối)**

Khối cố định bên phải màn chi tiết hồ sơ. Ô ghi chú \+ 2 nút xếp chồng full-width.

| State | Mô tả |
| ----- | ----- |
| Default | Nút "Duyệt/Phê duyệt cấp 2" xanh lá (Manager) hoặc tím role-admin (cấp 2); nút "Từ chối" luôn đỏ |
| Hồ sơ vi phạm chính sách (bắt buộc ghi chú) | Tiêu đề panel gắn nhãn phụ "(ghi chú bắt buộc)" màu đỏ, ô ghi chú viền đỏ, 2 nút disable cho tới khi nhập đủ |
| Loading (đang submit quyết định) | Nút được bấm chuyển spinner, nút còn lại disable, ô ghi chú readonly |
| Error (submit thất bại — vd mất mạng) | Banner đỏ nhỏ trong panel: xem UX Copy §3.1 |
| Đã quyết định xong (readonly) | Toàn panel disable, hiện lại quyết định đã chọn \+ tên người duyệt \+ timestamp thay vì 2 nút |

### **2.11 Layout chi tiết hồ sơ (2 cột)**

Cột trái info-card chỉ đọc, cột phải cố định chứa Decision Panel. Dùng chung cho Manager & Travel Admin.

| State | Mô tả |
| ----- | ----- |
| Loading (tải hồ sơ) | Toàn bộ cột trái hiện skeleton card, Decision Panel ẩn tới khi data về |
| Error (không tải được hồ sơ) | Thay cả layout bằng thông báo lỗi \+ nút "Thử lại" — xem UX Copy §3.1 |
| Không có quyền xem | Chuyển hướng hoặc hiện thông báo 403 rõ ràng, không hiện layout rỗng |

### **2.12 Bảng tổng hợp chi phí**

Dòng nhãn \+ số dự toán mờ nhỏ dưới, ô input số bên phải; hàng tổng kết nền xám nhạt.

| State | Mô tả |
| ----- | ----- |
| Default | Input trống, placeholder \= giá trị dự toán mờ |
| Filled | Dòng "Tiết kiệm" cập nhật real-time màu xanh brand (dương) hoặc đỏ (âm — vượt dự toán) |
| Error (nhập số âm hoặc không hợp lệ) | Viền đỏ ô input, helper text ngay dưới ô đó |
| Empty (chưa khai khoản nào) | Xem UX Copy §3.2 |

### **2.13 Banner cảnh báo (Alert)**

3 mức: Error/Vi phạm (đỏ), Warning/Cảnh báo (vàng), Info (xanh dương).

| State | Hành vi |
| ----- | ----- |
| Error | Chặn hành động submit, bắt buộc ghi chú ở Decision Panel nếu có |
| Warning | Chỉ nhắc nhở, không chặn, có nút "Đã hiểu" để ẩn tạm |
| Info | Giải thích lý do một bước bổ sung xuất hiện, không có nút hành động |
| Loading (đang chạy policy check) | Banner dạng skeleton mờ "Đang kiểm tra chính sách…" trước khi kết quả về |

### **2.14 Luồng đăng ký tài khoản (2 bước)**

Stepper 2 bước \+ role-card ở bước 1, account chip ở bước 2\.

| State | Mô tả |
| ----- | ----- |
| Role-card default | Viền `line-200`, logo màu role mờ |
| Role-card selected | Viền đậm 2px màu role, logo đủ màu |
| Error (email đã tồn tại) | Viền đỏ ô email \+ helper text — xem UX Copy §3.1 |
| Loading (đang tạo tài khoản) | Nút "Tiếp tục →" chuyển spinner, toàn form disable |

### **2.15 Dòng khoản chi (Expense Line Item)**

Card thu gọn được, icon \+ tên khoản đầu, dự toán mờ góc phải.

| State | Mô tả |
| ----- | ----- |
| Collapsed (default) | Chỉ hiện tên khoản \+ dự toán \+ tổng đã nhập |
| Expanded | Hiện 2 hàng field: Ngày chi/Tên khoản/Số tiền thực tế \+ Mô tả chứng từ/Đính kèm |
| Đã đính kèm biên nhận | Icon file \+ tên file thay nút "Chọn", có nút "Xem"/"Xoá" |
| Error (thiếu biên nhận bắt buộc, hoặc số tiền vượt ngưỡng) | Viền trái đỏ 3px, badge "⚠" nhỏ cạnh tên khoản |
| Loading (đang upload biên nhận) | Progress bar mảnh dưới nút "Chọn" |
| Empty (khoản mục có sẵn nhưng chưa nhập gì) | Số tiền hiện "—" thay vì "0đ" để phân biệt "chưa nhập" với "nhập 0đ" |

### **2.16 Summary Card (Tóm tắt chi phí)**

Cố định bên phải form khai chi phí.

| State | Mô tả |
| ----- | ----- |
| Default | Tổng dự toán, tổng thực tế, % tiết kiệm |
| Loading | Số liệu skeleton trong lúc các dòng chi phí đang tính lại |
| Vượt dự toán | % hiện màu đỏ thay vì xanh brand, nút hành động chính vẫn bấm được nhưng kèm icon cảnh báo nhỏ |
| Disabled (chưa đủ điều kiện submit) | Nút hành động chính mờ, tooltip giải thích lý do khi hover |

### **2.17 Bảng so sánh chi phí (Finance)**

Liệt kê khoản mục kèm nhà cung cấp, so dự toán/thực tế/% chênh lệch.

| State | Mô tả |
| ----- | ----- |
| Default | Chênh dương \= đỏ, chênh âm (tiết kiệm) \= xanh |
| Empty (chưa có hồ sơ nào cần đối soát) | Xem UX Copy §3.2 |
| Loading | Skeleton rows, hàng "Tổng cộng" ẩn tới khi data đủ |

---

## **3\. UX Copy Library**

> Nguyên tắc: **luôn nói rõ chuyện gì đã xảy ra và người dùng cần làm gì tiếp theo.** Không dùng câu chung chung như "Có lỗi xảy ra", "Đã có lỗi", "Vui lòng thử lại sau" (không kèm lý do).

### **3.1 Error messages**

| Tình huống | ❌ Tránh | ✅ Dùng |
| ----- | ----- | ----- |
| Sai định dạng email | "Có lỗi xảy ra" | "Email không đúng định dạng. Ví dụ: ten@congty.com" |
| Email đã tồn tại khi đăng ký | "Lỗi" | "Email này đã được đăng ký. Bạn có thể đăng nhập hoặc dùng email khác." |
| Mật khẩu quá ngắn | "Mật khẩu không hợp lệ" | "Mật khẩu cần tối thiểu 8 ký tự, gồm chữ và số." |
| Submit hồ sơ khi thiếu ghi chú bắt buộc (vi phạm chính sách) | "Không thể duyệt" | "Hồ sơ này vượt ngưỡng chính sách. Vui lòng ghi rõ lý do trước khi Duyệt hoặc Từ chối." |
| Mất kết nối khi submit quyết định | "Có lỗi xảy ra, thử lại sau" | "Không thể gửi quyết định do mất kết nối mạng. Quyết định của bạn chưa được lưu — nhấn Thử lại." |
| Không tải được hồ sơ chi tiết | "Lỗi tải trang" | "Không tải được thông tin hồ sơ TR-2026-0032. Kiểm tra kết nối và nhấn Thử lại." |
| Số tiền thực tế vượt dự toán quá 10% | "Số tiền không hợp lệ" | "Khoản này vượt dự toán hơn 10% (2.300.000đ so với dự toán 2.000.000đ). Vui lòng bổ sung ghi chú giải trình." |
| Thiếu biên nhận bắt buộc | "Thiếu thông tin" | "Khoản 'Khách sạn' cần đính kèm biên nhận trước khi gửi khai chi phí." |
| Upload file thất bại (quá dung lượng) | "Upload lỗi" | "File vượt quá 5MB. Vui lòng nén ảnh hoặc chọn file khác." |
| Không có quyền truy cập trang | "Lỗi 403" | "Bạn không có quyền xem hồ sơ này. Liên hệ quản lý trực tiếp nếu cần hỗ trợ." |

### **3.2 Empty states**

| Màn hình | Nội dung gợi ý |
| ----- | ----- |
| Employee Dashboard — chưa có trip nào | Tiêu đề: "Chưa có yêu cầu công tác nào" · Mô tả: "Tạo yêu cầu đầu tiên để bắt đầu theo dõi chuyến đi và chi phí." · CTA: "+ Tạo Trip Request" |
| Manager — tab "Chờ phê duyệt" rỗng | "Không có hồ sơ nào đang chờ bạn duyệt. Mọi yêu cầu hiện đã được xử lý." |
| Finance — chưa có hồ sơ cần đối soát trong kỳ | "Chưa có hồ sơ nào cần đối soát trong kỳ này. Danh sách sẽ cập nhật khi nhân viên khai chi phí." |
| Bảng tổng hợp chi phí — chưa khai khoản nào | "Chưa có khoản chi nào được khai. Chọn một hạng mục bên dưới để bắt đầu (vé máy bay, di chuyển, khách sạn, ăn uống, khác)." |
| Timeline phê duyệt — hồ sơ vừa tạo, chưa ai xử lý | "Hồ sơ đang chờ bước phê duyệt đầu tiên. Bạn sẽ nhận thông báo khi Manager xử lý." |
| Kết quả tìm kiếm/lọc không có hồ sơ khớp | "Không tìm thấy hồ sơ nào khớp với bộ lọc hiện tại. Thử bỏ bớt điều kiện lọc hoặc đổi khoảng thời gian." |

### **3.3 Confirmation messages**

| Hành động | Nội dung |
| ----- | ----- |
| Gửi yêu cầu công tác thành công | "Đã gửi yêu cầu TR-2026-0032. Quản lý trực tiếp sẽ nhận được thông báo để duyệt." |
| Lưu nháp | "Đã lưu nháp. Bạn có thể tiếp tục chỉnh sửa trong mục 'Nháp của tôi'." |
| Manager duyệt hồ sơ | "Đã duyệt hồ sơ TR-2026-0032. Hồ sơ chuyển sang bước phê duyệt cấp 2 (Travel Admin)." |
| Admin phê duyệt cấp 2 | "Đã phê duyệt cấp 2\. Nhân viên có thể bắt đầu khai chi phí thực tế sau chuyến đi." |
| Từ chối hồ sơ | "Đã từ chối hồ sơ TR-2026-0032. Nhân viên sẽ nhận được ghi chú của bạn qua thông báo." |
| Gửi khai chi phí | "Đã gửi khai chi phí thực tế. Bộ phận Finance sẽ đối soát và quyết toán trong vòng 5 ngày làm việc." |
| Xuất PDF thành công | "Đã xuất file PDF hồ sơ TR-2026-0032." |
| Đăng ký tài khoản thành công | "Tạo tài khoản thành công. Bạn có thể đăng nhập ngay bây giờ." |

### **3.4 Loading / trạng thái đang xử lý (microcopy ngắn)**

| Ngữ cảnh | Text |
| ----- | ----- |
| Đang kiểm tra chính sách | "Đang kiểm tra chính sách…" |
| Đang gửi quyết định duyệt | "Đang gửi…" |
| Đang upload biên nhận | "Đang tải lên…" |
| Đang tải danh sách hồ sơ | "Đang tải danh sách…" |

## **4\. Lưu ý áp dụng chung** 

* Màn hình đăng nhập gốc không sử dụng khối "tài khoản demo" — phần đó được bỏ qua khi hệ thống hoá thành design system.  
* Toàn bộ nhãn phân loại (EMPLOYEE DASHBOARD, NEW TRIP REQUEST, mã hồ sơ TR-...) dùng chung style Eyebrow màu cam, bất kể vai trò đang đăng nhập.  
* Card luôn có: nền trắng, viền 1px `#E5E7EB`, bo góc 16px, không đổ bóng đậm.  
* Nút Primary điều hướng (Đăng nhập, Về Dashboard, Quay lại) luôn navy đặc; nút quyết định (Duyệt/Từ chối) tách riêng cặp màu ngữ nghĩa xanh lá–đỏ, không dùng navy.  
* Link dạng text kèm mũi tên ("Xem & duyệt →", "Xem chi phí →") luôn màu xanh lá thương hiệu.  
* Logo "S" đổi màu theo vai trò đăng nhập (Employee \= xanh lá, Manager \= xanh ngọc, Admin \= tím, Finance \= cam).  
* Nút phê duyệt cấp cao nhất (Travel Admin — cấp 2\) đổi từ xanh lá sang tím để phân biệt với "Duyệt yêu cầu" cấp Manager.  
* Khi hồ sơ vi phạm ngưỡng chính sách (ngân sách \>20M, chi phí thực tế vượt dự toán \>10%...), banner đỏ luôn xuất hiện ngay dưới tiêu đề trang trước mọi nội dung khác, kèm badge "VI PHẠM"/"CẢNH BÁO" trên danh sách.  
* Nút "Xuất PDF" (secondary, có icon) là hành động phụ cố định góc trên-phải các trang chi tiết chi phí, không cạnh tranh vị trí với nút hành động chính ở cột phải.

## **5\. Checklist đối chiếu với yêu cầu môn học**

* Tokens: màu, typography, spacing đầy đủ (§1)  
* Component reuse: 17 component dùng chung giữa các role/dashboard (§2)  
* States đầy đủ theo từng component phù hợp: default/hover/disabled/loading/error/empty (§2)  
* UX copy rõ hành động, không mơ hồ, có ví dụ đối chiếu ❌/✅ (§3)  
* **Cần làm trong Figma:** dựng thực tế các state trên thành frame/variant riêng cho mỗi component (Figma Variants), gắn text layer đúng UX copy ở §3 thay vì text giữ chỗ (lorem/placeholder)

