# Design System - Smart Travel & Business Trip Management
Dự án: Smart Travel & Business Trip Management  
Nhóm: Nhóm 11 - MIS3032_1  
Mức ưu tiên: `Must` (Bắt buộc cho MVP) | `Should` (Quan trọng, làm nếu kịp) | `Could` (Mở rộng)  
Trạng thái: `Draft` | `Confirmed` | `Superseded`

Tài liệu này chuẩn hóa các token màu, typography, spacing, layout và trạng thái UI của hệ thống Smart Travel & Business Trip Management để đồng bộ với prototype và luồng nghiệp vụ thực tế.

### **0.1 Document status & authority levels**

Mỗi quyết định trong design system thuộc một trong ba mức độ sau:

- **Required**: được hỗ trợ trực tiếp bởi requirement, business rule, user story hoặc acceptance criteria đã xác nhận.
- **Prototype decision**: là lựa chọn giao diện nhằm đảm bảo prototype mạch lạc, nhưng chưa phải requirement mới nếu chưa được chốt bởi BA/Product.
- **Open question**: hành vi chưa được xác nhận rõ; Engineering hoặc UX không nên coi đây là quyết định chính thức.

**Quy tắc ưu tiên chồng chéo:** khi design và requirement xung đột, requirement / business rule / user story có ưu tiên cao hơn. Prototype chỉ là bản thân thiện hóa UI, không được dùng để override một requirement đã xác nhận.

### **0.2 Design system scope**

- Dùng cho web desktop trước, hỗ trợ mobile/tablet trong các layout chung.
- Mỗi token phải gắn với nghĩa ngữ cảnh (semantic token), không dùng màu thô bên ngoài token.
- Mỗi component cần có mô tả bản thân ở ít nhất 1 trạng thái default + hover/focus + loading/error khi áp dụng.

## **1\. Design Tokens**

### **1.0 Semantic token (CSS variables)**

Dạng token dưới đây dùng kiểu semantic variable để component thực thi UI theo nghĩa chức năng, không dùng raw color trực tiếp ở component.

```css
:root {
  --color-brand-900: #1B2F35;
  --color-brand-700: #243D45;
  --color-brand-600: #10B981;
  --color-brand-500: #0F9D68;
  --color-accent-500: #F59E0B;
  --color-accent-100: #FDF1CC;
  --color-neutral-0: #FFFFFF;
  --color-neutral-50: #F9FAFB;
  --color-neutral-100: #F3F4F6;
  --color-neutral-200: #E5E7EB;
  --color-neutral-400: #94A3B8;
  --color-neutral-500: #6B7280;
  --color-neutral-900: #1B2F35;
  --color-success-500: #10B981;
  --color-success-100: #DCFCE7;
  --color-warning-500: #F59E0B;
  --color-warning-100: #FEF3C7;
  --color-danger-500: #DC2626;
  --color-danger-100: #FEE2E2;
  --color-info-500: #2563EB;
  --color-info-100: #DBEAFE;
  --color-role-employee: #10B981;
  --color-role-manager: #12A79B;
  --color-role-admin: #7C3AED;
  --color-role-finance: #E8890B;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 8px 16px rgba(15, 23, 42, 0.08);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --z-header: 20;
  --z-drawer: 40;
  --z-modal: 60;
  --z-toast: 80;
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

| Semantic meaning | Token | Usage |
| ----- | ----- | ----- |
| Brand primary | `--color-brand-900` | Header, CTA, primary action |
| Brand success | `--color-success-500` | Approved / success state |
| Warning accent | `--color-warning-500` | Pending / alert |
| Error | `--color-danger-500` | Reject / validation failure |
| Core page background | `--color-neutral-50` | Page canvas |
| Surface | `--color-neutral-0` | Card, modal, input |
| Border | `--color-neutral-200` | Divider, input border |
| Text primary | `--color-neutral-900` | Title, field value |
| Text secondary | `--color-neutral-500` | Caption, helper text |
| Role employee | `--color-role-employee` | Employee dashboard |
| Role admin | `--color-role-admin` | Travel Admin / cấp 2 |

### **1.1 Bảng màu (Color Palette)**

Tông chủ đạo navy gần đen kết hợp xanh lá emerald làm màu thương hiệu, cam làm điểm nhấn nhãn phân loại, 4 màu trạng thái riêng cho quy trình phê duyệt.

| Token | Hex | Dùng cho |
| ----- | ----- | ----- |
| `color/navy-800` | `#1B2F35` | Header, nút Primary, nền stepper |
| `color/brand-green` | `#10B981` | Logo, link, trạng thái thành công |
| `color/accent-orange` | `#F59E0B` | Eyebrow label, bước đang active |
| `color/page-bg` | `#F9FAFB` | Nền toàn trang |
| `color/ink-900` | `#1B2F35` | Text tiêu đề chính |
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

Font: Inter. Tiêu đề đậm (700), text phụ nhẹ màu xám, eyebrow viết hoa giãn chữ màu cam. Tracking (letter-spacing) dùng cho eyebrow.

| Style | Ví dụ | Size / Weight / Letter-spacing |
| ----- | ----- | ----- |
| H1 (Page title) | "Chào mừng trở lại" | 30px (text-3xl) / 700 |
| H2 (Section) | "Tạo yêu cầu công tác" | 24px / 700 |
| H3 | "Đà Nẵng → TP.HCM" | 16px / 700 |
| Eyebrow | "NEW TRIP REQUEST" | 11px (text-[11px]) / 600 / 0.18em tracking / uppercase |
| Body | "Theo dõi, tạo mới hoặc khai báo chi phí thực tế." | 14px (text-sm) / 400 |
| Label | "Email" | 14px (text-sm) / 500 |
| Small / Caption | "Hoàn tất 3 bước..." | 12px (text-xs) / 400 |

### **1.5 Spacing & Bo góc**

**Spacing scale:** `4 (xs)` · `8 (sm)` · `12 (md)` · `16 (md)` · `20 (lg)` · `24 (lg)` · `32 (xl)` · `48 (2xl)`

**Radius:** `sm 6px` · `md 10px` · `lg 16px (rounded-xl, dùng chính)` · `full`

### **1.6 Grid & Layout**

Layout của hệ thống dựa trên shell có độ rộng tối đa 1200px, padding x 16px trên mobile và 24px trên desktop, cùng các khoảng cách dạng card / form / section đã dùng xuyên suốt trong App.tsx.

| Token | Giá trị | Dùng cho |
| ----- | ----- | ----- |
| `grid/container` | `max-width: 1200px` | Container chính của dashboard / detail page |
| `grid/page-padding` | `16px mobile` · `24px desktop` | Padding trái-phải của layout |
| `grid/gap-sm` | `8px` | Khoảng cách nhỏ giữa text, badge, icon |
| `grid/gap-md` | `16px` | Gap chuẩn của card/list items |
| `grid/gap-lg` | `24px` | Gap giữa section / phần nội dung chính |
| `grid/col-2` | `repeat(2, minmax(0, 1fr))` | Form 2 cột, layout trip detail |
| `grid/col-3` | `repeat(3, minmax(0, 1fr))` | KPI card / detail summary |
| `grid/stack` | `1 col trên mobile, 2/3 col trên desktop` | Responsive layout hiện thực theo code |

### **1.7 Motion & elevation**

- Motion chỉ dùng cho thay đổi trạng thái, không làm chậm thao tác quan trọng.
- `duration-fast: 120ms`, `duration-normal: 180ms`.
- `ease-standard: cubic-bezier(0.2, 0, 0, 1)`.
- Elevation tối thiểu: `shadow-sm` cho card nhỏ, `shadow-md` cho card nổi / dialog.
- Z-index: header 20, drawer 40, modal 60, toast 80.
- `prefers-reduced-motion` nên giảm hoặc bỏ transition không cần thiết.

---

## **2. Layout shell & Application structure**

### **2.1 Desktop shell (centered single-column layout)**

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Header 56px: Logo "S" | Role · Name · Title | Notification bell | Logout  │
├────────────────────────────────────────────────────────────────────────────┤
│ Page Header: [Eyebrow label | Title | Subtitle] · [Action button]         │
├────────────────────────────────────────────────────────────────────────────┤
│ Main content (max-width: 1200px, centered)                                 │
│ - Tabs / Filters (if applicable)                                           │
│ - Cards / Form / Summary sections                                          │
│ - Action area / Detail panel                                               │
│ (Padding: 24px left-right on desktop, 16px on mobile)                     │
└────────────────────────────────────────────────────────────────────────────┘
```

**Structure details:**
- **Header**: Height 56px (h-14 in Tailwind), background navy `#1b2f35`, no shadow.
  - Left: Logo badge "S" with role-specific color + "Smart Travel" text.
  - Center: Role label (uppercase) · User name (bold) · User title, hidden on mobile (sm breakpoint).
  - Right: Notification bell with unread badge (red), Logout button (bordered).
- **Page Header**: White background with bottom border, padding 24px left-right (16px on mobile).
  - Eyebrow label (text-[11px], 600 weight, amber-500, tracking-[0.18em] / uppercase).
  - Title (text-3xl / 30px, 700 weight, navy-900 `#1b2f35`).
  - Subtitle (optional, text-sm, gray-500).
  - Action button (right side, e.g., "+ Tạo Trip Request" in emerald-600 primary style).
- **Main Content**: 
  - Container max-width: 1200px (max-w-6xl in Tailwind).
  - Padding: 24px left-right on desktop, 16px on mobile.
  - Background: Light gray (bg-gray-50).
  - Single-column layout, full-width below 1200px.
- **Header z-index**: 20, stays above scrolling content.

### **2.2 Mobile shell (responsive below 768px)**

```text
┌──────────────────────────────┐
│ Logo | Title text | Bell | Logout
├──────────────────────────────┤
│ Page title                  │
│ [Eyebrow] + CTA button      │
├──────────────────────────────┤
│ [Card / form / list]        │
│ [Sticky CTA if needed]      │
└──────────────────────────────┘
```

**Mobile adaptations:**
- **Header**: Same 56px height, but user info (role, name, title) hidden below sm breakpoint.
- **Page Header**: Eyebrow + title stack vertically, action button below title on small screens.
- **Main Content**: Padding reduced to 16px, cards/form stack as 1 column.
- **Sticky CTA**: If present (e.g., "Next" button in forms), must not overlap keyboard on mobile.
- **Navigation**: No drawer/hamburger menu in current implementation; all navigation via route-based screens.

---

## **3\. Components & States**

> Mỗi component dưới đây liệt kê đủ **Default / Hover / Focus / Disabled / Loading / Error / Empty** khi state đó áp dụng được cho component đó. State không áp dụng được thì ghi "—".

### **3.1 Core component variants & states**

| Component | Variant / State | Mô tả |
| ----- | ----- | ----- |
| Button | Primary / Secondary / Ghost / Danger | Có quy chuẩn màu theo function: primary navy, danger đỏ, warning cam |
| Button | Default / Hover / Pressed / Focus / Disabled / Loading | Có thể dùng cho tất cả variant |
| Form control | Default / Focus / Filled / Error / Disabled / Loading | TextField, Select, NumberField |
| Status badge | Draft / Pending / Approved / Rejected / Warning / Error | Có text và màu kèm theo |
| Dialog | Confirm / Warning / Error | Dùng cho approve, reject, close, disable |
| Toast / Feedback | Success / Info / Warning / Error | Dùng để thông báo không block workflow |

### **3.2 Navigation**

Nền navy đậm, logo bo vuông trái, nhóm vai trò + tên người dùng ở giữa-phải, chuông thông báo có badge đỏ cho số chưa đọc, và nút đăng xuất viền mảnh ở phía ngoài cùng phải.

| State | Mô tả |
| ----- | ----- |
| Default | Nền `#1B2F35`, chữ trắng, logo `S` màu theo vai trò (`employee=emerald`, `manager=teal`, `admin=violet`, `finance=amber`) |
| Hover (đăng xuất) | Chữ trắng, viền `#94A3B8`, nền `rgba(255,255,255,0.1)` khi hover |
| Unread badge | Chấm đỏ `#EF4444` góc trên-phải, hiển thị số nếu `1-9`, `9+` nếu `>=10` |
| Active/Selected | Text vai trò và tên người dùng giữ bold, không có underline hay shadow trên top nav |
| Loading | Skeleton bar kế thừa layout, không làm lệch chiều cao header |

### **3.3 Nút bấm (Buttons)**

3 cấp: Primary (navy hoặc xanh lá tuỳ context), Secondary (viền mảnh nền trắng), Ghost (không viền). Nút tạo mới hoặc hành động dương dùng emerald-600/700, nút điều hướng dùng navy, nút từ chối/nguy hiểm dùng đỏ.

| State | Primary (Emerald) | Primary (Navy) | Secondary | Ghost |
| ----- | ----- | ----- | ----- | ----- |
| Default | Nền `#10B981` (emerald-600), chữ trắng | Nền `#1B2F35`, chữ trắng | Viền `#E5E7EB`, chữ `#1B2F35` | Không viền, chữ `#6B7280` |
| Hover | Nền `#059669` (emerald-700) | Nền `#243D45` | Nền `#F5F6F8` | Nền `#F5F6F8`, chữ `#1B2F35` |
| Focus | Ring emerald-400 / ring-2 | Ring `#1B2F35` / ring-2 | Outline `#E5E7EB` | Outline `#E5E7EB` |
| Disabled | Nền `#9CA3AF`, chữ `#E5E7EB`, `cursor-not-allowed` | Nền `#9CA3AF`, chữ `#E5E7EB` | Viền/chữ mờ 40% | Chữ mờ 40% |
| Loading | Spinner di chuyển, không thay đổi chiều cao | Spinner di chuyển | như Primary | như Primary |

**Quy tắc dùng:**
- **Emerald (Xanh lá)**: "+ Tạo Trip Request" (Employee), "Lưu", "Gửi", "Duyệt" (Manager cấp 1)
- **Navy**: Đăng nhập, điều hướng "Về Dashboard", "Quay lại"
- **Danger (Đỏ)**: "Từ chối", "Xóa", các hành động destructive
- **Admin (Tím)**: "Phê duyệt cấp 2" (Travel Admin L2)
- **Secondary**: Nút phụ, "Huỷ", "Nhân bản"
- **Ghost**: Link dạng nút, "Xem", "Chỉnh sửa" (inline)

### **3.4 Trường nhập liệu (Form Fields)**

Nền trắng, viền xám 1px, bo `10px` (rounded-lg), label đậm nhỏ phía trên. Dùng `ring-2 focus:ring-[#1b2f35]` cho focus state. Các loại: TextField, NumberField, DatePicker, Select, Checkbox.

**TextInput / NumberField:**
| State | Mô tả |
| ----- | ----- |
| Default | Viền `#E5E7EB`, nền `#FFFFFF`, padding `px-3.5 py-2.5` |
| Focus | Viền `#E5E7EB` + `ring-2` màu navy `#1b2f35`, không đổ bóng ngoài |
| Filled | Viền `#E5E7EB`, chữ `#1B2F35`, giá trị đã nhập rõ |
| Error | Viền `#F87171` (red-400), nền `#FEF2F2` (red-50), helper text đỏ `#DC2626` ngay dưới |
| Disabled | Nền `#F3F4F6`, chữ `#6B7280`, `cursor-not-allowed`, opacity 50% |

**DatePicker (DateInput):**
| State | Mô tả |
| ----- | ----- |
| Default | Nền trắng, viền `#E5E7EB`, icon mũi tên ở phải (teal-500), popup calendar rounded-xl |
| Opened | Calendar popup hiện dưới input, nền trắng, border-b giữa header tháng năm |
| Date selected | Ngày được chọn highlight nền xanh lá (emerald), hôm nay có border emerald với bg emerald-50 |
| Focus | Ring-2 navy, viền giữ |
| Clear button | Text-xs gray-400 ở dưới calendar, hover text-gray-600 |

**Select Dropdown:**
| State | Mô tả |
| ----- | ----- |
| Default | Input với datalist, viền `#E5E7EB`, chữ `#1b2f35`, dropdown arrow phải |
| Opened | Popup z-50 bg-white, rounded-xl shadow-xl, py-1, mỗi option px-3 py-2 hover:bg-gray-50 |
| Focus | Ring-2 navy, viền `#E5E7EB` |
| Disabled | Opacity 50%, cursor-not-allowed |

**Checkbox:**
| State | Mô tả |
| ----- | ----- |
| Default | Box 4x4 (w-4 h-4), border `#D1D5DB`, rounded-md, nền trắng |
| Checked | Nền navy `#1B2F35`, icon ✓ trắng, border navy |
| Focus | Ring-2 navy |
| Disabled | Opacity 50%, cursor-not-allowed |

### **3.5 Card**

Card dùng làm container chính cho các panel, danh sách, form, summary panel; nền trắng, border 1px, rounded-xl, shadow nhẹ nhưng không quá mạnh.

| State | Mô tả |
| ----- | ----- |
| Default | Nền `#FFFFFF`, viền `#E5E7EB`, bo góc `16px` (`rounded-xl`), shadow `0 1px 2px rgba(15, 23, 42, 0.04)` |
| Hover | `hover:shadow-md`, viền giữ rõ hơn, con trỏ pointer nếu click-through |
| Loading / skeleton | Khối xám mờ thay text nhưng giữ layout card, không làm lệch chiều cao |
| Error/Violation | Viền trái hoặc border đỏ nhạt với background đỏ 5–10% như `bg-red-50/40` |

### **3.6 Modal / Dialog**

Không có modal overlay độc lập trong App.tsx; các hành động xác nhận được render dưới dạng `Card` có frame tập trung ở giữa màn hình với nội dung confirm. Dữ liệu này cần bổ sung từ Figma nếu muốn được chuẩn hoá riêng thành modal hoàn chỉnh.

| State | Mô tả |
| ----- | ----- |
| Default | Card tách biệt trung tâm, nền trắng, viền `#E5E7EB`, padding 24–32px |
| Action footer | Nút chính + nút phụ xếp ngang hoặc dọc, biểu diễn hành động xác nhận / huỷ |
| Warning/Error | Nền và border đỏ nhạt, tiêu đề/ghi chú cảnh báo màu đỏ `#DC2626` |
| Loading | Spinner ở nút xác nhận, disable nút phụ trong khi submit |
| [Cần bổ sung từ Figma] | Modal overlay đầy màn hình / backdrop / motion của dialog chưa có trong code thật |

### **3.7 Table**

Bảng so sánh chi phí / danh sách khoản mục có header in hoa, dữ liệu căn phải ở các cột số, và màu số chênh lệch phản ánh thuận/âm.

| State | Mô tả |
| ----- | ----- |
| Header | Chữ `#9CA3AF`, cỡ 11px, uppercase, font-bold |
| Default row | Nền trắng, border dưới `#F3F4F6`, text `#1B2F35` |
| Positive diff | `text-red-500` / `text-red-600`, biểu thị vượt dự toán |
| Negative diff | `text-emerald-600`, biểu thị tiết kiệm / âm |
| Total row | Border trên dày hơn, text `#1B2F35`, font-bold |
| Empty | Khi không có data, hiển thị empty state thay vì bảng trống đơn lẻ |

### **3.8 Status badge**

Pill dạng chữ in hoa, hiển thị trạng thái xuyên suốt vòng đời hồ sơ. 9 trạng thái chính + 2 flag cảnh báo/vi phạm. Sử dụng `rounded-full` với padding `px-2.5 py-1 / px-2 py-0.5` tùy kích cỡ.

| Loại | Nền | Chữ | Viền |
| ----- | ----- | ----- | ----- |
| Draft (DRAFT) | `#F3F4F6` (gray-100) | `#6B7280` (gray-500) | `#D1D5DB` (gray-300) |
| Chờ duyệt cấp 1 (SUBMITTED) | `#FEF3C7` (amber-100) | `#B45309` (amber-700) | `#FCD34D` (amber-300) |
| Đã duyệt cấp 1 (APPROVED_MANAGER) | `#CCFBF1` (teal-100) | `#0D9488` (teal-700) | `#99F6E4` (teal-200) |
| Chờ duyệt cấp 2 (PENDING_ADMIN_APPROVAL) | `#DBEAFE` (blue-100) | `#2563EB` (blue-600) | `#BFDBFE` (blue-200) |
| Đã duyệt (APPROVED) | `#DCFCE7` (emerald-100) | `#15803D` (emerald-700) | `#BBF7D0` (emerald-200) |
| Đang thực hiện (TRIP_IN_PROGRESS) | `#CFFAFE` (cyan-100) | `#0369A1` (cyan-700) | `#A5F3FC` (cyan-200) |
| Từ chối (REJECTED) | `#FEE2E2` (red-100) | `#DC2626` (red-600) | `#FECACA` (red-200) |
| Đang quyết toán (EXPENSE_SUBMITTED) | `#F3E8FF` (purple-100) | `#7C3AED` (purple-600) | `#E9D5FF` (purple-200) |
| Đóng (CLOSED) | `#F3F4F6` (gray-100) | `#6B7280` (gray-500) | `#D1D5DB` (gray-300) |
| Chờ Manager duyệt bổ sung (PENDING_MANAGER_ADDITIONAL_APPROVAL) | `#FED7AA` (orange-100) | `#EA580C` (orange-700) | `#FDBA74` (orange-300) |
| **Flag: Vi phạm (Error)** | `#FEE2E2` (red-100) | `#DC2626` (red-600) | `#FECACA` (red-200) | Badge text: "Vi phạm" |
| **Flag: Cảnh báo (Warning)** | `#FEF3C7` (amber-100) | `#B45309` (amber-700) | `#FCD34D` (amber-300) | Badge text: "Cảnh báo" |

### **3.9 Thẻ chuyến đi (Trip Card)**

Card hàng ngang: tuyến đi \+ mã hồ sơ trái, nút hành động phụ \+ badge trạng thái phải.

| State | Mô tả |
| ----- | ----- |
| Default | Nền trắng, viền `line-200` |
| Hover | Đổ bóng nhẹ `shadow-sm`, viền đậm hơn, con trỏ pointer (cả card clickable) |
| Loading (skeleton khi tải danh sách) | Khối xám bo góc thay text, animate pulse |
| Empty (không có trip nào) | Xem UX Copy §3.2 — illustration nhạt \+ CTA "+ Tạo Trip Request" |
| Vi phạm chính sách | Viền trái 3px màu đỏ, kèm Flag badge |

### **3.10 Stepper ngang (Wizard 3 bước)**

Nền navy full-width, bước hiện tại tô cam, các bước còn lại mờ 45% opacity trắng.

| State | Mô tả |
| ----- | ----- |
| Chưa tới (upcoming) | Opacity 45%, số bước trong vòng tròn viền mảnh |
| Đang active | Nền cam đặc, chữ trắng, không mờ |
| Đã hoàn tất | Icon ✓ thay số, nền `brand-green` |
| Có lỗi ở bước đã qua | Icon ⚠ đỏ thay ✓, cho phép click quay lại sửa |

### **3.11 Timeline phê duyệt (dọc)**

Chuỗi vòng tròn (w-8 h-8) nối đường thẳng đứng (w-0.5 h-8). Dùng cho flow phê duyệt các bước hồ sơ. Icon hoặc số hiện bên trong vòng.

**States:**
- **Hoàn tất (done)**: Nền emerald-500, chữ trắng, icon ✓
- **Đang xử lý (pending)**: Nền gray-100, chữ gray-400, số thứ tự (1, 2, 3)
- **Chưa tới lượt (upcoming)**: Nền gray-100, chữ gray-400, số thứ tự, mờ 50%
- **Bị từ chối (rejected)**: Nền red-100, chữ red-500, border-2 red-300, icon × (close)
- **Bỏ qua (skipped)**: Nền gray-100, chữ gray-400, border dashed, ký hiệu — (dash)
- **Đường nối (connector)**: emerald-400 nếu done, gray-200 nếu chưa, cao h-8

### **3.12 Stat Card (KPI tổng quan — Finance)**

Label xám nhỏ trên, số liệu lớn đậm dưới.

| State | Mô tả |
| ----- | ----- |
| Default | Số liệu màu theo ý nghĩa (cam \= đang chờ, xanh lá \= hoàn tất, tím \= số tiền) |
| Loading | Số liệu thay bằng skeleton bar, label vẫn hiện |
| Empty (0 hồ sơ trong kỳ) | Hiện "0" thật, không ẩn card — tránh gây hiểu nhầm là lỗi tải dữ liệu |

### **3.13 Tabs có bộ đếm**

Lọc danh sách hồ sơ theo trạng thái. Tab active dùng màu role của dashboard.

| State | Mô tả |
| ----- | ----- |
| Default (inactive) | Chữ `ink-500`, không viền dưới |
| Active | Chữ đậm màu role, viền dưới 2px cùng màu |
| Hover (inactive) | Chữ `ink-900`, nền `page-bg` nhạt |
| Counter \= 0 | Vẫn hiện số "0" mờ, không ẩn tab |
| Disabled (tab chưa có quyền xem) | Chữ opacity 30%, không click được, có thể kèm tooltip lý do |

### **3.14 Decision Panel (Duyệt / Từ chối)**

Khối cố định bên phải màn chi tiết hồ sơ. Ô ghi chú \+ 2 nút xếp chồng full-width.

| State | Mô tả |
| ----- | ----- |
| Default | Nút "Duyệt/Phê duyệt cấp 2" xanh lá (Manager) hoặc tím role-admin (cấp 2); nút "Từ chối" luôn đỏ |
| Hồ sơ vi phạm chính sách (bắt buộc ghi chú) | Tiêu đề panel gắn nhãn phụ "(ghi chú bắt buộc)" màu đỏ, ô ghi chú viền đỏ, 2 nút disable cho tới khi nhập đủ |
| Loading (đang submit quyết định) | Nút được bấm chuyển spinner, nút còn lại disable, ô ghi chú readonly |
| Error (submit thất bại — vd mất mạng) | Banner đỏ nhỏ trong panel: xem UX Copy §3.1 |
| Đã quyết định xong (readonly) | Toàn panel disable, hiện lại quyết định đã chọn \+ tên người duyệt \+ timestamp thay vì 2 nút |

### **3.15 Layout chi tiết hồ sơ (2 cột)**

Cột trái info-card chỉ đọc, cột phải cố định chứa Decision Panel. Dùng chung cho Manager & Travel Admin.

| State | Mô tả |
| ----- | ----- |
| Loading (tải hồ sơ) | Toàn bộ cột trái hiện skeleton card, Decision Panel ẩn tới khi data về |
| Error (không tải được hồ sơ) | Thay cả layout bằng thông báo lỗi \+ nút "Thử lại" — xem UX Copy §3.1 |
| Không có quyền xem | Chuyển hướng hoặc hiện thông báo 403 rõ ràng, không hiện layout rỗng |

### **3.16 Bảng tổng hợp chi phí**

Dòng nhãn \+ số dự toán mờ nhỏ dưới, ô input số bên phải; hàng tổng kết nền xám nhạt.

| State | Mô tả |
| ----- | ----- |
| Default | Input trống, placeholder \= giá trị dự toán mờ |
| Filled | Dòng "Tiết kiệm" cập nhật real-time màu xanh brand (dương) hoặc đỏ (âm — vượt dự toán) |
| Error (nhập số âm hoặc không hợp lệ) | Viền đỏ ô input, helper text ngay dưới ô đó |
| Empty (chưa khai khoản nào) | Xem UX Copy §3.2 |

### **3.17 Banner cảnh báo (Alert)**

3 mức: Error/Vi phạm (đỏ), Warning/Cảnh báo (vàng), Info (xanh dương).

| State | Hành vi |
| ----- | ----- |
| Error | Chặn hành động submit, bắt buộc ghi chú ở Decision Panel nếu có |
| Warning | Chỉ nhắc nhở, không chặn, có nút "Đã hiểu" để ẩn tạm |
| Info | Giải thích lý do một bước bổ sung xuất hiện, không có nút hành động |
| Loading (đang chạy policy check) | Banner dạng skeleton mờ "Đang kiểm tra chính sách…" trước khi kết quả về |

### **3.18 Luồng đăng ký tài khoản (2 bước)**

Stepper 2 bước \+ role-card ở bước 1, account chip ở bước 2\.

| State | Mô tả |
| ----- | ----- |
| Role-card default | Viền `line-200`, logo màu role mờ |
| Role-card selected | Viền đậm 2px màu role, logo đủ màu |
| Error (email đã tồn tại) | Viền đỏ ô email \+ helper text — xem UX Copy §3.1 |
| Loading (đang tạo tài khoản) | Nút "Tiếp tục →" chuyển spinner, toàn form disable |

### **3.19 Dòng khoản chi (Expense Line Item)**

Card thu gọn được, icon \+ tên khoản đầu, dự toán mờ góc phải.

| State | Mô tả |
| ----- | ----- |
| Collapsed (default) | Chỉ hiện tên khoản \+ dự toán \+ tổng đã nhập |
| Expanded | Hiện 2 hàng field: Ngày chi/Tên khoản/Số tiền thực tế \+ Mô tả chứng từ/Đính kèm |
| Đã đính kèm biên nhận | Icon file \+ tên file thay nút "Chọn", có nút "Xem"/"Xoá" |
| Error (thiếu biên nhận bắt buộc, hoặc số tiền vượt ngưỡng) | Viền trái đỏ 3px, badge "⚠" nhỏ cạnh tên khoản |
| Loading (đang upload biên nhận) | Progress bar mảnh dưới nút "Chọn" |
| Empty (khoản mục có sẵn nhưng chưa nhập gì) | Số tiền hiện "—" thay vì "0đ" để phân biệt "chưa nhập" với "nhập 0đ" |

### **3.20 Summary Card (Tóm tắt chi phí)**

Cố định bên phải form khai chi phí.

| State | Mô tả |
| ----- | ----- |
| Default | Tổng dự toán, tổng thực tế, % tiết kiệm |
| Loading | Số liệu skeleton trong lúc các dòng chi phí đang tính lại |
| Vượt dự toán | % hiện màu đỏ thay vì xanh brand, nút hành động chính vẫn bấm được nhưng kèm icon cảnh báo nhỏ |
| Disabled (chưa đủ điều kiện submit) | Nút hành động chính mờ, tooltip giải thích lý do khi hover |

### **3.21 Bảng so sánh chi phí (Finance)**

Liệt kê khoản mục kèm nhà cung cấp, so dự toán/thực tế/% chênh lệch.

| State | Mô tả |
| ----- | ----- |
| Default | Chênh dương \= đỏ, chênh âm (tiết kiệm) \= xanh |
| Empty (chưa có hồ sơ nào cần đối soát) | Xem UX Copy §3.2 |
| Loading | Skeleton rows, hàng "Tổng cộng" ẩn tới khi data đủ |

---

### **3.22 State matrix – Loading / Empty / Error / Success / Permission**

| Context | Loading | Empty | Error | Success | Permission / restricted |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Dashboard | Skeleton card/list | “Chưa có yêu cầu công tác nào” + CTA | Banner lỗi + retry | Toast xác nhận | 403/role-offer message |
| Trip form | Spinner trong nút next | Empty field + helper text | Inline error per field | Confirmation toast + success state | Role mismatch alert |
| Approval detail | Skeleton sidebar + detail | “Không có hồ sơ nào” | Error panel + retry | Approved/rejected confirmation | 403 hoặc redirect |
| Expense form | Progress bar / spinner | “Chưa có khoản chi nào” | Inline validation + summary error | “Gửi khai chi phí thành công” | Form disabled khi không đủ quyền |
| Policy check | “Đang kiểm tra chính sách…” | Không hiển thị empty | Warning alert + reason | Policy result banner | Không áp dụng |
| Navigation | Skeleton header | No data state if no menu item | fallback label | Notification badge updates | Hide unavailable module |

### **3.22A UX Copy**

#### **A. Tổng hợp copy theo nhóm chức năng**

| Loại | Frame/Màn hình xuất hiện | Component gốc | Nội dung copy hiện tại | Ghi chú vấn đề (nếu có) |
| ----- | ----- | ----- | ----- | ----- |
| CTA | Employee Dashboard | PageHeader + action | "+ Tạo Trip Request" | Rõ ràng, ngắn, phù hợp với CTA chính. |
| CTA | New Trip Request | EmpCreate | "Tiếp tục", "Lưu nháp", "Gửi yêu cầu duyệt", "Huỷ" | "Huỷ" và "Quay lại" cùng chức năng nhưng không đồng nhất về phong cách. |
| CTA | AI itinerary | EmpCreate | "Sinh lịch trình bằng AI", "Sinh lại" | Tốt, rõ hành động và ngắn. |
| CTA | Finance | FinExpense / FinClose | "Duyệt chi phí & Đóng hồ sơ", "Approve & Close" | Không nhất quán: tiếng Việt + tiếng Anh + ký hiệu &. |
| Error | Login | LoginScreen | "Email hoặc mật khẩu không đúng." | Dễ hiểu nhưng thiếu hướng dẫn sửa lỗi cụ thể. |
| Error | Register | RegisterScreen | "Mật khẩu phải có ít nhất 6 ký tự." | Rõ ràng, có hành động khắc phục trực tiếp. |
| Error | Create trip | EmpCreate | "Chuyến đi dưới 3 ngày — bắt buộc đánh dấu khẩn cấp và nhập lý do." | Là mẫu error tốt: có nguyên nhân + hành động cụ thể. |
| Error | Itinerary guard | ItineraryList | "Không thể chỉnh sửa/xóa lịch trình trong vòng 1 ngày trước ngày khởi hành." | Rõ ràng, dễ hiểu, có nguyên nhân. |
| Error | Policy banner | PolicyBanner | “Ngân sách 25,000,000đ vượt ngưỡng 20,000,000đ — bắt buộc phê duyệt Travel Admin” | Mạnh về tính actionable, có định hướng xử lý. |
| Empty | Dashboard | EmployeeApp | "Không có chuyến công tác nào." | Rõ và ngắn. |
| Empty | Manager queue | ManagerApp | "Không có yêu cầu nào đang chờ." | Rõ, dễ hiểu. |
| Empty | Notifications | NotifBell | "Không có thông báo nào." | Đúng chuẩn empty state. |
| Empty | Finance | FinanceApp | "Chưa có hồ sơ." | Hơi mơ hồ, chưa chỉ rõ hồ sơ gì. |
| Confirmation | Success screen | EmpSuccess | "Đã gửi yêu cầu duyệt" | Tốt, ngắn, phù hợp với success state. |
| Confirmation | Approval action | ManagerApp | "Yêu cầu được Manager phê duyệt. Chuyến đi của bạn được chấp thuận." | Rõ, nhưng khác cách xưng hô so với các confirmation khác. |
| Confirmation | Register | RegisterScreen | "Đăng ký thành công!" | Tốt, rõ ràng. |
| Confirmation | Password reset | LoginScreen | "Đổi mật khẩu thành công!" | Tốt, ngắn và rõ. |
| Confirmation | Notification success | useNotifications | "TR-2026-9141 đã được Manager phê duyệt." | Phù hợp toast/info message, nhưng có tính hệ thống hơn là UX text. |

#### **B. Quy tắc văn phong copy thống nhất đề xuất**

- Tone: rõ ràng, ngắn gọn, hướng dẫn hành động, không quá kỹ thuật.
- Xưng hô: ưu tiên `bạn` trong validation và hành động, `hệ thống` khi báo trạng thái từ hệ thống.
- CTA: không dùng dấu chấm cuối câu; giữ tối đa 12 từ.
- Error: ngắn gọn, tối đa 20 từ, phải nêu nguyên nhân và cách sửa hoặc bước tiếp theo.
- Empty: tối đa 10 từ, mô tả rõ trạng thái đang rỗng.
- Confirmation: tối đa 16 từ, ưu tiên câu khẳng định “Đã…”, “Yêu cầu…”, “Tài khoản…”.
- Không trộn tiếng Việt và tiếng Anh trong cùng một flow; ưu tiên tiếng Việt cho hệ thống nội bộ.
- Dùng cùng một mẫu câu cho cùng loại state để tránh tạo ra nhiều phong cách khác nhau.
-
Ví dụ mẫu câu nên dùng làm chuẩn:
- “Vui lòng điền đầy đủ thông tin.”
- “Không có chuyến công tác nào.”
- “Đã gửi yêu cầu duyệt.”
- “Không thể chỉnh sửa/xóa lịch trình trong vòng 1 ngày trước ngày khởi hành.”

---

### **3.23 Responsive behavior**

| Breakpoint | Quy tắc |
| ----- | ----- |
| Mobile (<640px / `sm`) | Form xếp 1 cột, padding 16px, card dạng stack, action sticky full-width khi cần |
| Tablet (640–1024px / `sm` to `lg`) | Có thể 2 cột cho layout chính, grid 2 cột cho result, actions ở hàng dưới |
| Desktop (>=1024px / `lg`) | Layout 1–2 cột, max-width 1200px (max-w-6xl), centered 

- Form fields nên giữ chiều cao tối thiểu đủ click: 40px + padding (`py-2.5`).
- Trên màn hình nhỏ, ưu tiên action chính và message quan trọng ở phía trên.
- Không dùng horizontal scroll cho bảng chính; nếu quá hẹp, chuyển bảng thành card list.

### **3.24 Prototype flow map**

```text
Employee Login
  └─ success → Dashboard
       ├─ Create Trip Request → Policy Check
       │      ├─ warning only → Continue to Review
       │      └─ approved → Submit request
       │
       ├─ AI Itinerary (optional) → Review / Edit schedule
       └─ Submit → Manager approval (L1)
                    ├─ Approve → Travel Admin review (L2 if needed)
                    ├─ Reject → Employee receives notice
                    └─ Pending → Wait for decision

Finance flow
  └─ Expense Claim → Variance check
        ├─ within threshold → close trip
        └─ >10% variance → require explanation / re-approval
```

- `AI Itinerary` là tùy chọn, không phải bắt buộc để hoàn tất flow.
- `Submit` chỉ được thực hiện khi form hợp lệ.
- `Warning` không chặn ngay nếu chỉ là cảnh báo chính sách; `Error` hoặc `Reject` mới chặn workflow.

---

## **4\. UX Copy Library**

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

## **5\. Handoff Checklist – Chuyển giao cho Dev / QA**

> Mục này là tiêu chuẩn tối thiểu trước khi prototype được chuyển cho Engineering triển khai. Mỗi màn hình phải đủ traceability, state rõ ràng, focus/contrast tốt và đặt tên đồng nhất với component trong Figma.

### **5.1 Traceability & acceptance criteria**

- [ ] Mỗi màn hình có mã/ID rõ ràng (ví dụ: `AUTH-01`, `TRIP-01`, `APPROVAL-01`, `EXPENSE-01`).
- [ ] Mỗi màn hình được trace tới ít nhất: User Story, Use Case, Functional Requirement và Business Rule liên quan.
- [ ] Acceptance Criteria đã được tham chiếu hoặc tổng hợp ở màn hình đó.
- [ ] Nếu màn hình có logic điều kiện theo vai trò, đã xác định rõ role/permission và behavior tương ứng.
- [ ] Mỗi flow chính có trạng thái thành công, lỗi, empty, loading, retry và quyền truy cập rõ ràng.

### **5.2 State, validation & feedback**

- [ ] Loading state đã được thiết kế rõ: skeleton, spinner, text đang xử lý.
- [ ] Empty state đã có nội dung gợi ý và CTA phù hợp.
- [ ] Error state đã mô tả rõ nguyên nhân và hành động tiếp theo.
- [ ] Success state đã có thông báo xác nhận rõ ràng.
- [ ] Validation của form đã gắn với field cụ thể, không chỉ cảnh báo chung toàn trang.
- [ ] Hành động destructive (hủy, từ chối, disable, close) có confirmation dialog và trạng thái đang xử lý.
- [ ] Mỗi lỗi/validate được gắn với microcopy đủ nghĩa, không dùng câu chung chung thiếu thông tin.

### **5.3 Keyboard focus & accessibility**

- [ ] Tất cả control chính đều có thứ tự tab hợp lý và focus rõ ràng.
- [ ] Focus ring đủ rõ, không phụ thuộc vào màu sắc duy nhất.
- [ ] Màn hình có ít nhất 1 heading chính (`H1`) và không thiếu cấp heading.
- [ ] Dialog/Modal có focus trap, đóng bằng `Esc`, restore focus về trigger khi đóng.
- [ ] Tỷ lệ tương phản màu đạt chuẩn tối thiểu cho text và control quan trọng.
- [ ] Hỗ trợ zoom 200% mà không làm vỡ layout hoặc mất chức năng chính.
- [ ] Icon không mang nghĩa riêng nếu không có `aria-label`/text bổ sung.
- [ ] Status badge có text mô tả trạng thái, không chỉ dùng màu.

### **5.4 Naming convention – Frame / Component / Variant**

Quy ước đặt tên nên thống nhất để Figma, design token và code cùng đồng nhất.

#### **Frame naming**

- `00 Foundations / Colors`
- `00 Foundations / Typography`
- `00 Foundations / Spacing`
- `01 Components / Button / Primary`
- `01 Components / Form / TextField`
- `01 Components / Feedback / Alert`
- `01 Components / Overlay / Dialog`
- `02 Patterns / AppShell / Desktop`
- `02 Patterns / AppShell / Mobile`
- `03 Screens / AUTH-01 / Desktop`
- `03 Screens / TRIP-01 / Desktop`
- `03 Screens / APPROVAL-01 / Desktop`
- `03 Screens / EXPENSE-01 / Desktop`
- `03 Screens / DASHBOARD-01 / Desktop`

#### **Component naming**

- Button
- TextField / NumberField
- Select / Checkbox
- DateTimeField / DateRange
- StatusBadge
- Card / TripCard
- Table / DataTable
- Dialog / ConfirmationDialog
- Alert / Banner
- Navigation / TopNav

#### **Variant naming**

- `Button: variant=primary|secondary|ghost|danger|icon; state=default|hover|focus|disabled|loading`
- `StatusBadge: role=employee|manager|admin|finance; state=pending|approved|rejected|warning|error`
- `Alert: tone=info|warning|error`
- `Card: type=default|summary|warning`
- `Dialog: size=sm|md|lg`

> Quy ước đặt tên này nên được dùng thống nhất trong Figma, prototype và code để tránh drift khi chuyển giao cho dev.

### **5.5 Kết luận readiness trước khi handoff**

- [ ] Prototype và flow đã khớp với User Story / Acceptance Criteria.
- [ ] Mỗi màn hình có rõ target role, context và hành động chính.
- [ ] Tất cả states chính đã được check trước khi test/triển khai.
- [ ] Có file tham chiếu cho Design System, Prototype Link, Usability Test và Traceability Matrix.
- [ ] Yêu cầu không xác định đã được đánh dấu rõ là "Open question" hoặc "Prototype decision", không lẫn với requirement đã confirm.
- [ ] Product/BA, UX/UI, Engineering và QA cùng đồng thuận về tài liệu handoff trước khi chuyển sang sprint phát triển.

---

## **6\. Ghi chú về prototype & handoff**

- Prototype chính hiện tại nằm ở [docs/04-design/prototype-link.md](docs/04-design/prototype-link.md) và cần đồng bộ với design system trong [docs/04-design/design-system.md](docs/04-design/design-system.md).
- Kết quả usability test đang ghi trong [docs/04-design/usability-test.md](docs/04-design/usability-test.md) đóng vai trò input để xác nhận các issue đầu tiên trước khi handoff.
- Mọi phát hiện quan trọng từ usability test hoặc prototype review phải được chuyển thành issue / decision log và không để rơi vào thiết kế mơ hồ.

---

