# Đặc tả tính năng AI: AI Itinerary Generator

## 1. Tổng quan tính năng AI

AI Itinerary Generator tạo itinerary bản nháp theo từng ngày cho chuyến công tác của Employee. Đây chỉ là công cụ hỗ trợ lập kế hoạch: Employee xem trước bản nháp và áp dụng các itinerary item qua workflow itinerary hiện có. Tính năng không phê duyệt trip, không chạy toàn bộ policy engine, không thay đổi trip status và không thay thế người phê duyệt.

Provider dự kiến là Gemini, được gọi phía server thông qua `AIService`. Provider key phải được giữ ở phía server. Endpoint chính thức là `POST /api/v1/ai/generate-itinerary`.

## 2. Input

Request được đặc tả là:

| Field | Contract | Validation |
|---|---|---|
| `tripId` | UUID bắt buộc | Bắt buộc; kiểm tra quyền sở hữu với Employee đã xác thực |
| `destination` | chuỗi bắt buộc | 1-200 ký tự |
| `days` | số nguyên bắt buộc | 1-30 và `days <= trip.tripDays` |
| `budget` | số nguyên VND bắt buộc | Số nguyên dương; dùng làm budget cap của AI itinerary |
| `preferences` | chuỗi tùy chọn | Tối đa 500 ký tự |

Không được mở rộng request bằng các field chưa được đặc tả. `budget` là request cap của AI; tài liệu không quy định giá trị này phải bằng `trip.estimatedBudget`.

## 3. Context

Server cung cấp cho model context request đã được validation và context về ownership/status của trip để thực thi contract:

- destination, số ngày yêu cầu, budget cap và preferences tùy chọn;
- `tripDays`, owner và status của trip được tham chiếu;
- business rule tổng chi phí sinh ra không được vượt budget đã cung cấp;
- rule trip `CLOSED` là immutable.

Không được xem model là nguồn quyết định authorization, workflow status, budget enforcement, policy approval hoặc audit event. Server vẫn là nguồn quyết định. AI flow được đặc tả không nói rằng `PolicyCheckEngine` đầy đủ cho hotel/per-diem chạy lúc generation; engine chạy khi trip submission.

## 4. Output

Response `200` được đặc tả gồm:

```json
{
	"destination": "string",
	"days": 1,
	"totalEstimatedCost": 0,
	"budgetCap": 0,
	"guardrailPass": true,
	"items": [
		{
			"dayNumber": 1,
			"itemDate": "date",
			"timeSlot": "MORNING",
			"location": "string",
			"activity": "string",
			"category": "MEETING",
			"estimatedCost": 0,
			"notes": "string"
		}
	]
}
```

`timeSlot` nhận một trong các giá trị `MORNING`, `AFTERNOON`, `EVENING`, `ALL_DAY`. `category` nhận một trong các giá trị `MEETING`, `ACCOMMODATION`, `TRANSPORT`, `MEAL`, `OTHER`. Kết quả là bản nháp và không được chứa itinerary partial hoặc vượt budget.

## 5. Validation

### Validation request

Server phải reject field bắt buộc bị thiếu hoặc sai định dạng, UUID không hợp lệ, destination ngoài 1-200 ký tự, preferences trên 500 ký tự, days không phải số nguyên hoặc ngoài khoảng, days lớn hơn thời lượng trip và budget VND không dương/không phải số nguyên. Server cũng phải kiểm tra trip tồn tại, thuộc Employee và có thể ghi.

### Validation provider/output

Sau khi provider phản hồi, server phải validation response shape, enum, giá trị số và điều kiện `totalEstimatedCost <= budget`. Chi phí của item phải không âm. Kết quả vi phạm budget guardrail được retry với constraint chặt hơn, tối đa hai lần retry theo tài liệu; nếu tiếp tục thất bại thì trả `422 AI_BUDGET_GUARDRAIL_FAILED`.

Contract có đặc tả kiểm tra budget tổng, nhưng chưa quy định đầy đủ validation cho item date, tính liên tục của day number, time slot trùng, provider JSON sai định dạng hoặc item cost có bắt buộc cộng chính xác bằng `totalEstimatedCost` hay không. Đây là các API Contract Gap và phải được giải quyết trong implementation contract trước khi dùng làm yêu cầu pass/fail.

## 6. Fallback và xử lý lỗi

| Condition | Behavior được đặc tả |
|---|---|
| Request không hợp lệ | Reject theo validation/error contract; không gọi provider |
| Chưa xác thực/forbidden/không phải owner | Reject; không gọi provider |
| Trip đã đóng | Reject với `409 TRIP_IMMUTABLE` |
| Provider timeout/failure | Trả `500`; UI fallback là nhập itinerary thủ công |
| Budget guardrail tiếp tục thất bại | Retry tối đa hai lần, sau đó trả `422 AI_BUDGET_GUARDRAIL_FAILED` |
| Output bất kỳ không hợp lệ/partial/vượt budget | Không trả output; dùng error/fallback path được đặc tả |

Timeout phía server được đặc tả là 8 giây. Mục tiêu client-visible là `<= 5 seconds` với skeleton loading. Hai giá trị này mâu thuẫn đối với request end-to-end và là một `API Contract Gap`; đặc tả này không thay đổi giá trị nào. Cách diễn đạt retry cũng chưa làm rõ “two retries” là hai attempt bổ sung hay hai attempt tổng cộng.

## 7. Business Constraints

- Phải tôn trọng destination, days và budget cap được cung cấp (`BR-TR-07`).
- Tổng chi phí sinh ra không được vượt budget được cung cấp.
- Trip budget và chi phí itinerary item phải dương/không âm theo requirements và data model.
- Giới hạn hotel và per-diem vẫn là policy rule: `STAFF` 1,000,000 VND/night, `MANAGER_GRADE` 1,800,000 VND/night, `DIRECTOR` 3,000,000 VND/night; `TIER1_CITY` 400,000 VND/day và `OTHER` 300,000 VND/day.
- AI generation không approve, submit hoặc close trip. Việc áp dụng bản nháp là workflow action riêng.
- Trip `CLOSED` chỉ đọc.

## 8. AI Guardrails

- Ground mọi kết quả theo destination, days, budget và preferences đã validation.
- Không tự bịa quyết định authorization, approval, payment, reimbursement hoặc policy.
- Không bao giờ trả kết quả vượt budget, partial, sai định dạng hoặc không đạt guardrail.
- Bảo toàn response schema và enum được cho phép.
- Coi preferences và provider text là nội dung không tin cậy; chúng không được override server rule, RBAC, workflow status hoặc budget constraint.
- Không đưa Gemini credential và prompt/context nội bộ vào client response.
- Log request, response, retry/failure, timeout và application event theo yêu cầu logging của architecture.
- AI output là nội dung bản nháp và không được biểu diễn như approval hoặc policy decision cuối cùng.

## 9. Authorization/RBAC

Endpoint yêu cầu Bearer JWT và role `EMPLOYEE`. `tripId` phải thuộc Employee đó. `MANAGER`, `TRAVEL_ADMIN`, `FINANCE` và `ADMIN` không được tài liệu ghi nhận là caller được phép cho AI generation. Employee không phải owner nhận `403 NOT_OWNER`; role bị cấm nhận `403 FORBIDDEN`. Trip đã đóng nhận `409 TRIP_IMMUTABLE` sau các kiểm tra authorization/status theo API implementation.

Glossary dùng `Line Manager`, `Travel Admin` và `Finance Officer`; API role enum dùng `MANAGER`, `TRAVEL_ADMIN` và `FINANCE`. Đây là mapping thuật ngữ, không phải đề xuất đổi API. Đây vẫn là `API Contract Gap` nếu external role label được kỳ vọng là giá trị contract.

## 10. API Integration

- Base URL theo technical contract: `http://localhost:3001/api/v1`.
- Operation: `POST /api/v1/ai/generate-itinerary`.
- Authentication: Bearer JWT.
- Thành công: response bản nháp `200` như trên.
- Budget guardrail failure: `422 AI_BUDGET_GUARDRAIL_FAILED`.
- Từ chối ghi trip đã đóng: `409 TRIP_IMMUTABLE`.
- Provider timeout/failure: `500` generic theo tài liệu.

Apply flow không được thay đổi ở đây. `US-02` mô tả việc áp dụng AI item qua itinerary POST với `isAiGenerated=true`, trong khi formal API contract ghi endpoint này set `isAiGenerated=false` và loại bỏ client input. Không có dedicated AI apply/batch endpoint được đặc tả. Đây là `API Contract Gap`; không được giải quyết bằng cách thay đổi Layer 3 trong đặc tả này.

## 11. Traceability

| Feature rule | Source |
|---|---|
| AI itinerary generation | `REQ-TR-02`, `US-02` |
| Mục tiêu latency | `NFR-TR-02` |
| Audit logging | `NFR-TR-04`; application event `AI_ITINERARY_APPLIED` |
| Budget grounding và guardrail | `BR-TR-07` |
| Quyết định provider | `ADR-06` |
| Workflow draft/apply itinerary | `US-02`, `US-03` |
| Role và thuật ngữ domain | `docs/02-vault/03-domain/glossary.md`, `docs/02-vault/03-domain/workflows.md` |

`docs/TRACEABILITY.md` đang rỗng nên không cung cấp mapping bổ sung. Chi tiết implementation canonical được lấy từ requirements, API contract/OpenAPI, architecture, story specs, Vault và decision log. Requirements/workflow cũng dùng `APPROVED_MANAGER`, trong khi API status enum dùng `SUBMITTED`, `PENDING_ADMIN_APPROVAL` và `APPROVED`; `APPROVED_MANAGER` không có trong OpenAPI. Đây là một `API Contract Gap` khác, không phải thay đổi API trong tài liệu này.

## 12. API Contract Gaps và rủi ro

1. Server timeout 8 giây mâu thuẫn mục tiêu client-visible `<=5s`.
2. Semantics apply AI và `isAiGenerated` mâu thuẫn giữa `US-02` và formal itinerary API.
3. Cách tính số lần retry chưa rõ.
4. `500` generic chưa có error code riêng cho timeout/provider.
5. Chưa đặc tả đầy đủ output validation cho date, day continuity, slot trùng, JSON sai định dạng và cost aggregation.
6. Thuật ngữ role-label và approval-status khác nhau giữa các tài liệu canonical.
7. `REQ-TR-02` chỉ liệt kê destination/days/budget trong khi `US-02` và API có `tripId` cùng `preferences` tùy chọn.

Các gap này được ghi nhận để làm rõ contract; tài liệu Layer 4 này không sửa API hoặc architecture của Layer 3.
