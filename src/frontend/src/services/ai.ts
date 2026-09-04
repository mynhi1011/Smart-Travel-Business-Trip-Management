/**
 * ai.ts — AI Itinerary Generation Service (Frontend)
 *
 * Gọi POST /api/v1/ai/generate-itinerary (API.md §10, US-02, BR-TR-07).
 * Chỉ EMPLOYEE được gọi endpoint này (roleGuard backend).
 * Response chứa danh sách itinerary items đã vượt qua budget guardrail.
 */

import { apiRequest } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiItineraryItem {
  dayNumber: number;
  itemDate: string;       // YYYY-MM-DD
  timeSlot: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ALL_DAY';
  location: string;
  activity: string;
  category: 'MEETING' | 'ACCOMMODATION' | 'TRANSPORT' | 'MEAL' | 'OTHER';
  estimatedCost: number;
  notes: string | null;
}

export interface AiItineraryResult {
  destination: string;
  days: number;
  totalEstimatedCost: number;
  budgetCap: number;
  guardrailPass: boolean;
  items: AiItineraryItem[];
}

export interface GenerateItineraryInput {
  tripId: string;
  destination: string;
  days: number;
  budget: number;         // VNĐ — budget cap cho guardrail BR-TR-07
  preferences?: string;   // tối đa 500 ký tự
}

interface GenerateItineraryResponse {
  data: AiItineraryResult;
}

// ─── API Call ──────────────────────────────────────────────────────────────────

/**
 * generateItinerary — Gọi AI backend để sinh lịch trình công tác
 *
 * @throws ApiError(422) — nếu AI không thể tạo itinerary trong budget (AI_BUDGET_GUARDRAIL_FAILED)
 * @throws ApiError(403) — nếu trip không thuộc user hiện tại
 * @throws ApiError(400) — nếu days > tripDays hoặc input invalid
 */
export async function generateItinerary(
  input: GenerateItineraryInput
): Promise<AiItineraryResult> {
  const response = await apiRequest<GenerateItineraryResponse>(
    '/ai/generate-itinerary',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return response.data;
}
