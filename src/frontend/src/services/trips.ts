import { apiRequest } from './api';

// ─── ApprovalReason (khớp với policyRules.ts BE) ─────────────────────────────
export type ApprovalReasonCode =
  | 'URGENT_TRIP'
  | 'BUDGET_OVER_THRESHOLD'
  | 'COMBINED_COST_LIMIT_EXCEEDED';

export interface ApprovalReason {
  code:   ApprovalReasonCode;
  title:  string;
  detail: string;
  data:   Record<string, unknown>;
}

// ─── Level1Approval ───────────────────────────────────────────────────────────
export interface Level1Approval {
  approverName: string;
  approvedAt:   string;
  comment:      string | null;
}

// ─── BackendTrip ──────────────────────────────────────────────────────────────
export interface BackendTrip {
  id: string;
  tripCode: string;
  employeeId: string;
  origin: string;
  destination: string;
  destinationType: string;
  departureDate: string;
  returnDate: string;
  purpose: string;
  estimatedBudget: number;
  status: string;
  isUrgent: boolean;
  urgencyReason: string | null;
  requiresLevel2: boolean;
  /** Snapshot lý do 2 cấp — tính tại lúc submit, bất biến sau đó (D-16) */
  approvalReasons: ApprovalReason[];
  submittedAt: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  tripDays: number;
  employee?: { id: string; name: string; department: string | null; jobGrade: string };
  policyCheckResult?: {
    passed: boolean;
    violations: Array<{
      code: string; detail: string; severity: string; rule?: string;
      limit?: number; actual?: number;
      combinedLimit?: number; hotelLimitTotal?: number; perDiemLimitTotal?: number;
      tripDays?: number; hotelNights?: number; jobGrade?: string; destinationType?: string;
    }>;
    violationCount: number;
    requiresLevel2Approval: boolean;
  } | null;
  /** Thông tin duyệt cấp 1 — có khi trip ở PENDING_ADMIN_APPROVAL hoặc APPROVED */
  level1Approval: Level1Approval | null;
}

interface PaginatedTrips { data: BackendTrip[] }

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

export async function updateTrip(tripId: string, input: Record<string, unknown>): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}`, {
    method: 'PATCH', body: JSON.stringify(input),
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
    method: 'POST', body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function rejectTrip(tripId: string, comment: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/reject`, {
    method: 'POST', body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function closeTrip(tripId: string, comment?: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/close`, {
    method: 'POST', body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  await apiRequest<void>(`/trips/${tripId}`, { method: 'DELETE' });
}

export async function startTrip(tripId: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/start`, { method: 'POST' });
  return response.data;
}

export async function endTrip(tripId: string): Promise<BackendTrip> {
  const response = await apiRequest<{ data: BackendTrip }>(`/trips/${tripId}/end`, { method: 'POST' });
  return response.data;
}
