# Kết quả đánh giá AI

## Trạng thái thực thi

**NOT EXECUTED**

Repository có tài liệu ghi Gemini là provider dự kiến, nhưng chưa có AI provider integration hoặc AI evaluation runner được triển khai. Vì vậy không case nào được đánh dấu `PASS` hay `FAIL`. Các kiểm tra cho deliverable này chỉ là static validation: tồn tại file, cú pháp JSON, ID duy nhất, số lượng case, field bắt buộc và coverage theo category.

## Tóm tắt

- Tổng số test case: **30**
- Đã chạy với provider thật: **0**
- Trạng thái static validation: **đã hoàn thành**
- Kết quả runtime của mọi case: **NOT EXECUTED**

## Ma trận kiểm thử

| Category | Số case | Kết quả runtime |
|---|---:|---|
| happy path | 2 | NOT EXECUTED |
| input validation | 5 | NOT EXECUTED |
| boundary/edge cases | 3 | NOT EXECUTED |
| budget constraint | 2 | NOT EXECUTED |
| business rules | 2 | NOT EXECUTED |
| AI guardrails | 2 | NOT EXECUTED |
| output validation | 4 | NOT EXECUTED |
| timeout/error/fallback | 3 | NOT EXECUTED |
| RBAC | 4 | NOT EXECUTED |
| conflict/grounding | 2 | NOT EXECUTED |

## Kết quả từng case

Tất cả case `AI-001` đến `AI-030` đều là **NOT EXECUTED**. Expected behavior, expected result và pass criteria có trong `eval-set.json`; không báo cáo kết quả giả lập.

## Kiểm tra guardrail quan trọng

Các kiểm tra sau đã có trong eval set và cần runtime execution trước release:

- AI không được vượt budget hoặc trả draft partial/không đạt guardrail (`AI-012`, `AI-013`).
- Preferences và provider text không được override budget, approval, workflow hoặc schema rule (`AI-016`, `AI-017`, `AI-029`, `AI-030`).
- Chỉ `EMPLOYEE` đã xác thực và là owner của trip mới được generation (`AI-025` đến `AI-028`).
- Trip đã đóng vẫn immutable (`AI-015`).
- Enum, cost âm và provider output sai định dạng bị reject (`AI-018` đến `AI-021`).
- Provider timeout/failure fallback về nhập itinerary thủ công mà không trả dữ liệu partial (`AI-022` đến `AI-024`).

## Gaps và rủi ro

- Chưa có Gemini provider thật, test runner, fixture hoặc automated assertion harness; runtime behavior chưa được kiểm chứng.
- Server timeout 8 giây mâu thuẫn mục tiêu client-visible `<=5s`.
- Retry semantics chưa rõ: hai retry bổ sung hay hai attempt tổng cộng.
- Formal contract chưa có error code riêng cho timeout/provider failure.
- Output validation chưa đầy đủ cho date, day continuity, slot trùng, JSON sai định dạng và cost aggregation chính xác.
- `US-02` và formal itinerary API không thống nhất về việc apply AI item và `isAiGenerated`.
- Role label và approval status khác nhau giữa Vault/requirements và API/OpenAPI.

## Khuyến nghị

Làm rõ các API Contract Gap với API/architecture owner trước khi triển khai runtime evaluator. Sau đó bổ sung provider stub hoặc deterministic fixture, chạy toàn bộ 30 case trong CI và ghi nhận kết quả thực tế; đồng thời kiểm tra riêng audit event `AI_ITINERARY_APPLIED`. Authorization, approval, policy check và budget enforcement phải tiếp tục được thực thi phía server.# Kết quả đánh giá AI

## Trạng thái thực thi

**NOT EXECUTED**

Repository có tài liệu ghi Gemini là provider dự kiến, nhưng chưa có AI provider integration hoặc AI evaluation runner được triển khai. Vì vậy không case nào được đánh dấu `PASS` hay `FAIL`. Các kiểm tra cho deliverable này chỉ là static validation: tồn tại file, cú pháp JSON, ID duy nhất, số lượng case, field bắt buộc và coverage theo category.

## Tóm tắt

- Tổng số test case: **30**
- Đã chạy với provider thật: **0**
- Trạng thái static validation: **đã hoàn thành**
- Kết quả runtime của mọi case: **NOT EXECUTED**

## Ma trận kiểm thử

| Category | Số case | Kết quả runtime |
|---|---:|---|
| happy path | 2 | NOT EXECUTED |
| input validation | 5 | NOT EXECUTED |
| boundary/edge cases | 3 | NOT EXECUTED |
| budget constraint | 2 | NOT EXECUTED |
| business rules | 2 | NOT EXECUTED |
| AI guardrails | 2 | NOT EXECUTED |
| output validation | 4 | NOT EXECUTED |
| timeout/error/fallback | 3 | NOT EXECUTED |
| RBAC | 4 | NOT EXECUTED |
| conflict/grounding | 2 | NOT EXECUTED |

## Kết quả từng case

Tất cả case `AI-001` đến `AI-030` đều là **NOT EXECUTED**. Expected behavior, expected result và pass criteria có trong `eval-set.json`; không báo cáo kết quả giả lập.

## Kiểm tra guardrail quan trọng

Các kiểm tra sau đã có trong eval set và cần runtime execution trước release:

- AI không được vượt budget hoặc trả draft partial/không đạt guardrail (`AI-012`, `AI-013`).
- Preferences và provider text không được override budget, approval, workflow hoặc schema rule (`AI-016`, `AI-017`, `AI-029`, `AI-030`).
- Chỉ `EMPLOYEE` đã xác thực và là owner của trip mới được generation (`AI-025` đến `AI-028`).
- Trip đã đóng vẫn immutable (`AI-015`).
- Enum, cost âm và provider output sai định dạng bị reject (`AI-018` đến `AI-021`).
- Provider timeout/failure fallback về nhập itinerary thủ công mà không trả dữ liệu partial (`AI-022` đến `AI-024`).

## Gaps và rủi ro

- Chưa có Gemini provider thật, test runner, fixture hoặc automated assertion harness; runtime behavior chưa được kiểm chứng.
- Server timeout 8 giây mâu thuẫn mục tiêu client-visible `<=5s`.
- Retry semantics chưa rõ: hai retry bổ sung hay hai attempt tổng cộng.
- Formal contract chưa có error code riêng cho timeout/provider failure.
- Output validation chưa đầy đủ cho date, day continuity, slot trùng, JSON sai định dạng và cost aggregation chính xác.
- `US-02` và formal itinerary API không thống nhất về việc apply AI item và `isAiGenerated`.
- Role label và approval status khác nhau giữa Vault/requirements và API/OpenAPI.

## Khuyến nghị

Làm rõ các API Contract Gap với API/architecture owner trước khi triển khai runtime evaluator. Sau đó bổ sung provider stub hoặc deterministic fixture, chạy toàn bộ 30 case trong CI và ghi nhận kết quả thực tế; đồng thời kiểm tra riêng audit event `AI_ITINERARY_APPLIED`. Authorization, approval, policy check và budget enforcement phải tiếp tục được thực thi phía server.
