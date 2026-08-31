# Vault Index - Smart Travel & Business Trip Management

Vault là single source of truth để cả nhóm và AI cùng tra cứu. Khi AI trả lời câu hỏi về nghiệp vụ, phải trích ID/file trong Vault dùng để trả lời, không dựa vào trí nhớ chung.

## Current sources (canonical)

| File | Nội dung | Trạng thái |
|---|---|---|
| `02-requirements/requirements.md` | Requirement Inventory (FR/NFR có ID) | Current |
| `02-requirements/scope.md` | MVP Scope (Must/Should/Could/Out of Scope) | Current |
| `02-requirements/open-questions.md` | Assumptions & Open Questions | Current |
| `03-domain/business-rules.md` | Business Rules (BR-TR-xx) | Current |
| `03-domain/glossary.md` | Glossary 20 thuật ngữ | Current |
| `03-domain/workflows.md` | Workflow trạng thái Trip Request | Current |
| `08-decisions/decision-log.md` | Quyết định quan trọng của dự án | Current |
| `01-sources/interview-notes.md` | Ghi chú user research (stakeholder proxy) | Current — nguồn gốc (đã tổng hợp vào requirements/business-rules) |
| `vault-qa-benchmark.md` | Bộ câu hỏi kiểm chuẩn Vault | Current |

## Superseded

- Không có file superseded tính đến thời điểm hiện tại. Khi một file bị thay thế bởi phiên bản mới, ghi rõ tại đây thay vì xoá lịch sử.

## Cách dùng

1. Khi hai nguồn xung đột, xem `source-priority.md` để biết nguồn nào thắng.
2. Mọi thay đổi business rule/requirement quan trọng phải có entry tương ứng trong `08-decisions/decision-log.md`.
3. Câu hỏi benchmark trong `vault-qa-benchmark.md` phải luôn trả lời được chỉ từ các file "Current" liệt kê ở trên.
