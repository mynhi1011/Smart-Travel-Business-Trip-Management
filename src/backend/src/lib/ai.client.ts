/**
 * ai.client.ts — Google Gemini AI Client with Budget Guardrail
 *
 * Gọi Google Gemini API để sinh gợi ý lịch trình công tác.
 * Server-side guardrail (BR-TR-07): reject nếu tổng chi phí vượt budget.
 * Retry tối đa 2 lần với prompt constraint chặt hơn.
 *
 * Tài liệu tham chiếu: architecture.md §5.5, business-rules.md BR-TR-07
 * Model: gemini-1.5-flash (ADR-06)
 *
 * TODO: Implement đầy đủ khi xây dựng AI feature
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItineraryItem {
  dayNumber: number;
  date: string;
  timeSlot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ALL_DAY';
  location: string;
  activity: string;
  category: 'MEETING' | 'ACCOMMODATION' | 'TRANSPORT' | 'MEAL' | 'OTHER';
  estimatedCost: number;
  notes?: string;
}

export interface ItineraryDraft {
  items: ItineraryItem[];
  totalEstimatedCost: number;
  guardrailPass: boolean;
  retryCount: number;
}

export interface GenerateItineraryInput {
  destination: string;
  days: number;
  budget: number; // VNĐ — budget cap cho guardrail BR-TR-07
  departureDate: string;
  purpose?: string;
}

// ─── AI Client ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const GEMINI_TIMEOUT_MS = 8_000; // NFR-TR-02: timeout 8s để response ≤ 5s đến client

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY không được cấu hình');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

/**
 * buildPrompt — Xây dựng prompt với constraint rõ ràng
 * BR-TR-07: budget_cap phải nằm trong prompt để AI không tự tăng
 */
function buildPrompt(input: GenerateItineraryInput, strictMode = false): string {
  const strictConstraint = strictMode
    ? `\nQUAN TRỌNG: Tổng chi phí PHẢI nhỏ hơn hoặc bằng ${input.budget.toLocaleString('vi-VN')} VNĐ. Đây là ràng buộc CỨNG, không được vượt quá.`
    : '';

  return `Tạo lịch trình công tác chi tiết theo yêu cầu sau và trả về JSON thuần túy (không có markdown, không có code block):

Thông tin chuyến đi:
- Điểm đến: ${input.destination}
- Số ngày: ${input.days} ngày
- Ngày khởi hành: ${input.departureDate}
- Mục đích: ${input.purpose ?? 'Công tác'}
- NGÂN SÁCH TỐI ĐA: ${input.budget.toLocaleString('vi-VN')} VNĐ${strictConstraint}

Yêu cầu JSON output (không có text thêm, chỉ JSON):
{
  "items": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "timeSlot": "MORNING|AFTERNOON|EVENING|ALL_DAY",
      "location": "tên địa điểm",
      "activity": "mô tả hoạt động",
      "category": "MEETING|ACCOMMODATION|TRANSPORT|MEAL|OTHER",
      "estimatedCost": 150000,
      "notes": "ghi chú tùy chọn"
    }
  ],
  "totalEstimatedCost": 1500000
}

Quy tắc:
1. Phân bổ hoạt động theo từng buổi (sáng/chiều/tối)
2. Tổng estimatedCost của tất cả items PHẢI bằng totalEstimatedCost
3. totalEstimatedCost KHÔNG ĐƯỢC vượt ${input.budget.toLocaleString('vi-VN')} VNĐ
4. Mỗi ngày có ít nhất: chỗ ở (ACCOMMODATION) và di chuyển (TRANSPORT)
5. Chi phí phải thực tế, phù hợp với điểm đến tại Việt Nam
6. Chỉ trả về JSON, không có text giải thích`;
}

/**
 * generateItinerary — Sinh lịch trình AI với guardrail BR-TR-07
 *
 * TODO: Implement đầy đủ — hiện tại là skeleton
 */
export async function generateItinerary(
  _input: GenerateItineraryInput
): Promise<ItineraryDraft> {
  void MAX_RETRIES; void GEMINI_TIMEOUT_MS;
  void getGenAI; void buildPrompt;

  // TODO: Implement với retry logic
  // for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  //   const prompt = buildPrompt(input, attempt > 0);
  //   const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
  //   const result = await model.generateContent(prompt);
  //   const text = result.response.text();
  //   const draft = JSON.parse(text) as ItineraryDraft;
  //   if (draft.totalEstimatedCost <= input.budget) return { ...draft, guardrailPass: true, retryCount: attempt };
  // }
  // throw new AppError(422, 'AI_BUDGET_GUARDRAIL_FAILED', '...');

  throw new Error('AI generateItinerary — TODO: implement khi xây dựng AI feature');
}
