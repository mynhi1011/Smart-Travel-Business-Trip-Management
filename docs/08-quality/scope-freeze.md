# Scope Freeze - Bài cuối (60%) - Smart Travel & Business Trip Management

**Dự án:** Smart Travel & Business Trip Management
**Nhóm:** Nhóm 11 - MIS3032_1
**Buổi họp:** Kick-off Bài cuối, 19/09/2026 09:00
**Chủ trì:** Nguyễn Thị Mỹ Nhi (Product/BA)
**Tham dự:** Cả nhóm (Ánh Tuyết, Bảo Ngọc, Tuyết Nhi, Mỹ Nhi, Kim Dung)
**Tham chiếu:** `docs/03-product/taiga-backlog.md` (EP-01→EP-04, Bài 1+2), `taiga-backlog-baicuoi.md` (EP-05→EP-07, Bài cuối), `Output_BaoCao` sheet `MIS3032_1_Aug2026_Plan_Master.xlsx` (checklist 15 mục + rubric), `Nhom11_TheoDoi_TienDo_BaiCuoi_19-27Thang9.xlsx`

---

## 1. Xác nhận Freeze Bài 1 + Bài 2

| Hạng mục | Trạng thái | Evidence |
|---|---|---|
| Project Charter, User Research, Requirements, Vault, Vault Q&A Benchmark, AI Usage Log v1 (Bài 1 - 10%) | Đã Done | `docs/00-project-index.md`, `docs/02-vault/` |
| PRD, User Flow, Prototype, Usability Test, User Stories + AC, Taiga Backlog, Figma + Design System, Architecture + ADR, ERD, API Contract, Story Specs + Traceability v1 (Bài 2 - 30%) | Đã Done | `docs/03-product/`, `docs/04-design/`, `docs/05-technical/` |

- **Git tag:** `report1-freeze` đã tạo lúc 18/09/2026 23:59 (hạn cứng môn học).
- **Cam kết:** Không sửa thêm nội dung Bài 1 + Bài 2 sau mốc freeze này. Mọi thay đổi phát sinh (nếu có) phải ghi vào `docs/02-vault/08-decisions/decision-log.md` kèm lý do, không sửa trực tiếp artifact đã freeze.
- **Traceability v1** (`docs/TRACEABILITY.md`) đã đầy đủ REQ → Story → Design/Spec/Task cho toàn bộ scope Bài 1+2.

---

## 2. Phạm vi Bài cuối (60%) — Must/Should

Toàn bộ 15 mục trong bảng "A. DANH SÁCH ARTIFACT PHẢI CÓ" (`Output_BaoCao`) đều là **Must** — không có mục Should/Could nào trong phạm vi Bài cuối, vì đây là điều kiện bắt buộc để PASS 60% điểm. Mọi cải tiến ngoài rubric (ví dụ thêm state UI, thêm test case ngoài risk chính) là **Nice-to-have**, không được phép làm thay hoặc trễ tiến độ của các mục Must dưới đây.

| Epic | Story ID | Tên Story | Artifact # (Output_BaoCao) | Ưu tiên | Owner chính |
|---|---|---|---|---|---|
| EP-05 | US-11 | Thiết lập nền tảng kiểm thử tự động | #3, #8 | **Must** | Ánh Tuyết (Engineering) |
| EP-05 | US-12 | E2E & Regression Testing | #4, #7, #8 | **Must** | Ánh Tuyết + Bảo Ngọc |
| EP-05 | US-13 | Code Review & Bug Remediation | #6, #7 | **Must** | Ánh Tuyết + Bảo Ngọc |
| EP-05 | US-14 | QA Report & Release Sign-off | #9 | **Must** | Bảo Ngọc (QA/Release) |
| EP-06 | US-15 | Security & NFR Hardening (kèm Repo Audit) | #1, #10 | **Must** | Bảo Ngọc (QA/Release) |
| EP-06 | US-16 | Dockerize & CI/CD Pipeline | #11 | **Must** | Ánh Tuyết (Engineering) |
| EP-06 | US-17 | Staging/Production Deployment | #2, #9 | **Must** | Ánh Tuyết + Kim Dung |
| EP-06 | US-18 | Release Documentation | #12, #13 | **Must** | Mỹ Nhi + Ánh Tuyết |
| EP-07 | US-19 | AI Feature Guardrail & Eval Finalization | #5, #10 | **Must** | Tuyết Nhi (AI/Vault) |
| EP-07 | US-20 | Traceability Matrix Final | #14 | **Must** | Mỹ Nhi + Bảo Ngọc |
| EP-07 | US-21 | AI Usage Log Final & Retrospective | #14, #15 | **Must** | Tuyết Nhi + Mỹ Nhi + Bảo Ngọc |

**Nguồn:** `taiga-backlog-baicuoi.md` mục 3, đã đồng bộ với sheet tiến độ `BaiCuoi_19-27_09` (31→32 Task, TSK-1101 → TSK-2105 + TSK-1503).

---

## 3. Bảng đối chiếu Owner (điều kiện PASS của Kick-off)

> Điều kiện PASS của buổi họp này (theo `Output_BaoCao`): **"Mọi Must story có owner rõ"**.

| Thành viên | Vai trò (theo `docs/team-roles.md`) | Story Must phụ trách chính | Số Task (owner) |
|---|---|---|---|
| Nguyễn Thị Ánh Tuyết | Engineering | US-11, US-12, US-13, US-16, US-17, US-18 | 10 |
| Hà Gia Bảo Ngọc | QA/Release | US-12, US-13, US-14, US-15, US-20 | 10 |
| Nguyễn Ngọc Tuyết Nhi | AI/Vault | US-19, US-21 | 5 |
| Nguyễn Thị Mỹ Nhi | Product/BA | US-18, US-20, US-21 | 4 |
| Hoàng Thị Kim Dung | UX/UI | US-17 (chính), US-17/US-18 (hỗ trợ) | 1 chính + 2 hỗ trợ |

✅ **Kết luận:** Cả 11 Story (US-11 → US-21), tương ứng 15/15 Artifact bắt buộc, đều đã có Owner rõ ràng — đạt điều kiện PASS của Kick-off.

---

## 4. Rủi ro & phụ thuộc cần theo dõi

| Rủi ro | Ảnh hưởng | Phụ thuộc | Giảm thiểu |
|---|---|---|---|
| Bug lớn phát hiện trễ (sau 21/09) | Trễ Deploy Staging 24/09 | US-13 (bug fix) → US-17 (deploy) | Ưu tiên fix bug ưu tiên cao nhất trong ngày 21/09; còn 1 ngày đệm (23/09) trước deploy |
| CI/CD chưa xanh trước Deploy | Không thể chạy `TSK-1701` đúng hạn | `Dockerfile` (22/09) → CI (23/09) → Deploy (24/09) | Không bắt đầu Deploy nếu pipeline CI còn đỏ |
| Repo Audit (`TSK-1503`, 22/09) phát hiện secret đã bị commit | Có thể mất điểm PASS Artifact #1 | Toàn bộ commit từ đầu dự án | Xử lý ngay bằng cách xoá khỏi lịch sử (`git filter-repo`/`BFG`) và xoay vòng secret bị lộ, ghi lại vào `decision-log.md` |
| QA_REPORT v1.0 phụ thuộc Demo URL thật | Nếu Deploy trễ, QA Report cũng trễ theo | `TSK-1701` → `TSK-1402` | Giữ đúng deadline Deploy 24/09 20:00, QA Report chạy ngay sau đó cùng ngày |
| Dry-run 27/09 phát hiện vấn đề sát ngày báo cáo thật (03/10) | Không đủ thời gian sửa | `TSK-2104` (checklist 15/15) → `TSK-2105` (dry-run) | Còn 6 ngày đệm (27/09 → 03/10) để xử lý issue phát sinh |

---

## 5. Cam kết Sign-off

| Thành viên | Xác nhận Must story của mình đã rõ scope & deadline | Ghi chú |
|---|---|---|
| Nguyễn Thị Ánh Tuyết | ☐ | |
| Hà Gia Bảo Ngọc | ☐ | |
| Nguyễn Ngọc Tuyết Nhi | ☐ | |
| Nguyễn Thị Mỹ Nhi | ☐ | |
| Hoàng Thị Kim Dung | ☐ | |

**Sau khi tick đủ 5/5 ô trên → Scope Bài cuối chính thức FREEZE.** Mọi thay đổi scope sau thời điểm này (thêm/bớt Story, đổi Owner) phải được cả nhóm đồng ý và ghi chú lại trong file này (phần Phụ lục bên dưới), không sửa ngầm trong Taiga.

---

## Phụ lục: Lịch sử thay đổi scope (nếu có)

| Ngày | Thay đổi | Lý do | Người duyệt |
|---|---|---|---|
| - | - | - | - |
