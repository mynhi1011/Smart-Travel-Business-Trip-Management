# Source Priority - Smart Travel & Business Trip Management

Khi hai nguồn thông tin xung đột, thứ tự ưu tiên như sau (cao → thấp):

1. **Business rules / requirements đã Confirmed** trong `02-requirements/requirements.md` và `03-domain/business-rules.md`.
2. **Decision Log đã ghi nhận** trong `08-decisions/decision-log.md` (VD: D-06, D-07 override số liệu phỏng vấn gốc).
3. **PRD hiện hành** (`docs/03-product/PRD.md`).
4. **User Story / Acceptance Criteria** của sprint hiện tại (`docs/03-product/user-stories.md`).
5. **Prototype / Figma** (`docs/04-design/`) — chỉ minh hoạ hành vi UI, không tự tạo business rule mới.
6. **Interview notes gốc** (`01-sources/interview-notes.md`) — là dữ liệu thô ban đầu, có thể bị chuẩn hoá lại bởi Decision Log (VD: hạn mức khách sạn P3 nêu 1.2 triệu, nhưng D-06 chốt 1 triệu cho hệ thống mẫu).
7. **Chat/AI output** chưa được tích hợp vào tài liệu chính thức chỉ là working note, không dùng làm căn cứ.

**Khi xung đột:** không tự chọn nguồn thấp hơn để "cho tiện". Nếu chưa rõ nguồn nào đúng, mở entry trong `02-requirements/open-questions.md` và chờ quyết định, không để AI tự suy đoán rồi coi là sự thật.
