flowchart TD
    %% Smart Travel & Business Trip Management - User Flow (đã sửa logic rẽ nhánh)

    A["EMPLOYEE<br/>Nhu cầu đi công tác"] --> B["Tạo Trip Request<br/>(Draft)"]
    B --> C["Tạo / Gợi ý Itinerary<br/>• AI gợi ý lịch trình<br/>• Employee điều chỉnh lịch trình"]
    C --> D["Xem & xác nhận Itinerary"]
    D --> E["SYSTEM<br/>Policy Check"]

    E --> F{"Có vi phạm<br/>policy?"}
    %% SỬA: có vi phạm vẫn được gửi duyệt (theo BR-TR-04), chỉ gắn cờ cảnh báo
    %% thay vì bắt buộc loop sửa itinerary trước khi cho gửi
    F -- "Có<br/>(gắn cờ Policy Violation)" --> I["Gửi Request<br/>để phê duyệt<br/>(kèm cờ cảnh báo)"]
    F -- "Không" --> I

    I --> J["MANAGER<br/>Xem chi tiết Request<br/>• Thông tin chuyến đi<br/>• Dự toán chi phí<br/>• Itinerary<br/>• Policy Check"]
    J --> K{"Phê duyệt?"}

    K -- "Reject" --> L["Đóng<br/>Request bị từ chối"]
    K -- "Approve" --> K2{"Ngân sách ≤ 20 triệu<br/>VÀ không vi phạm policy?<br/>(BR-TR-04)"}
# Smart Travel & Busi# Smart Travel & Business Trip Management

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
ness Trip Management

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

    %% SỬA: thêm nhánh rẽ 1 cấp / 2 cấp duyệt sau khi Manager Approve
    K2 -- "Đúng<br/>(chỉ cần 1 cấp)" --> P["Phát hành chuyến đi<br/>(Approved - sẵn sàng khởi hành)"]
    K2 -- "Sai<br/>(> 20 triệu hoặc có vi phạm)" --> M["TRAVEL ADMIN<br/>Kiểm tra chi tiết<br/>& tính khả thi (Cấp 2)"]

    M --> N{"Phê duyệt?"}
    N -- "Reject" --> O["Đóng<br/>Request bị từ chối"]
    N -- "Approve" --> P

    P --> Q["EMPLOYEE<br/>Thực hiện chuyến đi<br/>(theo lịch trình được duyệt)"]
    Q --> R["Expense Claim<br/>Nhập chi phí & upload chứng từ"]

    R --> S["FINANCE<br/>Đối chiếu chi phí<br/>• So với dự toán<br/>• Kiểm tra chứng từ"]
    S --> T{"Hợp lệ?"}

    T -- "Không" --> U["Yêu cầu giải trình<br/>/ điều chỉnh"]
    U --> V["Kiểm tra lại"]
    V --> S

    T -- "Có" --> W["Thanh toán"]
    W --> X["Đóng hồ sơ<br/>(chuyến công tác)"]

    %% System data & audit
    X --> Y["SYSTEM<br/>Lưu trữ & ghi nhận dữ liệu<br/>• Lưu thông tin chuyến đi<br/>• Lưu Itinerary & lịch sử chỉnh sửa<br/>• Lưu lịch sử phê duyệt<br/>• Lưu Expense Claim & chứng từ<br/>• Lưu log hệ thống & audit trail"]

    %% Styling
    classDef employee fill:#eef5ff,stroke:#2563eb,stroke-width:1.5px,color:#0f172a;
    classDef system fill:#eefbf0,stroke:#16a34a,stroke-width:1.5px,color:#0f172a;
    classDef manager fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#0f172a;
    classDef admin fill:#f5f3ff,stroke:#7c3aed,stroke-width:1.5px,color:#0f172a;
    classDef finance fill:#fff7ed,stroke:#f97316,stroke-width:1.5px,color:#0f172a;
    classDef decision fill:#fffaf0,stroke:#f59e0b,stroke-width:1.5px,color:#0f172a;
    classDef end fill:#fff1f2,stroke:#ef4444,stroke-width:1.5px,color:#0f172a;

    class A,B,C,D,Q,R employee;
    class E,Y system;
    class J manager;
    class M,P admin;
    class S,U,V,W finance;
    class F,K,K2,N,T decision;
    class L,O,X end;
