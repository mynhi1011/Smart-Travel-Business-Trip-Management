/**
 * ai.service.ts — AI Itinerary Generation Service
 *
 * API.md §10 | US-02 | BR-TR-06 (trip CLOSED immutable), BR-TR-07 (budget guardrail)
 *
 * Flow: validate ownership/status/days → build validated AI context
 *       → gọi AI client (lib/ai.client) → normalize response theo API contract.
 * Không truyền req.body trực tiếp cho AI — chỉ các field đã validation.
 */

import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';
import { generateItinerary } from '../lib/ai.client';
import type { GenerateItineraryRequest } from '../utils/validators/ai.validator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiItineraryItem {
  dayNumber: number;
  itemDate: string; // YYYY-MM-DD
  timeSlot: string; // MORNING|AFTERNOON|EVENING|ALL_DAY
  location: string;
  activity: string;
  category: string; // MEETING|ACCOMMODATION|TRANSPORT|MEAL|OTHER
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

// ─── generateItineraryDraft ───────────────────────────────────────────────────

export async function generateItineraryDraft(
  userId: string,
  input: GenerateItineraryRequest
): Promise<AiItineraryResult> {
  // 1. Trip phải tồn tại, thuộc Employee (ai-feature-spec.md §9: 403 NOT_OWNER)
  const trip = await prisma.trip.findUnique({
    where: { id: input.tripId },
    select: {
      employeeId: true,
      destination: true,
      departureDate: true,
      returnDate: true,
      purpose: true,
      status: true,
    },
  });
  if (!trip) throw Errors.TRIP_NOT_FOUND();
  if (trip.employeeId !== userId) throw Errors.NOT_OWNER();

  // 2. Trip CLOSED là immutable (BR-TR-06) — sau kiểm tra authorization
  if (trip.status === 'CLOSED') throw Errors.TRIP_IMMUTABLE();

  // 3. days ≤ tripDays (US-02 E-04) — tripDays = returnDate - departureDate + 1
  const dep = new Date(trip.departureDate); dep.setUTCHours(0, 0, 0, 0);
  const ret = new Date(trip.returnDate);    ret.setUTCHours(0, 0, 0, 0);
  const tripDays = Math.round((ret.getTime() - dep.getTime()) / 86_400_000) + 1;
  if (input.days > tripDays) {
    throw Errors.VALIDATION_ERROR({
      fieldErrors: { days: ['Số ngày AI không thể lớn hơn số ngày chuyến đi'] },
      formErrors: [],
    });
  }

  // 4. Gọi AI client với validated context (departureDate lấy từ trip — nguồn tin cậy)
  const departureDate = dep.toISOString().slice(0, 10);
  const draft = await generateItinerary({
    destination: input.destination,
    days: input.days,
    budget: input.budget,
    departureDate,
    purpose: trip.purpose,
  });

  // 5. Normalize response theo API contract (API.md §10: itemDate, budgetCap)
  return {
    destination: input.destination,
    days: input.days,
    totalEstimatedCost: draft.totalEstimatedCost,
    budgetCap: input.budget,
    guardrailPass: true,
    items: draft.items.map((it) => ({
      dayNumber: it.dayNumber,
      itemDate: it.date,
      timeSlot: it.timeSlot,
      location: it.location,
      activity: it.activity,
      category: it.category,
      estimatedCost: it.estimatedCost,
      notes: it.notes ?? null,
    })),
  };
}
