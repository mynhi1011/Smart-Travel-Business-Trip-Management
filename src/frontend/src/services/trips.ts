import { apiRequest } from './api';

export interface BackendTrip {
  id: string;
  employeeId: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  purpose: string;
  estimatedBudget: number;
  status: string;
  isUrgent: boolean;
  urgencyReason: string | null;
  submittedAt: string | null;
  employee?: { name: string };
  policyCheckResult?: { violations: Array<{ code: string; detail: string; severity: string }> } | null;
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
