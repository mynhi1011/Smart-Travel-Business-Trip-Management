import { apiRequest } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItineraryTimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ALL_DAY';
export type ItineraryCategory = 'MEETING' | 'ACCOMMODATION' | 'TRANSPORT' | 'MEAL' | 'OTHER';

export interface BackendItineraryItem {
  id: string;
  tripId: string;
  itemDate: string;       // ISO string
  dayNumber: number;
  timeSlot: ItineraryTimeSlot;
  location: string;
  activity: string;
  category: ItineraryCategory;
  estimatedCost: number;
  notes: string | null;
  isAiGenerated: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryResponse {
  tripId: string;
  totalEstimatedCost: number;
  items: BackendItineraryItem[];
}

export interface ItineraryItemInput {
  itemDate: string;           // YYYY-MM-DD
  timeSlot: ItineraryTimeSlot;
  location: string;
  activity: string;
  category: ItineraryCategory;
  estimatedCost?: number;
  notes?: string;
  sortOrder?: number;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function getItinerary(tripId: string): Promise<ItineraryResponse> {
  const res = await apiRequest<{ data: ItineraryResponse }>(`/trips/${tripId}/itinerary`);
  return res.data;
}

export async function addItineraryItem(
  tripId: string,
  input: ItineraryItemInput,
): Promise<BackendItineraryItem> {
  const res = await apiRequest<{ data: BackendItineraryItem }>(`/trips/${tripId}/itinerary`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateItineraryItem(
  tripId: string,
  itemId: string,
  input: Partial<ItineraryItemInput>,
): Promise<BackendItineraryItem> {
  const res = await apiRequest<{ data: BackendItineraryItem }>(
    `/trips/${tripId}/itinerary/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return res.data;
}

export async function deleteItineraryItem(tripId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/trips/${tripId}/itinerary/${itemId}`, { method: 'DELETE' });
}

/** Ghi đè toàn bộ lịch trình bằng danh sách items (dùng khi lưu AI-generated draft). */
export async function replaceItinerary(
  tripId: string,
  items: ItineraryItemInput[],
): Promise<BackendItineraryItem[]> {
  const results: BackendItineraryItem[] = [];
  for (const item of items) {
    results.push(await addItineraryItem(tripId, item));
  }
  return results;
}
