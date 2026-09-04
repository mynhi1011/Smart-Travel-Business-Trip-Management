import { apiRequest } from './api';

export interface BackendTrip {
  id: string;
  employeeId: string;
  origin: string;
  destination: string;
  destinationType: string;
  departureDate: string;
  returnDate: string;
  purpose: string;
  estimatedBudget: number;
  hotelCostPerNight: number | null;
  hotelNights: number | null;
  perDiemBudget: number | null;
  transportBudget: number | null;
  otherBudget: number | null;
  status: string;
  isUrgent: boolean;
  urgencyReason: string | null;
  requiresLevel2: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  tripDays: number;
  employee?: { id: string; name: string; department: string | null; jobGrade: string };
  policyCheckResult?: {
    passed: boolean;
    violations: Array<{ code: string; detail: string; severity: string }>;
    violationCount: number;
    requiresLevel2Approval: boolean;
  } | null;
}

interface PaginatedTrips {
  data: BackendTrip[];
}

export async function listTrips(): Promise<BackendTrip[]> {
  const response = await apiRequest<PaginatedTrips>('/trips?limit=100');
  return response.data;
}

export async function createTrip(input: Record<string, unknown>): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>('/trips', {
    method: 'POST', body: JSON.stringify(input),
  });
  return response.data;
}

export async function getTripById(tripId: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}`);
  return response.data;
}

export async function submitTrip(tripId: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/submit`, { method: 'POST' });
  return response.data;
}

export async function approveTrip(tripId: string, comment: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function rejectTrip(tripId: string, comment: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function closeTrip(tripId: string, comment?: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/close`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  await apiRequest<void>(`/trips/${tripId}`, { method: 'DELETE' });
}
