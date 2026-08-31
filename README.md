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

```
├─ README.md               (file này)
├─ .env.example            (mẫu biến môi trường)
│
├─ docs/                   (toàn bộ artifact chính thức để chấm điểm)
│  ├─ 00-project-index.md
│  ├─ team-roles.md
│  ├─ TRACEABILITY.md
│  │
│  ├─ 01-discovery/        (project charter, user research, persona & JTBD)
│  ├─ 02-vault/            (Project Vault - single source of truth để người & AI tra cứu)
│  │  ├─ 00-index.md / source-priority.md / vault-qa-benchmark.md
│  │  ├─ 01-sources/       (interview notes gốc)
│  │  ├─ 02-requirements/  (requirements, scope, open questions)
│  │  ├─ 03-domain/        (business rules, glossary, workflows)
│  │  └─ 08-decisions/     (decision log)
│  ├─ 03-product/          (PRD, user flow, user stories, taiga backlog)
│  ├─ 04-design/           (design system, prototype link, usability test)
│  ├─ 05-technical/        (architecture, data model, API, story specs, ADR, AI feature)
│  ├─ 06-testing/          (QA report, bug log, code review, security/NFR)
│  ├─ 07-release/          (RUNBOOK, RELEASE notes, CHANGELOG)
│  └─ logs/                (AI usage log)
│
├─ src/
│  ├─ frontend/
│  └─ backend/
└─ tests/
```

## Team

Xem chi tiết phân vai tại [`docs/team-roles.md`](docs/team-roles.md).

| Vai trò | Thành viên |
|---|---|
| Product/BA | Nguyễn Thị Mỹ Nhi |
| AI/Vault | Nguyễn Ngọc Tuyết Nhi |
| UX/UI | Hoàng Thị Kim Dung |
| Engineering | Nguyễn Thị Ánh Tuyết |
| QA/Release | Hà Gia Bảo Ngọc |

## Cách chạy dự án

> Sẽ cập nhật chi tiết khi backend/frontend hoàn thành (xem [`docs/07-release/RUNBOOK.md`](docs/07-release/RUNBOOK.md) để biết hướng dẫn setup mới nhất).

```bash
git clone https://github.com/mynhi1011/Smart-Travel-Business-Trip-Management-.git
cd Smart-Travel-Business-Trip-Management-
# hướng dẫn cài đặt môi trường: xem docs/07-release/RUNBOOK.md
```

## Trạng thái dự án

Xem tiến độ và mốc nộp bài tại [`docs/00-project-index.md`](docs/00-project-index.md).
