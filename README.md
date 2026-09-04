# Smart Travel & Business Trip Management

Hệ thống quản lý xin đi công tác, phê duyệt và chi phí công tác cho doanh nghiệp, có tích hợp tính năng AI sinh itinerary theo constraint và tự động kiểm tra tuân thủ policy.

**Nhóm 11 - MIS3032_1**

## Business Workflow

```
Trip Request → Approval → Itinerary → Trip → Expense → Close
```

- **Employee**: tạo Trip Request, xem trạng thái, ghi nhận Expense sau chuyến đi.
- **Manager**: phê duyệt/từ chối Trip Request.
- **Travel Admin**: xử lý Itinerary, kiểm tra tuân thủ policy công tác.
- **Finance**: đối chiếu và đóng (Close) request sau khi có Expense.

## Tính năng AI

Hệ thống tích hợp AI để:
1. Tự động sinh Itinerary nháp theo constraint (ngân sách, ngày đi/về, điểm đến).
2. Tự động kiểm tra Trip Request có vi phạm Policy công tác hay không, và phát hiện thông tin còn thiếu trước khi trình duyệt.

## Cấu trúc thư mục

> Cây thư mục dưới đây liệt kê đúng file thật đang có trong repo (không phải mô tả rút gọn). Các mục còn để `.gitkeep` nghĩa là thư mục đã tạo sẵn nhưng **chưa có artifact/code thật** (sẽ triển khai ở tuần code/testing/release theo kế hoạch môn học).

```
Smart Travel & Business Trip Management/
├─ README.md                          (file này)
├─ .env.example                       (mẫu biến môi trường)
│
├─ docs/                              (toàn bộ artifact chính thức để chấm điểm)
│  ├─ 00-project-index.md             (mục lục — mở artifact trong 60 giây)
│  ├─ team-roles.md                   (phân vai 5 thành viên)
│  ├─ TRACEABILITY.md                 (ma trận REQ → Story → Design/API → Task)
│  │
│  ├─ 01-discovery/
│  │  ├─ project-charter.md
│  │  ├─ user-research.md
│  │  └─ persona-jtbd.md
│  │
│  ├─ 02-vault/                       (Project Vault - single source of truth để người & AI tra cứu)
│  │  ├─ 00-index.md
│  │  ├─ source-priority.md
│  │  ├─ vault-qa-benchmark.md
│  │  ├─ 01-sources/
│  │  │  └─ interview-notes.md        (ghi chú phỏng vấn gốc)
│  │  ├─ 02-requirements/
│  │  │  ├─ requirements.md           (REQ-TR-01 … REQ-TR-12)
│  │  │  ├─ scope.md
│  │  │  └─ open-questions.md
│  │  ├─ 03-domain/
│  │  │  ├─ business-rules.md
│  │  │  ├─ glossary.md
│  │  │  └─ workflows.md
│  │  └─ 08-decisions/
│  │     └─ decision-log.md
│  │
│  ├─ 03-product/
│  │  ├─ PRD.md
│  │  ├─ user-flow.mmd
│  │  ├─ user-stories.md              (US-01 … US-10)
│  │  └─ taiga-backlog.md
│  │
│  ├─ 04-design/
│  │  ├─ design-system.md
│  │  ├─ prototype-link.md
│  │  └─ usability-test.md
│  │
│  ├─ 05-technical/
│  │  ├─ architecture.md
│  │  ├─ data-model.md
│  │  ├─ API.md
│  │  ├─ openapi.yaml
│  │  ├─ ERD.svg
│  │  ├─ adr/                         (chưa có ADR nào được ghi — .gitkeep)
│  │  ├─ ai/                          (đặc tả & đánh giá tính năng AI Itinerary Generator)
│  │  │  ├─ ai-feature-spec.md
│  │  │  ├─ eval-set.json             (30 test case)
│  │  │  └─ evaluation-result.md      (static validation — NOT EXECUTED vì chưa nối AI provider)
│  │  └─ story-specs/                 (US-01 … US-10, mỗi story 1 file spec)
│  │     ├─ US-01-create-trip-request.md
│  │     ├─ US-02-ai-itinerary.md
│  │     ├─ US-03-itinerary-builder.md
│  │     ├─ US-04-policy-check.md
│  │     ├─ US-05-manager-approve-l1.md
│  │     ├─ US-06-travel-admin-approve-l2.md
│  │     ├─ US-07-expense-claim.md
│  │     ├─ US-08-finance-close.md
│  │     ├─ US-09-dashboard.md
│  │     └─ US-10-notification-pdf.md
│  │
│  ├─ 06-testing/                     (khung file đã tạo — nội dung sẽ điền ở giai đoạn Testing & QA)
│  │  ├─ QA_REPORT.md
│  │  ├─ bug-log.md
│  │  ├─ code-review.md
│  │  └─ security-nfr.md
│  │
│  ├─ 07-release/                     (khung file đã tạo — nội dung sẽ điền ở giai đoạn Release Engineering)
│  │  ├─ RUNBOOK.md
│  │  ├─ RELEASE.md
│  │  └─ CHANGELOG.md
│  │
│  └─ logs/
│     └─ AI_USAGE_LOG.md              (nhật ký dùng AI — cập nhật liên tục)
│
├─ src/
│  ├─ frontend/                       (React + Vite + TypeScript + Tailwind CSS v4)
│  │  ├─ src/
│  │  │  ├─ App.tsx                   (toàn bộ UI — components, hooks, types)
│  │  │  ├─ main.tsx
│  │  │  └─ services/
│  │  │     ├─ api.ts                 (API client — JWT, auto-refresh, error handling)
│  │  │     ├─ trips.ts
│  │  │     ├─ itinerary.ts
│  │  │     └─ expenses.ts
│  │  └─ dist/                        (build output — được backend serve tĩnh)
│  └─ backend/                        (Node.js + Express + TypeScript + Prisma + SQLite)
│     ├─ src/
│     │  ├─ server.ts                 (entry point)
│     │  ├─ app.ts                    (Express setup, routes, static, SPA fallback)
│     │  ├─ routes/                   (trips, itinerary, expenses, auth, ai, notifications)
│     │  ├─ controllers/
│     │  ├─ services/
│     │  ├─ middlewares/
│     │  └─ prisma/
│     │     ├─ schema.prisma
│     │     ├─ seed.ts
│     │     └─ dev.db                 (SQLite — local dev)
│     └─ .env                         (không commit — xem .env.example)
```

**Trạng thái theo tuần kế hoạch (Plan Master MIS3032_1):** Discovery/Vault (tuần 1–2), PRD/Prototype/UX (tuần 3), User Stories/Taiga/Figma/Technical Specs (tuần 4) và đặc tả AI feature (tuần 8) đã có nội dung đầy đủ. Backend API và Frontend SPA đã triển khai và kết nối end-to-end. `06-testing/` và `07-release/` là khung thư mục, nội dung thật sẽ bổ sung ở các tuần Testing & QA và Release Engineering.

## Team

Xem chi tiết phân vai tại [`docs/team-roles.md`](docs/team-roles.md).

| Vai trò | Thành viên |
|---|---|
| Product/BA | Nguyễn Thị Mỹ Nhi |
| AI/Vault | Nguyễn Ngọc Tuyết Nhi |
| UX/UI | Hoàng Thị Kim Dung |
| Engineering | Nguyễn Thị Ánh Tuyết |
| QA/Release | Hà Gia Bảo Ngọc |

## Cách chạy dự án (local — một cổng duy nhất)

Kiến trúc: Express phục vụ cả API lẫn bản build React tại **`localhost:5000`**.
Không cần Docker, không cần deploy, không cần Vite dev server riêng.

### Yêu cầu

- **Node.js ≥ 20** — tải tại [nodejs.org](https://nodejs.org/)
- **npm ≥ 9** (đi kèm Node.js)
- Git

### Bước 1 — Clone repo

```bash
git clone https://github.com/mynhi1011/Smart-Travel-Business-Trip-Management-.git
cd Smart-Travel-Business-Trip-Management-
```

### Bước 2 — Cài dependencies (nên mở 2 terminal và chạy)

```bash
# Backend
cd src/backend
npm install

# Frontend
cd src/frontend
npm install
```

> **Windows PowerShell:** dùng `cd ..\frontend` (dấu `\` thay vì `/`)

### Bước 3 — Tạo file `.env` cho backend

File `.env` không được commit vào repo (chứa secrets). Cần tạo thủ công:

```bash
# macOS / Linux
cd ../backend
cp .env.example .env

# Windows (PowerShell)
cd ..\backend
copy .env.example .env
```

Sau đó mở file `src/backend/.env` bằng bất kỳ text editor nào và **thay 2 dòng JWT** bằng chuỗi bất kỳ (tối thiểu 32 ký tự):

```
JWT_ACCESS_SECRET=bat-ky-chuoi-nao-dai-hon-32-ky-tu-vd-abcdef1234567890abcdef1234567890
JWT_REFRESH_SECRET=mot-chuoi-khac-dai-hon-32-ky-tu-vd-1234567890abcdef1234567890abcdef
```

> Các biến khác (`PORT=5000`, `DATABASE_URL=file:./dev.db`, `NODE_ENV=development`) đã có sẵn giá trị mặc định phù hợp cho dev — không cần đổi.

### Bước 4 — Khởi tạo database và seed dữ liệu mẫu

```bash
# Vẫn ở src/backend/
npm run db:migrate   # tạo database SQLite + chạy migrations
npm run db:seed      # tạo tài khoản demo
```

### Bước 5 — Build frontend

```bash
cd ../frontend
npm run build
```

Lệnh này tạo thư mục `src/frontend/dist/` — backend sẽ tự serve thư mục này.

### Bước 6 — Chạy server

```bash
cd ../backend
npm run dev
```

Kết quả mong đợi:

```
{"level":"INFO","message":"Server started","port":5000,...}
```

Mở trình duyệt tại **[http://localhost:5000](http://localhost:5000)**

---

### Tài khoản demo (password: `12345678`)

| Email | Vai trò |
|---|---|
| `nhanvien@smarttravel.vn` | Employee |
| `truongphong@smarttravel.vn` | Manager |
| `admin@smarttravel.vn` | Travel Admin |
| `ketoan@smarttravel.vn` | Finance |

---

### Chạy lại lần sau

Chỉ cần 1 lệnh (từ thư mục `src/backend/`):

```bash
npm run dev
```

> **Sau khi sửa code frontend**, build lại trước:
> ```bash
> cd src/frontend && npm run build
> ```
> Backend tự reload nhờ `tsx watch` — không cần restart.

---

### Reset dữ liệu về trạng thái ban đầu

```bash
# Từ src/backend/
npm run db:reset
```

Lệnh này xóa sạch database và chạy lại seed.

## Trạng thái dự án

Xem tiến độ và mốc nộp bài tại [`docs/00-project-index.md`](docs/00-project-index.md).
