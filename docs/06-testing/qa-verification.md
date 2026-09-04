# QA Human Verification

## AI-QA-01 — QAF-001

### AI Output

Codex phát hiện REQ-TR-01 quy định trạng thái SUBMITTED,
trong khi AC 1.1 và Story Spec quy định DRAFT.

### Human Verification

Đã đối chiếu:

- requirements.md — REQ-TR-01
- user-stories.md — AC 1.1
- US-01-create-trip-request.md

Xác nhận có sự không nhất quán về trạng thái sau khi tạo Trip Request.

### Final Decision

KEEP FINDING.

QA không tự quyết định trạng thái DRAFT hay SUBMITTED.
Chuyển BA/PO xác nhận business behavior.

### Evidence

QAF-001

## AI-QA-02 — QAF-002

### AI Output

Codex phát hiện mâu thuẫn về hành vi khi Per Diem vượt Max_Per_Diem.

### Human Verification

Đã đối chiếu BR-TR-02 với US-01 và xác nhận
hai artifact mô tả hành vi khác nhau.

### Final Decision

KEEP FINDING.

Chuyển BA/PO xác nhận behavior.

## AI-QA-03 — TC-004

### AI Output

Codex phát hiện TC-004 trace AC 1.1 nhưng AC 1.1
chỉ mô tả happy path.

### Human Verification

Đã kiểm tra Story Spec US-01 và xác nhận validation
errors được mô tả tại E-01 đến E-04.

### Final Decision

REVISE TC-004.

QA cập nhật trace của testcase.

## AI-QA-04 — QAF-005

### AI Output

Codex phát hiện PDF implementation trả HTML.

### Human Verification

Đã kiểm tra pdf.controller.ts và Story Spec US-10.
Implementation hiện trả text/html và .html thay vì
application/pdf và .pdf.

### Final Decision

KEEP FINDING + NOT READY.

Không đánh dấu testcase PDF PASS.
