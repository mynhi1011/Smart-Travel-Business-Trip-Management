# Team Roles - Nhóm 11

Đề tài: **Smart Travel & Business Trip Management**

| Vai trò | Thành viên phụ trách | Trách nhiệm chính | Evidence cá nhân bắt buộc phải có |
|---|---|---|---|
| **Product/BA** | Nguyễn Thị Mỹ Nhi | Problem statement, Requirements, Business Rules, PRD, User Stories, Acceptance Criteria, quản lý scope | Bộ requirement có ID + 1 user story trọn vẹn từ đầu đến cuối |
| **AI/Vault** | Nguyễn Ngọc Tuyết Nhi | Xây Project Vault (single source of truth), Q&A Benchmark, AI Usage Log, thiết kế AI Feature (sinh Itinerary + kiểm tra Policy) | Vault Q&A benchmark (≥20 câu, accuracy ≥80%) + AI workflow có evidence |
| **UX/UI** | Hoàng Thị Kim Dung | Prototype, Figma, Design System, UX copy, Usability Test | 1 flow hoàn chỉnh (VD: tạo Trip Request) + tài liệu component/state |
| **Engineering** | Nguyễn Thị Ánh Tuyết | Architecture, ERD/Data Model, API Contract, Implementation, Authentication/Authorization, Pull Request | Triển khai 1 story trọn vẹn + PR có review |
| **QA/Release** | Hà Gia Bảo Ngọc | Test strategy, Test automation, Bug tracking, Code Review checklist, README/Runbook/Release Notes | Bằng chứng test (test-cases + kết quả chạy) + bằng chứng release (demo URL + tag) |

## Nguyên tắc phân vai

Vai trò trên chỉ để phân trách nhiệm chính, **không tạo silo**. Mọi thành viên đều phải hiểu và có thể giải thích toàn bộ luồng end-to-end: **Requirement → Story → Task → Code/PR → Test → Release**. Đây là nội dung sẽ bị hỏi ngẫu nhiên trong buổi báo cáo cá nhân (viva).

## Áp dụng cụ thể cho hệ thống Travel & Business Trip Management

- **Product/BA**: chốt business rules cho workflow Request→Approve→Itinerary→Trip→Expense→Close (VD: hạn mức chi phí theo cấp bậc, số cấp phê duyệt theo giá trị request).
- **AI/Vault**: thiết kế AI feature "sinh itinerary theo constraint + kiểm tra policy" — đây là hạng mục AI feature trọng số cao nhất ở Bài cuối (60%).
- **UX/UI**: thiết kế màn hình Trip Request, Approval, Itinerary, Expense Dashboard theo 4 role khác nhau.
- **Engineering**: dựng data model cho Trip Request/Itinerary/Approval/Expense/Policy; xây RBAC cho 4 role hệ thống (Employee/Manager/Travel Admin/Finance).
- **QA/Release**: thiết kế test case cho các tình huống: request bị từ chối, vượt ngân sách, thiếu itinerary, sai quyền truy cập theo role.
